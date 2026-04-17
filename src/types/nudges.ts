/**
 * Eve Trainer — Sprint 4 Types: Nudges, Streak-Save & Reflection Prompts
 *
 * Types for:
 * - NudgeEvent: base nudge structure used for all in-app nudges
 * - StreakNudge: streak-save in-app nudge with deep-link + A/B variant
 * - ReflectionPrompt: post-lesson reflection prompt (2s after completion)
 * - DormancySignal: dormancy diagnosis output for a single member
 * - DeepLink: structured deep-link object targeting an exact lesson
 */

import type { MemberStateValue, DormancyLevel } from "./index";
import type { ABVariant } from "./prompts";

// ─── Deep Link ────────────────────────────────────────────────────────────────

/**
 * Source context for deep-link generation — tracks where the nudge originated.
 */
export type DeepLinkSource = "streak_nudge" | "reflection_prompt" | "re_entry" | "dashboard";

/**
 * Structured deep-link object for navigating to an exact lesson.
 *
 * URL format: eve://lessons/{lessonId}?member={memberId}&source={source}
 */
export interface DeepLink {
  /** Full deep-link URL */
  url: string;
  /** The lesson the deep-link targets */
  lesson_id: string;
  /** The member this link was generated for */
  member_id: string;
  /** Origin surface that generated this link (for attribution) */
  source: DeepLinkSource;
}

// ─── NudgeEvent ──────────────────────────────────────────────────────────────

/**
 * NudgeType classifies the category of in-app nudge.
 *
 * - streak_save:  nudge to prevent a streak from breaking today
 * - reflection:   post-lesson reflection prompt
 * - re_entry:     nudge to bring a dormant member back
 */
export type NudgeType = "streak_save" | "reflection" | "re_entry";

/**
 * Base NudgeEvent structure.
 *
 * All in-app nudges share this shape.  Specialised nudges (StreakNudge,
 * ReflectionPrompt) extend or embed this.
 */
export interface NudgeEvent {
  /** Stable unique identifier for this nudge instance */
  nudge_id: string;
  /** Category of nudge */
  nudge_type: NudgeType;
  /** Mindvalley member ID */
  member_id: string;
  /** Primary message shown to the member */
  message: string;
  /** Deep-link for the CTA button (may be null for reflection nudges) */
  deep_link: DeepLink | null;
  /** ISO-8601 timestamp after which this nudge should not be shown */
  expires_at: string;
  /** Whether the member can dismiss this nudge without acting */
  dismissible: boolean;
  /** A/B test variant this nudge belongs to */
  ab_variant: ABVariant;
  /** ISO-8601 creation timestamp */
  created_at: string;
}

// ─── StreakNudge ──────────────────────────────────────────────────────────────

/**
 * Streak-save nudge.
 *
 * Fired when a member has an active streak AND has not been active today AND
 * the current hour is before 20:00 (8pm) local time.
 *
 * The nudge expires at 8pm today so it doesn't fire after the streak has
 * already broken.
 */
export interface StreakNudge extends NudgeEvent {
  nudge_type: "streak_save";
  /** How many days the streak currently is (for copy personalisation) */
  streak_days: number;
  /** Lesson the deep-link targets (to give the member a specific next step) */
  suggested_lesson_id: string;
}

// ─── ReflectionPrompt ─────────────────────────────────────────────────────────

/**
 * Post-lesson reflection prompt (UC-03).
 *
 * Fires 2 seconds after lesson completion (timing is client-side).
 * Uses the member's state context to personalise the message.
 */
export interface ReflectionPrompt {
  /** Unique identifier for this reflection prompt instance */
  prompt_id: string;
  /** The member this prompt is for */
  member_id: string;
  /** The lesson just completed */
  lesson_id: string;
  /** Quest the lesson belongs to */
  quest_id: string;
  /** The reflection question shown to the member */
  text: string;
  /**
   * Driving context signal:
   * - "goal": prompt is anchored to the member's declared goal
   * - "streak": prompt references the member's streak momentum
   * - "lesson": prompt is specific to the lesson topic
   * - "re_entry": gentle re-onboarding prompt for low-momentum members
   */
  context_signal: "goal" | "streak" | "lesson" | "re_entry";
  /** Member state at time of generation (for analytics) */
  member_state: MemberStateValue;
  /** Whether the member can dismiss this prompt without answering */
  dismissible: true;
  /** A/B test variant (nudge vs control) */
  ab_variant: ABVariant;
  /** ISO-8601 creation timestamp */
  created_at: string;
}

