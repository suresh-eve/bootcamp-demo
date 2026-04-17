/**
 * LearnerProfileService — builds and classifies LearnerProfiles (C1 Lite).
 *
 * This service:
 * 1. Fetches raw member data via the DataAdapter (B1 workaround)
 * 2. Computes pulse signals (dormancy, momentum score)
 * 3. Runs the Intent Confidence Score algorithm v1
 * 4. Classifies the member into State 1–4
 * 5. Returns a complete LearnerProfile
 */

import type { DataAdapter } from "../data/adapters/DataAdapter.interface";
import type {
  LearnerProfile,
  RawMemberData,
  PulseSignalsDomain,
  MemberStateDomain,
  MemberStateValue,
  IntentSignals,
  DormancyLevel,
  AlgorithmTestResult,
  BatchTestSummary,
} from "../types/index";
import { MEMBER_STATE_LABELS } from "../types/index";
import { calculateIntentConfidence } from "./intent-confidence";

// ─── Momentum Score Weights ───────────────────────────────────────────────────

const MOMENTUM_WEIGHTS = {
  STREAK: 0.40,
  LESSONS_30D: 0.35,
  SESSION_FREQUENCY: 0.25,
} as const;

/** Streak saturates at 30 days for momentum purposes */
const STREAK_SATURATION = 30;
/** Lessons per month saturates at 20 */
const LESSONS_SATURATION = 20;
/** Sessions per week saturates at 7 */
const SESSION_SATURATION = 7;

/** Score threshold above which momentum is classified as "high" */
const HIGH_MOMENTUM_THRESHOLD = 0.4;

// ─── Dormancy Thresholds (days inactive) ─────────────────────────────────────

