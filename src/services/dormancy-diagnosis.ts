/**
 * Eve Trainer — Dormancy Diagnosis Service (Sprint 4)
 *
 * Provides:
 * 1. diagnoseDormancy(member) — classifies a member's dormancy level
 * 2. shouldFireStreakSave(member, currentHour) — streak-save eligibility check
 * 3. generateDeepLink(memberId, lessonId, source) — structured deep-link URL
 *
 * Dormancy thresholds (days since last activity):
 *   active:   < 3 days
 *   drifting: 3–7 days
 *   at_risk:  7–30 days
 *   churned:  > 30 days
 *
 * Streak-save rule: fires when ALL of the following are true:
 *   1. Member has an active streak (streak_days > 0)
 *   2. Member has NOT been active today (last_active_at was >= 1 day ago)
 *   3. Current hour is before 20:00 (8pm) — there is still time to save the streak
 */

import type { RawMemberData, DormancyLevel } from "../types/index";
import type { DormancySignal, DeepLink, DeepLinkSource } from "../types/nudges";

// ─── Dormancy Thresholds ──────────────────────────────────────────────────────

/** Days-since-active boundaries for each dormancy level */
const DORMANCY_THRESHOLDS = {
  /** < ACTIVE days → "active" */
  ACTIVE: 3,
  /** ACTIVE ≤ days < DRIFTING → "drifting" */
  DRIFTING: 7,
  /** DRIFTING ≤ days < AT_RISK → "at_risk" */
  AT_RISK: 30,
  /** ≥ AT_RISK days → "churned" */
} as const;

/** Hour (0–23) at or after which the streak-save nudge should NOT fire */
const STREAK_SAVE_CUTOFF_HOUR = 20; // 8pm

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate the number of whole days between now and an ISO timestamp.
 * Returns 0 if the timestamp is in the future (guard against clock skew).
 */
function daysSince(isoTimestamp: string): number {
  const ms = Date.now() - new Date(isoTimestamp).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Classify a days-since-active value into the four dormancy levels.
 */
function classifyDormancy(daysSinceActive: number): DormancyLevel {
  if (daysSinceActive < DORMANCY_THRESHOLDS.ACTIVE) return "active";
  if (daysSinceActive < DORMANCY_THRESHOLDS.DRIFTING) return "drifting";
  if (daysSinceActive < DORMANCY_THRESHOLDS.AT_RISK) return "at_risk";
  return "churned";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Diagnose the dormancy level for a single member.
 *
 * @param member - Raw member data from the data adapter
 * @returns DormancySignal with dormancy level, streak risk, and firing recommendation
 */
export function diagnoseDormancy(member: RawMemberData): DormancySignal {
  const daysSinceActive = daysSince(member.engagement.last_active_at);
  const dormancyLevel = classifyDormancy(daysSinceActive);

  const hasActiveStreak = member.engagement.streak_days > 0;
  // "At risk" = streak is active but the member hasn't been active today
  const streakAtRisk = hasActiveStreak && daysSinceActive >= 1;

  // Streak-save should fire before 8pm local server time
  const currentHour = new Date().getHours();
  const shouldFireStreakSave =
    hasActiveStreak && daysSinceActive >= 1 && currentHour < STREAK_SAVE_CUTOFF_HOUR;

  return {
    member_id: member.member_id,
    dormancy_level: dormancyLevel,
    days_since_active: daysSinceActive,
    streak_at_risk: streakAtRisk,
    streak_days: member.engagement.streak_days,
    should_fire_streak_save: shouldFireStreakSave,
    diagnosed_at: new Date().toISOString(),
  };
}

/**
 * Check whether a streak-save nudge should be fired for a member.
 *
 * Returns true when ALL conditions are met:
 *   1. Member has an active streak (streak_days > 0)
 *   2. Member hasn't been active today (days since last activity >= 1)
 *   3. Current hour is before the 8pm cutoff
 *
 * @param member      - Raw member data
 * @param currentHour - Current hour in 0–23 format (injected for testability)
 * @returns boolean
 */
export function shouldFireStreakSave(member: RawMemberData, currentHour: number): boolean {
  const hasActiveStreak = member.engagement.streak_days > 0;
  const daysSinceActive = daysSince(member.engagement.last_active_at);
  const notActiveToday = daysSinceActive >= 1;
  const beforeCutoff = currentHour < STREAK_SAVE_CUTOFF_HOUR;

  return hasActiveStreak && notActiveToday && beforeCutoff;
}

/**
 * Generate a structured deep-link to an exact lesson for a specific member.
 *
 * URL format: eve://lessons/{lessonId}?member={memberId}&source={source}
 *
 * @param memberId  - Mindvalley member ID
 * @param lessonId  - Target lesson ID
 * @param source    - Origin surface generating the link
 * @returns DeepLink object
 */
export function generateDeepLink(
  memberId: string,
  lessonId: string,
  source: DeepLinkSource
): DeepLink {
  const url = `eve://lessons/${lessonId}?member=${memberId}&source=${source}`;

  return {
    url,
    lesson_id: lessonId,
    member_id: memberId,
    source,
  };
}
