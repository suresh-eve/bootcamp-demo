/**
 * Eve Trainer — Momentum Nudges Service (Sprint 5)
 *
 * Detects drift early and re-enters members with context-specific hooks.
 *
 * Provides:
 * 1. detectDayLapse(member)            — classifies day3 / day7 / none lapse
 * 2. detectStuckPoint(member, lesson)  — detects 7+ day stall on a single lesson
 * 3. buildLapseNudge(member, type, deepLink) — builds NudgeEvent for day3 or day7
 * 4. buildCoachingCard(member, lesson) — builds coaching card with 3 CTA actions
 *
 * Lapse rules:
 *   day3: exactly 3 days since last_active_at, member state is NOT churned
 *         (dormancy is 'drifting')
 *   day7: 7+ days since last_active_at, dormancy is 'at_risk' or 'churned'
 *
 * Stuck-point rule:
 *   stuck = true if days_on_current_lesson >= 7
 *
 * A/B experiments:
 *   eve_day3_nudge_v1   — day3 lapse nudge
 *   eve_day7_nudge_v1   — day7 lapse nudge
 *   eve_coaching_card_v1 — stuck-point coaching card
 */

import type { RawMemberData } from "../types/index";
import type { LessonMeta } from "../types/learning";
import type {
  NudgeEvent,
  LapseNudgeType,
  LapseDetection,
  StuckPointDetection,
  CoachingAction,
  CoachingCard,
} from "../types/nudges";
import type { ABVariant } from "../types/prompts";
import { generateDeepLink } from "./dormancy-diagnosis";
import { assignABVariant } from "./ab-test";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Days-inactive threshold for the day3 lapse nudge (drifting window) */
const DAY3_THRESHOLD = 3;

/** Days-inactive threshold for the day7 lapse nudge (at_risk window) */
const DAY7_THRESHOLD = 7;

/** Days-on-lesson threshold to classify a member as stuck */
const STUCK_LESSON_THRESHOLD = 7;

/** Experiment IDs */
const DAY3_EXPERIMENT_ID = "eve_day3_nudge_v1";
const DAY7_EXPERIMENT_ID = "eve_day7_nudge_v1";
const COACHING_CARD_EXPERIMENT_ID = "eve_coaching_card_v1";

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Calculate the number of whole days between now and an ISO timestamp.
 * Returns 0 if the timestamp is in the future (guard against clock skew).
 */