const DORMANCY_THRESHOLDS = {
  ACTIVE: 3,
  DRIFTING: 7,
  AT_RISK: 30,
  // > 30 days → churned
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(isoTimestamp: string): number {
  const ms = Date.now() - new Date(isoTimestamp).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function saturate(value: number, max: number): number {
  return Math.min(value / max, 1.0);
}

// ─── Pulse Signal Computation ─────────────────────────────────────────────────

function computePulseSignals(member: RawMemberData): PulseSignalsDomain {
  const daysSinceActive = daysSince(member.engagement.last_active_at);

  let dormancy: DormancyLevel;
  if (daysSinceActive < DORMANCY_THRESHOLDS.ACTIVE) {
    dormancy = "active";
  } else if (daysSinceActive < DORMANCY_THRESHOLDS.DRIFTING) {
    dormancy = "drifting";
  } else if (daysSinceActive < DORMANCY_THRESHOLDS.AT_RISK) {
    dormancy = "at_risk";
  } else {
    dormancy = "churned";
  }

  // Momentum score: weighted blend of streak, lessons, and session frequency
  const momentumScore =
    saturate(member.engagement.streak_days, STREAK_SATURATION) * MOMENTUM_WEIGHTS.STREAK +
    saturate(member.learning.lessons_completed_30d, LESSONS_SATURATION) * MOMENTUM_WEIGHTS.LESSONS_30D +
    saturate(member.engagement.session_frequency_weekly, SESSION_SATURATION) * MOMENTUM_WEIGHTS.SESSION_FREQUENCY;

  // Streak break risk: if last_active is yesterday, the streak breaks today if they don't act
  const streakBreakRisk = member.engagement.streak_days > 0 && daysSinceActive >= 1;

  return {
    dormancy_diagnosis: dormancy,
    momentum_score: parseFloat(momentumScore.toFixed(4)),
    days_since_last_active: daysSinceActive,
    streak_break_risk: streakBreakRisk,
    days_inactive_streak: daysSinceActive,
  };
}

// ─── State Classification ─────────────────────────────────────────────────────

/**
 * Classify member into State 1–4 based on intent and momentum levels.
 *
 * State 1: High intent + High momentum
 * State 2: High intent + Low momentum
 * State 3: Low intent  + High momentum
 * State 4: Low intent  + Low momentum
 */
function classifyMemberState(
  intentLevel: "high" | "low",
  momentumScore: number,
  intentConfidenceScore: number,
  usedFallback: boolean
): MemberStateDomain {
  const highMomentum = momentumScore >= HIGH_MOMENTUM_THRESHOLD;

  let state: MemberStateValue;
  if (intentLevel === "high" && highMomentum) {
    state = 1;
  } else if (intentLevel === "high" && !highMomentum) {
    state = 2;
  } else if (intentLevel === "low" && highMomentum) {
    state = 3;
  } else {
    state = 4;
  }

  // Confidence score for the state classification is a blend of the intent
  // confidence and momentum certainty. When fallback is active, we reduce
  // confidence further.
  const momentumCertainty = highMomentum
    ? Math.abs(momentumScore - HIGH_MOMENTUM_THRESHOLD) / (1 - HIGH_MOMENTUM_THRESHOLD)
    : Math.abs(HIGH_MOMENTUM_THRESHOLD - momentumScore) / HIGH_MOMENTUM_THRESHOLD;

  let confidenceScore = (intentConfidenceScore + momentumCertainty) / 2;
  if (usedFallback) {
    confidenceScore *= 0.7; // Penalise for sparse signals
  }
  confidenceScore = parseFloat(Math.min(confidenceScore, 1.0).toFixed(4));

  return {
    state,
    label: MEMBER_STATE_LABELS[state].label,
    confidence_score: confidenceScore,
    used_fallback: usedFallback,
    computed_at: new Date().toISOString(),
  };
}

// ─── LearnerProfileService ────────────────────────────────────────────────────

export class LearnerProfileService {
  private readonly adapter: DataAdapter;

  constructor(adapter: DataAdapter) {
    this.adapter = adapter;
  }

  /**
   * Build a complete LearnerProfile for a single member.
   * Returns null if the member is not found.
   */
  async buildProfile(memberId: string): Promise<LearnerProfile | null> {
    const raw = await this.adapter.getMemberData(memberId);
    if (!raw) return null;

    return this.buildProfileFromRaw(raw);
  }

  /**
   * Build LearnerProfiles for a batch of members.
   * Members not found in the adapter are omitted from the result.
   */
  async buildBatchProfiles(memberIds: string[]): Promise<Map<string, LearnerProfile>> {
    const rawMap = await this.adapter.getBatchMemberData(memberIds);
    const result = new Map<string, LearnerProfile>();

    for (const [id, raw] of rawMap.entries()) {
      result.set(id, this.buildProfileFromRaw(raw));
    }

    return result;
  }

  /**
   * Build a LearnerProfile from pre-fetched RawMemberData.
   * Pure computation — no async I/O.
   */
  buildProfileFromRaw(raw: RawMemberData): LearnerProfile {
    const pulseSignals = computePulseSignals(raw);

    // Prepare intent signals for the confidence algorithm
    const hasGoal = raw.intent.goal_declarations.length > 0;
    const goalAgeDays = hasGoal
      ? daysSince(raw.intent.goal_declarations[0].declared_at)
      : 999;

    const intentSignals: IntentSignals = {
      has_goal_declaration: hasGoal,
      goal_declaration_age_days: goalAgeDays,
      eve_conversation_frequency_30d: raw.intent.eve_conversation_frequency_30d,
      prompt_ctr: raw.intent.prompt_ctr,
      lessons_completed_30d: raw.learning.lessons_completed_30d,
      session_frequency_weekly: raw.engagement.session_frequency_weekly,
    };

    const intentResult = calculateIntentConfidence(intentSignals);
    const memberState = classifyMemberState(
      intentResult.intent_level,
      pulseSignals.momentum_score,
      intentResult.score,
      intentResult.used_fallback
    );

    return {
      member_id: raw.member_id,
      schema_version: "1.0",
      profile_built_at: new Date().toISOString(),
      data_freshness: this.adapter.dataFreshness,

      intent: {
        ...raw.intent,
        ftu_goal_from_mock: this.adapter.adapterName === "MockDataAdapter",
      },
      engagement: raw.engagement,
      learning: raw.learning,
      pulse_signals: pulseSignals,
      member_state: memberState,
    };
  }

  // ─── Batch Test Runner ──────────────────────────────────────────────────────

  /**
   * Run the intent confidence and state classification algorithms on all
   * available members and return per-member results plus summary statistics.
   *
   * Used for Sprint 0 acceptance criterion:
   * "Intent confidence score algorithm v1 tested on 100 members"
   */
  async runBatchTest(memberIds: string[]): Promise<{
    results: AlgorithmTestResult[];
    summary: BatchTestSummary;
  }> {
    const rawMap = await this.adapter.getBatchMemberData(memberIds);
    const results: AlgorithmTestResult[] = [];

    for (const [id, raw] of rawMap.entries()) {
      const profile = this.buildProfileFromRaw(raw);

      const intentSignals: IntentSignals = {
        has_goal_declaration: raw.intent.goal_declarations.length > 0,
        goal_declaration_age_days: raw.intent.goal_declarations.length > 0
          ? daysSince(raw.intent.goal_declarations[0].declared_at)
          : 999,
        eve_conversation_frequency_30d: raw.intent.eve_conversation_frequency_30d,
        prompt_ctr: raw.intent.prompt_ctr,
        lessons_completed_30d: raw.learning.lessons_completed_30d,
        session_frequency_weekly: raw.engagement.session_frequency_weekly,
      };

      const intentConfidence = calculateIntentConfidence(intentSignals);

      results.push({
        member_id: id,
        intent_confidence: intentConfidence,
        momentum_score: profile.pulse_signals.momentum_score,
        member_state: profile.member_state.state,
        state_label: profile.member_state.label,
        confidence_score: profile.member_state.confidence_score,
      });
    }

    // Compute summary statistics
    const stateDistribution: Record<MemberStateValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let totalIntentConfidence = 0;
    let totalMomentum = 0;
    let totalStateConfidence = 0;
    let fallbackCount = 0;
    let highIntentCount = 0;

    for (const r of results) {
      stateDistribution[r.member_state]++;
      totalIntentConfidence += r.intent_confidence.score;
      totalMomentum += r.momentum_score;
      totalStateConfidence += r.confidence_score;
      if (r.intent_confidence.used_fallback) fallbackCount++;
      if (r.intent_confidence.intent_level === "high") highIntentCount++;
    }

    const n = results.length;
    const summary: BatchTestSummary = {
      total_members: n,
      state_distribution: stateDistribution,
      avg_intent_confidence: parseFloat((totalIntentConfidence / n).toFixed(4)),
      avg_momentum_score: parseFloat((totalMomentum / n).toFixed(4)),
      avg_state_confidence: parseFloat((totalStateConfidence / n).toFixed(4)),
      fallback_count: fallbackCount,
      high_intent_count: highIntentCount,
      low_intent_count: n - highIntentCount,
    };

    return { results, summary };
  }
}
