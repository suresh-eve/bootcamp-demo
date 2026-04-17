/**
 * Intent Confidence Score Algorithm v1
 *
 * Calculates a 0.0–1.0 score representing how confidently we can classify
 * a member's intent as "high" or "low". This score feeds directly into the
 * member state classifier (State 1–4).
 *
 * Algorithm Design Decisions:
 * - Five weighted signal categories (total weight = 1.0)
 * - Goal declaration presence is the strongest single signal (30%)
 * - Recency of goal declaration decays over 90 days
 * - Eve engagement (frequency + prompt CTR) collectively = 35%
 * - Learning activity (lessons/30d) = 15%
 * - Fallback rule: if signal_count < 3, score is capped at 0.5 and
 *   used_fallback is set true, per Sprint 1 spec
 *
 * Threshold: score >= 0.5 → "high" intent; score < 0.5 → "low" intent
 */

import type {
  IntentSignals,
  IntentConfidenceResult,
  LearnerProfile,
} from "../types/index";

// ─── Weight Constants ─────────────────────────────────────────────────────────

const WEIGHTS = {
  /** Whether any goal has been declared */
  GOAL_DECLARATION: 0.30,
  /** How recently the goal was declared (decays over 90 days) */
  GOAL_RECENCY: 0.20,
  /** Eve conversation frequency over last 30 days (saturates at 10 conversations) */
  EVE_ENGAGEMENT: 0.20,
  /** Prompt click-through rate (raw 0.0–1.0) */
  PROMPT_CTR: 0.15,
  /** Lessons completed in last 30 days (saturates at 20 lessons) */
  LEARNING_ACTIVITY: 0.15,
} as const;

/** Total must equal 1.0 */
const WEIGHT_TOTAL =
  WEIGHTS.GOAL_DECLARATION +
  WEIGHTS.GOAL_RECENCY +
  WEIGHTS.EVE_ENGAGEMENT +
  WEIGHTS.PROMPT_CTR +
  WEIGHTS.LEARNING_ACTIVITY;

// Compile-time assertion that weights sum to 1.0
const _WEIGHT_CHECK: 1.0 = WEIGHT_TOTAL as 1.0;
void _WEIGHT_CHECK;

/** Threshold above which intent is classified as "high" */
const HIGH_INTENT_THRESHOLD = 0.5;

/** Minimum signal count before fallback rule is applied */
const MIN_SIGNALS_FOR_FULL_SCORE = 3;

/** Fallback score cap when signal_count < MIN_SIGNALS_FOR_FULL_SCORE */
const FALLBACK_SCORE_CAP = 0.5;

// ─── Helper: linear saturation ────────────────────────────────────────────────

/**
 * Maps a raw numeric value to [0, 1] by saturating at `max`.
 * Values at or above `max` return 1.0.
 */
function saturate(value: number, max: number): number {
  return Math.min(value / max, 1.0);
}

/**
 * Exponential decay function. Returns 1.0 when ageDays === 0 and approaches
 * 0.0 as ageDays → halfLifeDays * ~6.
 * Half-life: value = 0.5 at ageDays === halfLifeDays.
 */
function decay(ageDays: number, halfLifeDays: number): number {
  return Math.pow(0.5, ageDays / halfLifeDays);
}

// ─── Signal Count ─────────────────────────────────────────────────────────────

/**
 * Count how many signals are meaningfully present (non-zero / non-trivial).
 * Used by the fallback rule.
 */
function countSignals(signals: IntentSignals): number {
  let count = 0;
  if (signals.has_goal_declaration) count++;
  if (signals.eve_conversation_frequency_30d > 0) count++;
  if (signals.prompt_ctr > 0) count++;
  if (signals.lessons_completed_30d > 0) count++;
  if (signals.session_frequency_weekly > 0) count++;
  return count;
}

// ─── Core Algorithm ───────────────────────────────────────────────────────────

/**
 * Calculate the Intent Confidence Score from raw signals.
 *
 * @param signals - Raw member signals
 * @returns IntentConfidenceResult with score, intent level, and per-weight breakdown
 */