// ─── DormancySignal ───────────────────────────────────────────────────────────

/**
 * Dormancy diagnosis output for a single member.
 *
 * Classifies the member's activity level and surfaces actionable signals
 * for the nudge and re-engagement systems.
 *
 * Dormancy levels (aligned with PulseSignalsDomain):
 *   active:  < 3 days since last activity
 *   drifting: 3–7 days since last activity
 *   at_risk: 7–30 days since last activity
 *   churned: > 30 days since last activity
 */
export interface DormancySignal {
  /** Mindvalley member ID */
  member_id: string;
  /** Computed dormancy level */
  dormancy_level: DormancyLevel;
  /** Days since the member's last platform activity */
  days_since_active: number;
  /** Whether the member has an active streak at risk of breaking today */
  streak_at_risk: boolean;
  /** Current streak days (0 if no active streak) */
  streak_days: number;
  /** Whether a streak-save nudge should be fired (streak active + not active today + before 8pm) */
  should_fire_streak_save: boolean;
  /** ISO-8601 timestamp when this signal was computed */
  diagnosed_at: string;
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

/**
 * Response shape for POST /members/:member_id/lesson-complete
 */
export interface LessonCompleteResponse {
  /** The reflection prompt for the member (null for control variant) */
  reflection_prompt: ReflectionPrompt | null;
  /** Whether this member is in the nudge treatment group */
  ab_variant: ABVariant;
  meta: {
    request_id: string;
    latency_ms: number;
    member_state: MemberStateValue | null;
    lesson_id: string;
    quest_id: string;
  };
}

/**
 * Response shape for GET /members/:member_id/streak-nudge
 *
 * When eligible is false, no nudge is returned and the reason is provided.
 */
export type StreakNudgeResponse =
  | { eligible: true; nudge: StreakNudge }
  | { eligible: false; reason: "no_active_streak" | "already_active_today" | "after_8pm" | "member_not_found" };

// ─── Sprint 5: Momentum Nudges ────────────────────────────────────────────────

/**
 * Classifies the type of day-lapse nudge to fire:
 * - day3: member has been inactive for exactly 3 days (not churned)
 * - day7: member has been inactive for 7+ days and is at_risk or dormant
 * - none: no lapse nudge should fire
 */
export type LapseNudgeType = "day3" | "day7" | "none";

/**
 * Result of detectDayLapse — describes which (if any) lapse nudge applies.
 */
export interface LapseDetection {
  /** Which nudge type fires (or 'none') */
  type: LapseNudgeType;
  /** Whole days since the member was last active */
  days_inactive: number;
}

/**
 * Result of detectStuckPoint — describes whether the member is stuck on a lesson.
 */
export interface StuckPointDetection {
  /** True when the member has been on the same lesson for 7+ days */
  stuck: boolean;
  /** How many days the member has been on the current lesson */
  days_on_lesson: number;
  /** The lesson the member is stuck on (null when not stuck) */
  lesson_id: string | null;
}

/**
 * A single coaching action surface in a CoachingCard.
 */
export interface CoachingAction {
  /** Machine-readable action identifier */
  action: "skip" | "explain" | "related";
  /** Human-readable label for the CTA button */
  label: string;
  /** Deep-link URL for the CTA */
  deep_link: string;
}

/**
 * Coaching card surfaced when a member is stuck on a lesson for 7+ days.
 *
 * Contains 3 actions:
 *   - skip:    skip this lesson and continue the quest
 *   - explain: ask Eve to break down the lesson
 *   - related: show a related lesson or quest
 */
export interface CoachingCard {
  /** Unique ID for this coaching card instance */
  card_id: string;
  /** The member this card is for */
  member_id: string;
  /** The lesson the member is stuck on */
  lesson_id: string;
  /** Human-readable heading for the card */
  heading: string;
  /** Supporting context message */
  message: string;
  /** The three coaching actions */
  actions: [CoachingAction, CoachingAction, CoachingAction];
  /** A/B test variant */
  ab_variant: ABVariant;
  /** ISO-8601 creation timestamp */
  created_at: string;
}

/**
 * Response shape for GET /members/:member_id/momentum-nudge
 */
export type MomentumNudgeResponse =
  | { eligible: true; nudge: NudgeEvent }
  | { eligible: false };

/**
 * Response shape for GET /members/:member_id/coaching-card?lesson_id=:lesson_id
 */
export type CoachingCardResponse =
  | { stuck: true; card: CoachingCard }
  | { stuck: false };
