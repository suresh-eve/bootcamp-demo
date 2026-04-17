/**
 * Eve Trainer — Streak Nudge Service (Sprint 4)
 *
 * Provides:
 * 1. buildStreakSaveNudge(member, lesson) — builds a NudgeEvent for streak-save
 * 2. buildReflectionPrompt(member, lesson) — builds a post-lesson reflection prompt
 *
 * Design decisions:
 * - All nudges are dismissible: true (Decision D1)
 * - A/B assignment uses a deterministic DJB2 hash keyed on the
 *   "eve_streak_nudge_v1" experiment ID — separate from the prompts experiment
 * - Reflection prompts use member state context to personalise the question
 * - Streak-save nudge expires at 8pm today (ISO-8601 with local date)
 */

import type { RawMemberData } from "../types/index";
import type { LessonMeta } from "../types/learning";
import type {
  StreakNudge,
  ReflectionPrompt,
  NudgeEvent,
} from "../types/nudges";
import type { ABVariant } from "../types/prompts";
import { generateDeepLink } from "./dormancy-diagnosis";
import { assignABVariant } from "./ab-test";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Experiment ID for the streak-save nudge A/B test */
const STREAK_NUDGE_EXPERIMENT_ID = "eve_streak_nudge_v1";

/** Experiment ID for the reflection prompt A/B test */
const REFLECTION_EXPERIMENT_ID = "eve_reflection_v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build an ISO-8601 string for 8pm today in local server time.
 *
 * Used as the expiry timestamp for streak-save nudges — the nudge should
 * not surface after the streak has already broken (which happens at midnight,
 * but we cut off nudging at 8pm to give the member time to act).
 */
function build8pmToday(): string {
  const now = new Date();
  now.setHours(20, 0, 0, 0);
  return now.toISOString();
}

/**
 * Generate a stable nudge ID.
 * Format: "nudge_<type>_<memberId>_<epochMinute>"
 * Using minute-level granularity so the same nudge is not re-generated within a minute.
 */
function generateNudgeId(type: string, memberId: string): string {
  const minute = Math.floor(Date.now() / 60_000);
  return `nudge_${type}_${memberId}_${minute}`;
}

/**
 * Generate a stable reflection prompt ID.
 * Format: "reflect_<memberId>_<lessonId>_<epochMinute>"
 */
function generateReflectionId(memberId: string, lessonId: string): string {
  const minute = Math.floor(Date.now() / 60_000);
  return `reflect_${memberId}_${lessonId}_${minute}`;
}

// ─── Streak-save message builder ──────────────────────────────────────────────

/**
 * Build the streak-save nudge message personalised to the member's streak length.
 *
 * Shorter streaks get an encouraging "keep going" message.
 * Longer streaks (7+ days) get a "protect your momentum" framing.
 */
function buildStreakMessage(streakDays: number, lessonTitle: string): string {
  if (streakDays >= 14) {
    return `Your ${streakDays}-day streak is at risk — don't break your momentum! Complete "${lessonTitle}" today to keep it alive.`;
  }
  if (streakDays >= 7) {
    return `You're on a ${streakDays}-day streak — protect it! Jump back in with "${lessonTitle}" before midnight.`;
  }
  if (streakDays >= 3) {
    return `${streakDays} days strong — don't stop now! Pick up "${lessonTitle}" to keep your streak going.`;
  }
  return `You have an active streak — keep it alive today with "${lessonTitle}".`;
}

// ─── Reflection prompt message builder ───────────────────────────────────────

type MemberStateTuple = { state: number; streak_days: number; primary_goal: string | null };

/**
 * Build the reflection prompt text using the member's state and lesson context.
 *
 * State-driven personalisation:
 *   State 1 (high intent / high momentum): deep reflective question
 *   State 2 (high intent / low momentum):  re-engage with their declared goal
 *   State 3 (low intent  / high momentum): connect activity to goal value
 *   State 4 (low intent  / low momentum):  gentle, low-friction question
 */
