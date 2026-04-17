/**
 * Eve Trainer — Express HTTP API Server
 *
 * Sprint 1 deliverable: exposes the LearnerProfile API endpoint.
 * Sprint 2 deliverable: adds Dynamic Prompts and Prompt CTR endpoints.
 * Sprint 3 deliverable: adds Learning Assistant prompts endpoint.
 * Sprint 4 deliverable: adds Lesson Complete (reflection prompt) and Streak Nudge endpoints.
 * Sprint 5 deliverable: adds Momentum Nudge (day3/day7 lapse) and Coaching Card endpoints.
 * Sprint 6 deliverable: adds Send Nudge (Braze push + fatigue guard) endpoint.
 * Sprint 7 deliverable: adds Quest Completion, Almost There, and Next Chapter endpoints.
 *
 * Routes:
 *   GET /health                                        — health check
 *   GET /members/:member_id/learner-profile            — C1 Lite Learner Profile
 *   GET /members/:member_id/eve-prompts                — 2–3 ranked dynamic prompts
 *   POST /members/:member_id/prompt-ctr                — record a prompt click (A/B tracking)
 *   GET /members/:member_id/learning-prompts           — 2–3 Learning Assistant prompts
 *   POST /members/:member_id/lesson-complete           — reflection prompt after lesson completion
 *   GET /members/:member_id/streak-nudge               — streak-save nudge if eligible
 *   GET /members/:member_id/momentum-nudge             — day3/day7 lapse nudge if eligible
 *   GET /members/:member_id/coaching-card?lesson_id=   — stuck-point coaching card
 *   POST /members/:member_id/send-nudge                — send a nudge via Braze push (Sprint 6)
 *   POST /members/:member_id/quest-complete            — record quest completion + next-chapter recs (Sprint 7)
 *   GET /members/:member_id/almost-there               — "almost there" prompt when member is 80%+ (Sprint 7)
 *   GET /members/:member_id/next-chapter               — 3–5 next-chapter recommendations (Sprint 7)
 *
 * Design decisions:
 * - Single-file Express server wired to LearnerProfileService via DataAdapter
 * - Response latency target: <2s (enforced by adapter timeout config)
 * - Graceful null handling: 404 for unknown members, never a 500 on missing domains
 * - Fallback rule (< 3 signals) applied inside LearnerProfileService — the API
 *   surfaces used_fallback in member_state so callers know reduced confidence
 * - Dynamic prompts fall back to static prompts when profile fetch fails (Sprint 2)
 * - Learning prompts target <1s latency; lesson_id and quest_id are optional query params
 * - Send-nudge: fatigue guard checked first; Braze down triggers in-app fallback
 */