function daysSince(isoTimestamp: string): number {
  const ms = Date.now() - new Date(isoTimestamp).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Generate a stable nudge ID.
 * Format: "nudge_<type>_<memberId>_<epochMinute>"
 */
function generateNudgeId(type: string, memberId: string): string {
  const minute = Math.floor(Date.now() / 60_000);
  return `nudge_${type}_${memberId}_${minute}`;
}

/**
 * Generate a stable coaching card ID.
 * Format: "coaching_<memberId>_<lessonId>_<epochMinute>"
 */
function generateCardId(memberId: string, lessonId: string): string {
  const minute = Math.floor(Date.now() / 60_000);
  return `coaching_${memberId}_${lessonId}_${minute}`;
}

/**
 * Build an ISO-8601 string 48 hours from now — lapse nudges expire after 48h
 * to avoid showing stale cards if the member re-engages before viewing.
 */
function buildExpiryTimestamp(): string {
  const future = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return future.toISOString();
}

// ─── Day3 / Day7 message builders ─────────────────────────────────────────────

/**
 * Build the day3 lapse message.
 * Tone: warm, encouraging, low-friction.
 */
function buildDay3Message(member: RawMemberData): string {
  const goal = member.intent.primary_goal_category;
  const questTitle = member.learning.current_quest?.title;

  if (questTitle && goal) {
    return `Hey — it's been 3 days since your last session. Your ${goal} journey is waiting. Ready to continue "${questTitle}"?`;
  }
  if (questTitle) {
    return `It's been a few days. Your momentum is still there — jump back into "${questTitle}" where you left off.`;
  }
  if (goal) {
    return `3 days since your last visit. Your ${goal} goal is worth coming back to. What's one small step you can take today?`;
  }
  return `It's been 3 days — a small session today keeps your momentum alive. Come back and continue where you left off.`;
}

/**
 * Build the day7 lapse message.
 * Tone: stronger re-entry, mentions the gap, creates urgency around the goal.
 */
function buildDay7Message(member: RawMemberData): string {
  const goal = member.intent.primary_goal_category;
  const questTitle = member.learning.current_quest?.title;

  if (questTitle && goal) {
    return `A week away is a turning point. Your ${goal} goal and "${questTitle}" are both still here — one session is all it takes to rebuild momentum.`;
  }
  if (questTitle) {
    return `It's been 7 days. Don't let your progress on "${questTitle}" fade — come back and take the next step today.`;
  }
  if (goal) {
    return `7 days have passed. People who return after a week and take one action are 3× more likely to stay on track. Your ${goal} journey needs you back.`;
  }
  return `A week away from learning can feel like a lot. But you're one session away from getting back on track. Come back today.`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect whether a day3 or day7 lapse nudge applies to a member.
 *
 * - day3: 3 days since last_active_at AND dormancy is NOT 'churned'
 *         (i.e. dormancy === 'drifting', which is the 3–7 day band)
 * - day7: 7+ days since last_active_at AND dormancy is 'at_risk' or 'churned'
 * - none: member is active (< 3 days) or conditions are not met
 *
 * Note: a "churned" member (> 30 days) still qualifies for day7 — the nudge
 * is stronger precisely because they've been away longer.
 */
export function detectDayLapse(member: RawMemberData): LapseDetection {
  const daysInactive = daysSince(member.engagement.last_active_at);

  // day7 check first (higher priority, stronger condition)
  if (daysInactive >= DAY7_THRESHOLD) {
    return { type: "day7", days_inactive: daysInactive };
  }

  // day3 check — must be in the drifting window (3–6 days, not yet at_risk)
  // Critically, do NOT fire for churned members on the day3 nudge
  if (daysInactive >= DAY3_THRESHOLD && daysInactive < DAY7_THRESHOLD) {
    return { type: "day3", days_inactive: daysInactive };
  }

  return { type: "none", days_inactive: daysInactive };
}

/**
 * Detect whether a member is stuck on a lesson (7+ days on the same lesson).
 *
 * Uses the `days_on_current_lesson` field if present on the member data.
 * If `stuck_lesson_id` is set, that lesson is the stuck lesson.
 * Falls back to the current quest's first lesson if no explicit stuck lesson.
 *
 * @param member        - Raw member data (may include stuck_lesson_id / days_on_current_lesson)
 * @param currentLesson - The lesson to check stall against (used as fallback)
 */
export function detectStuckPoint(
  member: RawMemberData,
  currentLesson: LessonMeta
): StuckPointDetection {
  const daysOnLesson = member.days_on_current_lesson ?? 0;
  const stuckLessonId = member.stuck_lesson_id ?? currentLesson.lesson_id;

  if (daysOnLesson >= STUCK_LESSON_THRESHOLD) {
    return {
      stuck: true,
      days_on_lesson: daysOnLesson,
      lesson_id: stuckLessonId,
    };
  }

  return {
    stuck: false,
    days_on_lesson: daysOnLesson,
    lesson_id: null,
  };
}

/**
 * Build a NudgeEvent for a day3 or day7 lapse.
 *
 * - day3: warm, encouraging tone; dismissible; expires 48h
 * - day7: stronger tone, urgency framing; dismissible; expires 48h
 * - Includes a deep-link to the member's current lesson (re-entry source)
 * - A/B tested: separate experiments for day3 and day7
 *
 * @param member   - Raw member data
 * @param type     - "day3" or "day7"
 * @param deepLink - Structured deep-link to the lesson (use generateDeepLink first)
 */
export function buildLapseNudge(
  member: RawMemberData,
  type: Exclude<LapseNudgeType, "none">,
  deepLink: ReturnType<typeof generateDeepLink>
): NudgeEvent {
  const experimentId = type === "day3" ? DAY3_EXPERIMENT_ID : DAY7_EXPERIMENT_ID;
  const abAssignment = assignABVariant(member.member_id, experimentId);
  const message = type === "day3" ? buildDay3Message(member) : buildDay7Message(member);
  const now = new Date().toISOString();

  return {
    nudge_id: generateNudgeId(type, member.member_id),
    nudge_type: "re_entry",
    member_id: member.member_id,
    message,
    deep_link: deepLink,
    expires_at: buildExpiryTimestamp(),
    dismissible: true,
    ab_variant: abAssignment.variant,
    created_at: now,
  };
}

/**
 * Build a CoachingCard for a member stuck on a lesson.
 *
 * Returns a card with exactly 3 actions:
 *   - skip:    skip this lesson and move on
 *   - explain: ask Eve to break down the lesson content
 *   - related: show a related lesson or quest
 *
 * Each action includes a deep-link URL targeting the lesson.
 * A/B tested under the `eve_coaching_card_v1` experiment.
 *
 * @param member  - Raw member data (must have stuck_lesson_id / days_on_current_lesson set)
 * @param lesson  - The lesson the member is stuck on
 */
export function buildCoachingCard(member: RawMemberData, lesson: LessonMeta): CoachingCard {
  const abAssignment = assignABVariant(member.member_id, COACHING_CARD_EXPERIMENT_ID);
  const now = new Date().toISOString();

  const stuckDays = member.days_on_current_lesson ?? STUCK_LESSON_THRESHOLD;

  const heading =
    stuckDays >= 14
      ? `You've been here a while — need a hand with "${lesson.title}"?`
      : `Feeling stuck on "${lesson.title}"? Here's what you can do.`;

  const message =
    stuckDays >= 14
      ? `You've been on this lesson for ${stuckDays} days. That's okay — some lessons need time. Choose how you'd like to move forward.`
      : `It looks like you've been on "${lesson.title}" for ${stuckDays} days. Sometimes a lesson needs a different angle. What would help?`;

  // Build deep-link URLs for each action
  const skipDeepLink = `eve://lessons/${lesson.lesson_id}?member=${member.member_id}&source=coaching_skip&action=skip`;
  const explainDeepLink = `eve://lessons/${lesson.lesson_id}?member=${member.member_id}&source=coaching_explain&action=explain`;
  const relatedDeepLink = `eve://quests/${lesson.quest_id}?member=${member.member_id}&source=coaching_related&action=related`;

  const actions: [CoachingAction, CoachingAction, CoachingAction] = [
    {
      action: "skip",
      label: "Skip this lesson",
      deep_link: skipDeepLink,
    },
    {
      action: "explain",
      label: "Break it down for me",
      deep_link: explainDeepLink,
    },
    {
      action: "related",
      label: "Show me something related",
      deep_link: relatedDeepLink,
    },
  ];

  return {
    card_id: generateCardId(member.member_id, lesson.lesson_id),
    member_id: member.member_id,
    lesson_id: lesson.lesson_id,
    heading,
    message,
    actions,
    ab_variant: abAssignment.variant,
    created_at: now,
  };
}