function buildReflectionText(
  stateTuple: MemberStateTuple,
  lesson: LessonMeta
): { text: string; context_signal: ReflectionPrompt["context_signal"] } {
  const { state, streak_days, primary_goal } = stateTuple;
  const goalPhrase = primary_goal ? `your ${primary_goal} journey` : "your goals";

  switch (state) {
    case 1:
      // High intent + High momentum — go deep
      return {
        text: `What's one insight from "${lesson.title}" that you can apply to ${goalPhrase} this week?`,
        context_signal: "goal",
      };

    case 2:
      // High intent + Low momentum — reconnect with their "why"
      return {
        text: `"${lesson.title}" is done — what does this mean for ${goalPhrase}? Even a small action today counts.`,
        context_signal: "goal",
      };

    case 3:
      // Low intent + High momentum — surface goal value from lesson
      if (streak_days >= 3) {
        return {
          text: `You've been on a ${streak_days}-day streak! How does "${lesson.title}" connect to where you want to go?`,
          context_signal: "streak",
        };
      }
      return {
        text: `Great job completing "${lesson.title}"! How does this lesson connect to ${goalPhrase}?`,
        context_signal: "lesson",
      };

    case 4:
    default:
      // Low intent + Low momentum — keep it gentle and low-friction
      return {
        text: `You just finished "${lesson.title}". What's one word that describes how you feel right now?`,
        context_signal: "re_entry",
      };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a streak-save NudgeEvent for a member.
 *
 * The nudge:
 * - Is always dismissible (Decision D1)
 * - Expires at 8pm today
 * - Includes a deep-link to the suggested lesson
 * - Is A/B tested (treatment receives the nudge; control receives nothing)
 *
 * @param member  - Raw member data
 * @param lesson  - The lesson to deep-link to (suggested next step)
 * @returns StreakNudge
 */
export function buildStreakSaveNudge(member: RawMemberData, lesson: LessonMeta): StreakNudge {
  const abAssignment = assignABVariant(member.member_id, STREAK_NUDGE_EXPERIMENT_ID);
  const deepLink = generateDeepLink(member.member_id, lesson.lesson_id, "streak_nudge");
  const message = buildStreakMessage(member.engagement.streak_days, lesson.title);
  const now = new Date().toISOString();

  const nudge: StreakNudge = {
    nudge_id: generateNudgeId("streak", member.member_id),
    nudge_type: "streak_save",
    member_id: member.member_id,
    message,
    deep_link: deepLink,
    expires_at: build8pmToday(),
    dismissible: true,
    ab_variant: abAssignment.variant,
    created_at: now,
    streak_days: member.engagement.streak_days,
    suggested_lesson_id: lesson.lesson_id,
  };

  return nudge;
}

/**
 * Build a post-lesson reflection prompt for a member.
 *
 * The prompt:
 * - Should be shown 2 seconds after lesson completion (timing is client-side)
 * - Is personalised using member state context (State 1–4)
 * - Is always dismissible (Decision D1)
 * - Is A/B tested (treatment receives the prompt; control receives null)
 *
 * @param member  - Raw member data
 * @param lesson  - The lesson just completed
 * @returns ReflectionPrompt
 */
export function buildReflectionPrompt(
  member: RawMemberData,
  lesson: LessonMeta
): ReflectionPrompt {
  // Build a temporary profile-like state for personalisation
  // We use the LearnerProfileService pattern inline to avoid circular deps:
  // compute a rough state from raw engagement data for text personalisation.
  const daysSinceActive = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(member.engagement.last_active_at).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  // Determine rough member state using the same quadrant logic as LearnerProfileService
  // (simplified for nudge context — avoids importing the full service)
  const hasGoal = member.intent.goal_declarations.length > 0;
  const hasEngagement =
    member.intent.eve_conversation_frequency_30d > 0 ||
    member.intent.prompt_ctr > 0.1;
  const highIntent = hasGoal && (hasEngagement || member.intent.prompt_ctr > 0.3);
  const highMomentum =
    member.engagement.streak_days >= 3 ||
    member.learning.lessons_completed_30d >= 3 ||
    member.engagement.session_frequency_weekly >= 2;

  let roughState: 1 | 2 | 3 | 4;
  if (highIntent && highMomentum) roughState = 1;
  else if (highIntent && !highMomentum) roughState = 2;
  else if (!highIntent && highMomentum) roughState = 3;
  else roughState = 4;

  const stateTuple: MemberStateTuple = {
    state: roughState,
    streak_days: member.engagement.streak_days,
    primary_goal: member.intent.primary_goal_category,
  };

  const { text, context_signal } = buildReflectionText(stateTuple, lesson);

  const abAssignment = assignABVariant(member.member_id, REFLECTION_EXPERIMENT_ID);
  const now = new Date().toISOString();

  return {
    prompt_id: generateReflectionId(member.member_id, lesson.lesson_id),
    member_id: member.member_id,
    lesson_id: lesson.lesson_id,
    quest_id: lesson.quest_id,
    text,
    context_signal,
    member_state: roughState,
    dismissible: true,
    ab_variant: abAssignment.variant,
    created_at: now,
  };
}