import express, { Request, Response, NextFunction } from "express";
import { createDataAdapter } from "../config/adapter-config";
import { LearnerProfileService } from "../services/learner-profile";
import { rankPrompts } from "../prompts/prompt-ranking";
import { getPromptById } from "../prompts/prompt-library";
import { rankLearningPrompts } from "../prompts/learning-prompt-ranking";
import { resolveLessonMeta } from "../data/mock-lessons";
import {
  assignABVariant,
  buildPromptSurfacedEvent,
  buildPromptClickedEvent,
  sendAmplitudeEvent,
} from "../services/ab-test";
import type { LearnerProfile } from "../types/index";
import type {
  EvePromptsResponse,
  PromptCtrRequest,
  PromptCtrResponse,
  PromptCategory,
} from "../types/prompts";
import type { LearningPromptsResponse, LearningPromptContext } from "../types/learning";
import type {
  LessonCompleteResponse,
  StreakNudgeResponse,
} from "../types/nudges";
import { shouldFireStreakSave, generateDeepLink } from "../services/dormancy-diagnosis";
import { buildStreakSaveNudge, buildReflectionPrompt } from "../services/streak-nudge";
import { getMockMemberById } from "../data/mock-members";
import { resolveLessonMeta as resolveLessonMetaFn } from "../data/mock-lessons";
import { assignABVariant as assignAB } from "../services/ab-test";
import {
  detectDayLapse,
  detectStuckPoint,
  buildLapseNudge,
  buildCoachingCard,
} from "../services/momentum-nudges";
import type {
  MomentumNudgeResponse,
  CoachingCardResponse,
} from "../types/nudges";
import { deliverNudge, buildPushPayload } from "../services/push-notification";
import { brazeClient } from "../services/braze-client";
import { fatigueGuard } from "../services/fatigue-guard";
import type { PushNotificationResult } from "../types/braze";
import {
  buildStreakSaveNudge as buildStreakNudgeForPush,
  buildReflectionPrompt as buildReflectionForPush,
} from "../services/streak-nudge";
import {
  buildLapseNudge as buildLapseNudgeForPush,
  detectDayLapse as detectDayLapseForPush,
} from "../services/momentum-nudges";
import {
  buildQuestCompletionEvent,
  getNextChapterRecommendations,
  getAlmostTherePrompt,
  buildIntentFallback,
} from "../services/recommendation-engine";
import type { RecommendationResponse } from "../types/recommendations";

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface LearnerProfileResponse {
  data: LearnerProfile;
  meta: {
    request_id: string;
    latency_ms: number;
    adapter: string;
    data_freshness: string;
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}

// ─── Simple request ID generator ─────────────────────────────────────────────

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── App factory (exported so tests can create isolated instances) ────────────

export function createApp(): express.Application {
  const app = express();

  // JSON parsing
  app.use(express.json());

  // ── Request timing middleware ──────────────────────────────────────────────
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.locals["startTime"] = Date.now();
    next();
  });

  // Wire up the service (adapter factory reads DATA_ADAPTER env var)
  const adapter = createDataAdapter();
  const service = new LearnerProfileService(adapter);

  // ── GET /health ────────────────────────────────────────────────────────────
  app.get("/health", async (_req: Request, res: Response) => {
    const healthy = await adapter.healthCheck();
    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      adapter: adapter.adapterName,
      data_freshness: adapter.dataFreshness,
      timestamp: new Date().toISOString(),
    });
  });

  // ── GET /members/:member_id/learner-profile ────────────────────────────────
  app.get(
    "/members/:member_id/learner-profile",
    async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const startTime = res.locals["startTime"] as number ?? Date.now();

      const { member_id } = req.params;

      // Validate member_id format: allow alphanumeric, hyphens, underscores, 1–64 chars
      if (!/^[\w-]{1,64}$/.test(member_id)) {
        const elapsed = Date.now() - startTime;
        const body: ErrorResponse = {
          error: {
            code: "INVALID_MEMBER_ID",
            message: `member_id must be 1–64 alphanumeric/hyphen/underscore characters`,
            request_id: requestId,
          },
        };
        res.status(400).json(body);
        return;
      }

      let profile: LearnerProfile | null;
      try {
        profile = await service.buildProfile(member_id);
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const body: ErrorResponse = {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to build learner profile",
            request_id: requestId,
          },
        };
        res.status(500).json(body);
        return;
      }

      if (profile === null) {
        const elapsed = Date.now() - startTime;
        const body: ErrorResponse = {
          error: {
            code: "MEMBER_NOT_FOUND",
            message: `No data found for member_id: ${member_id}`,
            request_id: requestId,
          },
        };
        res.status(404).json(body);
        return;
      }

      const latencyMs = Date.now() - startTime;

      const body: LearnerProfileResponse = {
        data: profile,
        meta: {
          request_id: requestId,
          latency_ms: latencyMs,
          adapter: adapter.adapterName,
          data_freshness: adapter.dataFreshness,
        },
      };

      res.status(200).json(body);
    }
  );

  // ── GET /members/:member_id/eve-prompts ───────────────────────────────────
  app.get(
    "/members/:member_id/eve-prompts",
    async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const startTime = res.locals["startTime"] as number ?? Date.now();

      const { member_id } = req.params;

      // Validate member_id format
      if (!/^[\w-]{1,64}$/.test(member_id)) {
        const body: ErrorResponse = {
          error: {
            code: "INVALID_MEMBER_ID",
            message: `member_id must be 1–64 alphanumeric/hyphen/underscore characters`,
            request_id: requestId,
          },
        };
        res.status(400).json(body);
        return;
      }

      // Attempt to fetch the learner profile; fall back gracefully on failure
      let profile: LearnerProfile | null = null;
      try {
        profile = await service.buildProfile(member_id);
      } catch {
        // Profile fetch failed — will use static fallback prompts
        profile = null;
      }

      // Profile not found is also a fallback scenario (not a hard 404 for prompts)
      // because we always want to surface something to the member.

      // A/B test assignment (deterministic, stable per member)
      const abAssignment = assignABVariant(member_id);

      // Rank prompts (falls back to static if profile is null)
      const { prompts, isFallback } = rankPrompts(profile);

      // Build and fire the prompt_surfaced Amplitude event (fire-and-forget)
      const surfacedEvent = buildPromptSurfacedEvent(
        member_id,
        prompts,
        abAssignment.variant,
        profile?.member_state.state ?? null,
        isFallback
      );
      void sendAmplitudeEvent(surfacedEvent);

      const latencyMs = Date.now() - startTime;

      const body: EvePromptsResponse = {
        prompts,
        ab_variant: abAssignment.variant,
        is_fallback: isFallback,
        meta: {
          request_id: requestId,
          latency_ms: latencyMs,
          member_state: profile?.member_state.state ?? null,
          adapter: adapter.adapterName,
        },
      };

      res.status(200).json(body);
    }
  );

  // ── POST /members/:member_id/prompt-ctr ───────────────────────────────────
  app.post(
    "/members/:member_id/prompt-ctr",
    async (req: Request, res: Response) => {
      const requestId = generateRequestId();

      const { member_id } = req.params;

      // Validate member_id format
      if (!/^[\w-]{1,64}$/.test(member_id)) {
        const body: ErrorResponse = {
          error: {
            code: "INVALID_MEMBER_ID",
            message: `member_id must be 1–64 alphanumeric/hyphen/underscore characters`,
            request_id: requestId,
          },
        };
        res.status(400).json(body);
        return;
      }

      // Parse and validate request body
      const body = req.body as Partial<PromptCtrRequest>;
      if (!body || typeof body.prompt_id !== "string" || body.prompt_id.trim() === "") {
        const errBody: ErrorResponse = {
          error: {
            code: "INVALID_REQUEST",
            message: "Request body must include a non-empty prompt_id string",
            request_id: requestId,
          },
        };
        res.status(400).json(errBody);
        return;
      }

      const promptId = body.prompt_id.trim();
      const abVariant = body.ab_variant ?? assignABVariant(member_id).variant;
      const memberState = body.member_state ?? null;
      const clickedAt = body.clicked_at ?? new Date().toISOString();

      // Look up the prompt template to get its category
      const template = getPromptById(promptId);
      const promptCategory: PromptCategory = template?.category ?? "reflection";

      // Determine ranking position (1-indexed; default 1 if not determinable)
      const rankingPosition = 1;

      // Build and fire the prompt_clicked Amplitude event
      const clickEvent = buildPromptClickedEvent(
        member_id,
        promptId,
        promptCategory,
        abVariant,
        memberState ?? null,
        rankingPosition,
        clickedAt
      );
      const firedEvent = await sendAmplitudeEvent(clickEvent);

      // Generate a stable event ID
      const eventId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

      const responseBody: PromptCtrResponse = {
        recorded: true,
        event_id: eventId,
        amplitude_event: firedEvent,
      };

      res.status(200).json(responseBody);
    }
  );

  // ── GET /members/:member_id/learning-prompts ─────────────────────────────
  //    Query params: lesson_id (optional), quest_id (optional)
  app.get(
    "/members/:member_id/learning-prompts",
    async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const startTime = res.locals["startTime"] as number ?? Date.now();

      const { member_id } = req.params;

      // Validate member_id format
      if (!/^[\w-]{1,64}$/.test(member_id)) {
        const body: ErrorResponse = {
          error: {
            code: "INVALID_MEMBER_ID",
            message: `member_id must be 1–64 alphanumeric/hyphen/underscore characters`,
            request_id: requestId,
          },
        };
        res.status(400).json(body);
        return;
      }

      // Extract and validate optional query params
      const rawLessonId = typeof req.query["lesson_id"] === "string" ? req.query["lesson_id"].trim() : null;
      const rawQuestId = typeof req.query["quest_id"] === "string" ? req.query["quest_id"].trim() : null;

      const lessonId = rawLessonId && rawLessonId.length > 0 ? rawLessonId : null;
      const questId = rawQuestId && rawQuestId.length > 0 ? rawQuestId : null;

      // Attempt to fetch the learner profile; fall back gracefully on failure
      let profile: LearnerProfile | null = null;
      try {
        profile = await service.buildProfile(member_id);
      } catch {
        profile = null;
      }

      // Resolve lesson metadata (in-memory, synchronous — no latency impact)
      const lessonMeta = resolveLessonMeta(lessonId, questId);

      // Build the learning prompt context
      const learningContext: LearningPromptContext = {
        lesson_id: lessonId,
        quest_id: questId,
        lesson_meta: lessonMeta,
        primary_goal: profile?.intent.primary_goal_category ?? null,
        current_quest_title: profile?.learning.current_quest?.title ?? null,
      };

      // A/B test assignment — use the learning-specific experiment ID
      const abAssignment = assignABVariant(member_id, "eve_learning_prompts_v1");

      // Rank learning prompts (all in-memory, <1ms)
      const { prompts, isFallback } = rankLearningPrompts(profile, learningContext);

      // Build and fire the prompt_surfaced Amplitude event (fire-and-forget)
      const surfacedEvent = buildPromptSurfacedEvent(
        member_id,
        prompts,
        abAssignment.variant,
        profile?.member_state.state ?? null,
        isFallback
      );
      void sendAmplitudeEvent(surfacedEvent);

      const latencyMs = Date.now() - startTime;

      const body: LearningPromptsResponse = {
        prompts,
        ab_variant: abAssignment.variant,
        is_fallback: isFallback,
        meta: {
          request_id: requestId,
          latency_ms: latencyMs,
          member_state: profile?.member_state.state ?? null,
          adapter: adapter.adapterName,
          lesson_id: lessonId,
          quest_id: questId,
        },
      };

      res.status(200).json(body);
    }
  );

  // ── POST /members/:member_id/lesson-complete ─────────────────────────────
  //    Body: { lesson_id: string, quest_id: string }
  //    Returns a reflection prompt 2s after lesson completion (timing is client-side)
  app.post(
    "/members/:member_id/lesson-complete",
    async (req: Request, res: Response) => {
      const requestId = generateRequestId();
      const startTime = res.locals["startTime"] as number ?? Date.now();

      const { member_id } = req.params;

      // Validate member_id format
      if (!/^[\w-]{1,64}$/.test(member_id)) {
        const body: ErrorResponse = {
          error: {
            code: "INVALID_MEMBER_ID",
            message: `member_id must be 1–64 alphanumeric/hyphen/underscore characters`,
            request_id: requestId,
          },
        };
        res.status(400).json(body);
        return;
      }

      // Parse and validate request body
      const reqBody = req.body as Partial<{ lesson_id: string; quest_id: string }>;
      if (!reqBody || typeof reqBody.lesson_id !== "string" || reqBody.lesson_id.trim() === "") {
        const errBody: ErrorResponse = {
          error: {
            code: "INVALID_REQUEST",
            message: "Request body must include a non-empty lesson_id string",
            request_id: requestId,
          },
        };
        res.status(400).json(errBody);
        return;
      }

      const lessonId = reqBody.lesson_id.trim();
      const questId = typeof reqBody.quest_id === "string" ? reqBody.quest_id.trim() : "";

      // Resolve lesson metadata
      const lessonMeta = resolveLessonMetaFn(lessonId, questId || null);

      // Look up raw member data for nudge personalisation
      const rawMember = getMockMemberById(member_id);

      // Attempt to fetch the learner profile for member_state in meta
      let profile = null;
      try {
        profile = await service.buildProfile(member_id);
      } catch {
        profile = null;
      }

      // If we have no lesson or no member, return a graceful null
      if (!rawMember || !lessonMeta) {
        const latencyMs = Date.now() - startTime;
        const abVariant = assignAB(member_id, "eve_reflection_v1").variant;
        const responseBody: LessonCompleteResponse = {
          reflection_prompt: null,
          ab_variant: abVariant,
          meta: {
            request_id: requestId,
            latency_ms: latencyMs,
            member_state: profile?.member_state.state ?? null,
            lesson_id: lessonId,
            quest_id: questId,
          },
        };
        res.status(200).json(responseBody);
        return;
      }

      // Build the reflection prompt
      const reflectionPrompt = buildReflectionPrompt(rawMember, lessonMeta);

      // Control variant: return null prompt (A/B test — nudge vs control)
      const isControl = reflectionPrompt.ab_variant === "control";
      const latencyMs = Date.now() - startTime;

      const responseBody: LessonCompleteResponse = {
        reflection_prompt: isControl ? null : reflectionPrompt,
        ab_variant: reflectionPrompt.ab_variant,
        meta: {
          request_id: requestId,
          latency_ms: latencyMs,
          member_state: profile?.member_state.state ?? reflectionPrompt.member_state,
          lesson_id: lessonId,
          quest_id: questId,
        },
      };

      res.status(200).json(responseBody);
    }
  );

  // ── GET /members/:member_id/streak-nudge ──────────────────────────────────
  //    Returns a streak-save nudge if eligible, or {eligible: false} otherwise
  app.get(
    "/members/:member_id/streak-nudge",
    async (req: Request, res: Response) => {
      const requestId = generateRequestId();

      const { member_id } = req.params;

      // Validate member_id format
      if (!/^[\w-]{1,64}$/.test(member_id)) {
        const body: ErrorResponse = {
          error: {
            code: "INVALID_MEMBER_ID",
            message: `member_id must be 1–64 alphanumeric/hyphen/underscore characters`,
            request_id: requestId,
          },
        };
        res.status(400).json(body);
        return;
      }

      // Look up raw member data
      const rawMember = getMockMemberById(member_id);

      if (!rawMember) {
        const responseBody: StreakNudgeResponse = {
          eligible: false,
          reason: "member_not_found",
        };
        res.status(200).json(responseBody);
        return;
      }

      // Check streak-save eligibility using current server hour
      const currentHour = new Date().getHours();

      // Check specific ineligibility reasons for clear client feedback
      if (rawMember.engagement.streak_days === 0) {
        const responseBody: StreakNudgeResponse = {
          eligible: false,
          reason: "no_active_streak",
        };
        res.status(200).json(responseBody);
        return;
      }

      const daysSinceActive = Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(rawMember.engagement.last_active_at).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      if (daysSinceActive < 1) {
        const responseBody: StreakNudgeResponse = {
          eligible: false,
          reason: "already_active_today",
        };
        res.status(200).json(responseBody);
        return;
      }

      if (currentHour >= 20) {
        const responseBody: StreakNudgeResponse = {
          eligible: false,
          reason: "after_8pm",
        };
        res.status(200).json(responseBody);
        return;
      }

      // Member is eligible — build the streak-save nudge
      // Pick a suggested lesson from their current quest or first quest
      const currentQuestId =
        rawMember.learning.current_quest?.quest_id ??
        rawMember.learning.quests[0]?.quest_id ??
        "q001";

      const lessonMeta = resolveLessonMetaFn(null, currentQuestId);
      const fallbackLesson = lessonMeta ?? {
        lesson_id: "l001",
        title: "Discovering Your Extraordinary Potential",
        topic: "unlocking potential",
        quest_id: "q001",
        quest_title: "Be Extraordinary",
        quest_category: "performance",
      };

      const nudge = buildStreakSaveNudge(rawMember, fallbackLesson);

      const responseBody: StreakNudgeResponse = {
        eligible: true,
        nudge,
      };

      res.status(200).json(responseBody);
    }
  );

  // ── GET /members/:member_id/momentum-nudge ────────────────────────────────
  //    Returns a lapse nudge (day3 or day7) if the member is eligible,
  //    or {eligible: false} if no nudge applies.
  app.get(
    "/members/:member_id/momentum-nudge",
    async (req: Request, res: Response) => {
      const { member_id } = req.params;

      // Validate member_id format
      if (!/^[\w-]{1,64}$/.test(member_id)) {
        const body: ErrorResponse = {
          error: {
            code: "INVALID_MEMBER_ID",
            message: `member_id must be 1–64 alphanumeric/hyphen/underscore characters`,
            request_id: generateRequestId(),
          },
        };
        res.status(400).json(body);
        return;
      }

      // Look up raw member data
      const rawMember = getMockMemberById(member_id);

      if (!rawMember) {
        const responseBody: MomentumNudgeResponse = { eligible: false };
        res.status(200).json(responseBody);
        return;
      }

      // Detect lapse type
      const lapse = detectDayLapse(rawMember);

      if (lapse.type === "none") {
        const responseBody: MomentumNudgeResponse = { eligible: false };
        res.status(200).json(responseBody);
        return;
      }

      // Resolve the best lesson to deep-link to
      const currentQuestId =
        rawMember.learning.current_quest?.quest_id ??
        rawMember.learning.quests[0]?.quest_id ??
        "q001";
      const lessonMeta = resolveLessonMetaFn(null, currentQuestId);
      const lessonId = lessonMeta?.lesson_id ?? "l001";

      // Build deep-link
      const deepLink = generateDeepLink(member_id, lessonId, "re_entry");

      // Build the lapse nudge
      const nudge = buildLapseNudge(rawMember, lapse.type, deepLink);

      const responseBody: MomentumNudgeResponse = { eligible: true, nudge };
      res.status(200).json(responseBody);
    }
  );

  // ── GET /members/:member_id/coaching-card?lesson_id=:lesson_id ───────────
  //    Returns a coaching card if the member is stuck (7+ days on same lesson),
  //    or {stuck: false} otherwise.
  app.get(
    "/members/:member_id/coaching-card",
    async (req: Request, res: Response) => {
      const { member_id } = req.params;

      // Validate member_id format
      if (!/^[\w-]{1,64}$/.test(member_id)) {
        const body: ErrorResponse = {
          error: {
            code: "INVALID_MEMBER_ID",
            message: `member_id must be 1–64 alphanumeric/hyphen/underscore characters`,
            request_id: generateRequestId(),
          },
        };
        res.status(400).json(body);
        return;
      }

      // Extract optional lesson_id from query string
      const rawLessonId =
        typeof req.query["lesson_id"] === "string" ? req.query["lesson_id"].trim() : null;
      const lessonId = rawLessonId && rawLessonId.length > 0 ? rawLessonId : null;

      // Look up raw member data
      const rawMember = getMockMemberById(member_id);

      if (!rawMember) {
        const responseBody: CoachingCardResponse = { stuck: false };
        res.status(200).json(responseBody);
        return;
      }

      // Resolve lesson metadata — prefer the explicit lesson_id param,
      // then fall back to the member's current quest, then global fallback
      const currentQuestId =
        rawMember.learning.current_quest?.quest_id ??
        rawMember.learning.quests[0]?.quest_id ??
        "q001";
      const lessonMeta = resolveLessonMetaFn(lessonId, currentQuestId);
      const fallbackLesson = lessonMeta ?? {
        lesson_id: "l001",
        title: "Discovering Your Extraordinary Potential",
        topic: "unlocking potential",
        quest_id: "q001",
        quest_title: "Be Extraordinary",
        quest_category: "performance",
      };

      // Detect stuck point
      const stuckDetection = detectStuckPoint(rawMember, fallbackLesson);

      if (!stuckDetection.stuck) {
        const responseBody: CoachingCardResponse = { stuck: false };
        res.status(200).json(responseBody);
        return;
      }

      // Build coaching card for the stuck lesson
      // Prefer the explicit stuck_lesson_id over the query param lesson
      const stuckLessonMeta = rawMember.stuck_lesson_id
        ? resolveLessonMetaFn(rawMember.stuck_lesson_id, null) ?? fallbackLesson
        : fallbackLesson;

      const card = buildCoachingCard(rawMember, stuckLessonMeta);

      const responseBody: CoachingCardResponse = { stuck: true, card };
      res.status(200).json(responseBody);
    }
  );

  // ── POST /members/:member_id/send-nudge ─────────────────────────────────────
  //    Body: { nudge_type: 'streak_save' | 'day3' | 'day7' | 'coaching' }
  //    Triggers the full delivery pipeline:
  //      1. Fatigue guard check (1 nudge per member per 24h)
  //      2. Build the appropriate NudgeEvent
  //      3. Deliver via Braze push (or in-app fallback if Braze is down)
  //    Returns PushNotificationResult with channel + braze_response
  app.post(
    "/members/:member_id/send-nudge",
    async (req: Request, res: Response) => {
      const requestId = generateRequestId();

      const { member_id } = req.params;

      // Validate member_id format
      if (!/^[\w-]{1,64}$/.test(member_id)) {
        const body: ErrorResponse = {
          error: {
            code: "INVALID_MEMBER_ID",
            message: `member_id must be 1–64 alphanumeric/hyphen/underscore characters`,
            request_id: requestId,
          },
        };
        res.status(400).json(body);
        return;
      }

      // Parse and validate request body
      const reqBody = req.body as Partial<{ nudge_type: string }>;
      const validNudgeTypes = ["streak_save", "day3", "day7", "coaching"] as const;
      type ValidNudgeType = typeof validNudgeTypes[number];

      if (
        !reqBody ||
        typeof reqBody.nudge_type !== "string" ||
        !validNudgeTypes.includes(reqBody.nudge_type as ValidNudgeType)
      ) {
        const errBody: ErrorResponse = {
          error: {
            code: "INVALID_REQUEST",
            message: `Request body must include nudge_type: one of ${validNudgeTypes.join(", ")}`,
            request_id: requestId,
          },
        };
        res.status(400).json(errBody);
        return;
      }

      const nudgeType = reqBody.nudge_type as ValidNudgeType;

      // Look up raw member data
      const rawMember = getMockMemberById(member_id);

      if (!rawMember) {
        const errBody: ErrorResponse = {
          error: {
            code: "MEMBER_NOT_FOUND",
            message: `No data found for member_id: ${member_id}`,
            request_id: requestId,
          },
        };
        res.status(404).json(errBody);
        return;
      }

      // Resolve lesson for building the nudge
      const currentQuestId =
        rawMember.learning.current_quest?.quest_id ??
        rawMember.learning.quests[0]?.quest_id ??
        "q001";
      const lessonMeta = resolveLessonMetaFn(null, currentQuestId);
      const fallbackLesson = lessonMeta ?? {
        lesson_id: "l001",
        title: "Discovering Your Extraordinary Potential",
        topic: "unlocking potential",
        quest_id: "q001",
        quest_title: "Be Extraordinary",
        quest_category: "performance",
      };

      // Build the NudgeEvent based on the requested nudge_type
      let nudgeEvent;

      if (nudgeType === "streak_save") {
        nudgeEvent = buildStreakNudgeForPush(rawMember, fallbackLesson);
      } else if (nudgeType === "day3" || nudgeType === "day7") {
        const deepLink = generateDeepLink(member_id, fallbackLesson.lesson_id, "re_entry");
        nudgeEvent = buildLapseNudgeForPush(rawMember, nudgeType, deepLink);
      } else {
        // coaching — use lapse nudge as the base coaching nudge type
        const deepLink = generateDeepLink(member_id, fallbackLesson.lesson_id, "re_entry");
        // Use day7 as the strongest coaching nudge
        nudgeEvent = buildLapseNudgeForPush(rawMember, "day7", deepLink);
      }

      // Run the full delivery pipeline (fatigue guard → Braze → fallback)
      const result: PushNotificationResult = await deliverNudge(rawMember, nudgeEvent);

      res.status(200).json(result);
    }
  );

  // ── POST /members/:member_id/quest-complete ─────────────────────────────────
  //    Body: { quest_id: string, completion_percentage: number }
  //    Records the quest completion event and returns next-chapter recommendations.
  app.post(
    "/members/:member_id/quest-complete",
    async (req: Request, res: Response) => {
      const requestId = generateRequestId();

      const { member_id } = req.params;

      // Validate member_id format
      if (!/^[\w-]{1,64}$/.test(member_id)) {
        const body: ErrorResponse = {
          error: {
            code: "INVALID_MEMBER_ID",
            message: `member_id must be 1–64 alphanumeric/hyphen/underscore characters`,
            request_id: requestId,
          },
        };
        res.status(400).json(body);
        return;
      }

      // Parse and validate request body
      const reqBody = req.body as Partial<{ quest_id: string; completion_percentage: number }>;

      if (!reqBody || typeof reqBody.quest_id !== "string" || reqBody.quest_id.trim() === "") {
        const errBody: ErrorResponse = {
          error: {
            code: "INVALID_REQUEST",
            message: "Request body must include a non-empty quest_id string",
            request_id: requestId,
          },
        };
        res.status(400).json(errBody);
        return;
      }

      const questId = reqBody.quest_id.trim();
      const completionPct =
        typeof reqBody.completion_percentage === "number"
          ? reqBody.completion_percentage
          : 100;

      // Look up raw member data
      const rawMember = getMockMemberById(member_id);

      if (!rawMember) {
        // Safe fallback for unknown member — return empty recommendations
        const fallbackResponse: RecommendationResponse = {
          member_id,
          recommendations: [],
          generated_at: new Date().toISOString(),
          is_fallback: true,
        };
        res.status(200).json({
          event: buildQuestCompletionEvent(member_id, questId, completionPct),
          ...fallbackResponse,
        });
        return;
      }

      // Build the quest completion event (real-time)
      const completionEvent = buildQuestCompletionEvent(member_id, questId, completionPct);

      // Derive completed quest IDs from the member's quest records
      const completedQuestIds = rawMember.learning.quests
        .filter((q) => q.completed_at !== null || q.quest_id === questId)
        .map((q) => q.quest_id);

      // Add the newly completed quest if not already present
      if (!completedQuestIds.includes(questId)) {
        completedQuestIds.push(questId);
      }

      // Get next-chapter recommendations
      const recommendations = getNextChapterRecommendations(rawMember, completedQuestIds);

      res.status(200).json({
        event: completionEvent,
        ...recommendations,
      });
    }
  );

  // ── GET /members/:member_id/almost-there ────────────────────────────────────
  //    Query params: quest_id (required), completion_pct (required, 0–100)
  //    Returns an "almost there" prompt when completion_pct >= 80; else {eligible: false}
  app.get(
    "/members/:member_id/almost-there",
    async (req: Request, res: Response) => {
      const requestId = generateRequestId();

      const { member_id } = req.params;

      // Validate member_id format
      if (!/^[\w-]{1,64}$/.test(member_id)) {
        const body: ErrorResponse = {
          error: {
            code: "INVALID_MEMBER_ID",
            message: `member_id must be 1–64 alphanumeric/hyphen/underscore characters`,
            request_id: requestId,
          },
        };
        res.status(400).json(body);
        return;
      }

      // Extract required query params
      const rawQuestId =
        typeof req.query["quest_id"] === "string" ? req.query["quest_id"].trim() : null;
      const rawPct =
        typeof req.query["completion_pct"] === "string"
          ? parseFloat(req.query["completion_pct"])
          : null;

      if (!rawQuestId || rawQuestId.length === 0) {
        const errBody: ErrorResponse = {
          error: {
            code: "INVALID_REQUEST",
            message: "Query parameter quest_id is required",
            request_id: requestId,
          },
        };
        res.status(400).json(errBody);
        return;
      }

      if (rawPct === null || isNaN(rawPct)) {
        const errBody: ErrorResponse = {
          error: {
            code: "INVALID_REQUEST",
            message: "Query parameter completion_pct must be a number (0–100)",
            request_id: requestId,
          },
        };
        res.status(400).json(errBody);
        return;
      }

      // Look up member data for personalisation
      const rawMember = getMockMemberById(member_id);

      if (!rawMember) {
        res.status(200).json({ eligible: false });
        return;
      }

      const result = getAlmostTherePrompt(rawMember, rawQuestId, rawPct);
      res.status(200).json(result);
    }
  );

  // ── GET /members/:member_id/next-chapter ────────────────────────────────────
  //    Returns 3–5 recommended next quests anchored to the member's goal category.
  //    Excludes already-completed quests.
  app.get(
    "/members/:member_id/next-chapter",
    async (req: Request, res: Response) => {
      const requestId = generateRequestId();

      const { member_id } = req.params;

      // Validate member_id format
      if (!/^[\w-]{1,64}$/.test(member_id)) {
        const body: ErrorResponse = {
          error: {
            code: "INVALID_MEMBER_ID",
            message: `member_id must be 1–64 alphanumeric/hyphen/underscore characters`,
            request_id: requestId,
          },
        };
        res.status(400).json(body);
        return;
      }

      // Look up raw member data
      const rawMember = getMockMemberById(member_id);

      if (!rawMember) {
        // Safe fallback — unknown member returns intent-based stub
        const fallback: RecommendationResponse = {
          member_id,
          recommendations: [],
          generated_at: new Date().toISOString(),
          is_fallback: true,
        };
        res.status(200).json(fallback);
        return;
      }

      // Derive completed quest IDs from member quest records
      const completedQuestIds = rawMember.learning.quests
        .filter((q) => q.completed_at !== null)
        .map((q) => q.quest_id);

      const response = getNextChapterRecommendations(rawMember, completedQuestIds);
      res.status(200).json(response);
    }
  );

  // ── 404 catch-all ──────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        request_id: generateRequestId(),
      },
    });
  });

  // ── Global error handler ───────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        request_id: generateRequestId(),
      },
    });
  });

  return app;
}