export function calculateIntentConfidence(signals: IntentSignals): IntentConfidenceResult {
  // 1. Goal declaration: binary presence
  const goalDeclarationWeight = signals.has_goal_declaration
    ? WEIGHTS.GOAL_DECLARATION
    : 0;

  // 2. Goal recency: decay over 90-day half-life
  //    If no goal declaration, recency contribution is 0
  const rawRecency = signals.has_goal_declaration
    ? decay(signals.goal_declaration_age_days, 90)
    : 0;
  const recencyWeight = rawRecency * WEIGHTS.GOAL_RECENCY;

  // 3. Eve engagement: conversation frequency saturates at 10 conversations/30d
  const rawEveEngagement = saturate(signals.eve_conversation_frequency_30d, 10);
  const eveEngagementWeight = rawEveEngagement * WEIGHTS.EVE_ENGAGEMENT;

  // 4. Prompt CTR: raw 0.0–1.0 value (already normalised)
  //    Clamp to [0, 1] to guard against bad data
  const rawCtr = Math.min(Math.max(signals.prompt_ctr, 0), 1);
  const promptCtrWeight = rawCtr * WEIGHTS.PROMPT_CTR;

  // 5. Learning activity: lessons completed in last 30 days, saturates at 20
  const rawLearning = saturate(signals.lessons_completed_30d, 20);
  const learningActivityWeight = rawLearning * WEIGHTS.LEARNING_ACTIVITY;

  // Raw weighted score
  let score =
    goalDeclarationWeight +
    recencyWeight +
    eveEngagementWeight +
    promptCtrWeight +
    learningActivityWeight;

  // Clamp to [0, 1] for floating-point safety
  score = Math.min(Math.max(score, 0), 1);

  // Fallback rule: if fewer than 3 signals are present, cap at 0.5
  const signalCount = countSignals(signals);
  const usedFallback = signalCount < MIN_SIGNALS_FOR_FULL_SCORE;
  if (usedFallback) {
    score = Math.min(score, FALLBACK_SCORE_CAP);
  }

  const intentLevel: "high" | "low" = score >= HIGH_INTENT_THRESHOLD ? "high" : "low";

  return {
    score: parseFloat(score.toFixed(4)),
    intent_level: intentLevel,
    signal_count: signalCount,
    used_fallback: usedFallback,
    breakdown: {
      goal_declaration_weight: parseFloat(goalDeclarationWeight.toFixed(4)),
      recency_weight: parseFloat(recencyWeight.toFixed(4)),
      eve_engagement_weight: parseFloat(eveEngagementWeight.toFixed(4)),
      prompt_ctr_weight: parseFloat(promptCtrWeight.toFixed(4)),
      learning_activity_weight: parseFloat(learningActivityWeight.toFixed(4)),
    },
  };
}

// ─── Profile-level Convenience Wrapper ───────────────────────────────────────

/**
 * Extract IntentSignals from a LearnerProfile and run the algorithm.
 * Convenience function for use in LearnerProfileService.
 */
export function calculateIntentConfidenceFromProfile(
  profile: Pick<LearnerProfile, "intent" | "learning">
): IntentConfidenceResult {
  const { intent, learning } = profile;

  const hasGoal = intent.goal_declarations.length > 0;
  const goalAgeDays = hasGoal
    ? Math.max(
        0,
        Math.round(
          (Date.now() -
            new Date(intent.goal_declarations[0].declared_at).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 999; // No declaration → treat as very old

  const signals: IntentSignals = {
    has_goal_declaration: hasGoal,
    goal_declaration_age_days: goalAgeDays,
    eve_conversation_frequency_30d: intent.eve_conversation_frequency_30d,
    prompt_ctr: intent.prompt_ctr,
    lessons_completed_30d: learning.lessons_completed_30d,
    session_frequency_weekly: 0, // Not on LearnerProfile directly; must be injected separately
  };

  return calculateIntentConfidence(signals);
}

// ─── Algorithm Metadata ───────────────────────────────────────────────────────

export const ALGORITHM_METADATA = {
  version: "1.0",
  weights: WEIGHTS,
  high_intent_threshold: HIGH_INTENT_THRESHOLD,
  fallback_score_cap: FALLBACK_SCORE_CAP,
  min_signals_for_full_score: MIN_SIGNALS_FOR_FULL_SCORE,
} as const;
