/**
 * Eve Trainer — C1 Lite Schema
 * All TypeScript interfaces and types for the Learner Profile system.
 *
 * Decision: MemberState uses numeric 1–4 classification as specified in PRD.
 * Decision: All monetary/score values are floats 0.0–1.0 unless noted.
 * Decision: Timestamps are ISO-8601 strings to remain JSON-serialisable.
 */

// ─── Member State Classification ─────────────────────────────────────────────

/** The four learner states derived from intent × momentum quadrant */
export type MemberStateValue = 1 | 2 | 3 | 4;

/**
 * State 1: High intent + High momentum  → nurture & deepen
 * State 2: High intent + Low momentum   → re-activate, low friction
 * State 3: Low intent  + High momentum  → surface goal value
 * State 4: Low intent  + Low momentum   → re-onboard or churn risk
 */
export interface MemberStateLabel {
  state: MemberStateValue;
  label: string;
  description: string;
}

export const MEMBER_STATE_LABELS: Record<MemberStateValue, MemberStateLabel> = {
  1: {
    state: 1,
    label: "High Intent / High Momentum",
    description: "Nurture and deepen — ideal for advanced content recommendations",
  },
  2: {
    state: 2,
    label: "High Intent / Low Momentum",
    description: "Re-activate with low-friction prompts — streak-save, quick wins",
  },
  3: {
    state: 3,
    label: "Low Intent / High Momentum",
    description: "Surface goal value — help member connect activity to declared goals",
  },
  4: {
    state: 4,
    label: "Low Intent / Low Momentum",
    description: "Re-onboard or churn risk — intervention required",
  },
};

// ─── Intent Domain ────────────────────────────────────────────────────────────

/** Raw goal declared by the member at FTU or updated later */
export interface GoalDeclaration {
  category: string; // e.g. "health", "wealth", "relationships", "mindfulness", "performance"
  declared_at: string; // ISO-8601
  source: "ftu" | "in_app" | "onboarding_survey";
  raw_text?: string; // optional free-text goal
}

/** Intent domain of the C1 Lite Learner Profile */
export interface IntentDomain {
  /** All goals declared by the member, most recent first */
  goal_declarations: GoalDeclaration[];
  /** Primary/active goal category (derived from most recent declaration) */
  primary_goal_category: string | null;
  /** Number of Eve conversations in the last 30 days */
  eve_conversation_frequency_30d: number;
  /** Click-through rate on Eve prompt suggestions (0.0–1.0) */
  prompt_ctr: number;
  /** B3 workaround flag: true when FTU goal data came from the mock adapter */
  ftu_goal_from_mock: boolean;
}

// ─── Engagement Domain ────────────────────────────────────────────────────────

/** Engagement domain of the C1 Lite Learner Profile */
export interface EngagementDomain {
  /** Current streak in days */
  streak_days: number;
  /** ISO-8601 timestamp of last platform activity */
  last_active_at: string;
  /** Average sessions per week over the last 4 weeks */
  session_frequency_weekly: number;
  /** Total days the member has been active on the platform */
  total_active_days: number;
}

// ─── Learning Domain ─────────────────────────────────────────────────────────

/** A single lesson record */
export interface LessonRecord {
  lesson_id: string;
  quest_id: string;
  completed_at: string; // ISO-8601
  duration_seconds: number;
}

/** A quest (course) record */
export interface QuestRecord {
  quest_id: string;
  title: string;
  category: string;
  completed_at: string | null; // null if in progress
  completion_percentage: number; // 0–100
  lessons_completed: number;
  total_lessons: number;
}

/** Learning domain of the C1 Lite Learner Profile */
export interface LearningDomain {
  /** Total lessons completed across all time */
  lessons_completed_total: number;
  /** Lessons completed in the last 30 days */
  lessons_completed_30d: number;
  /** Total quests completed */
  quests_completed_total: number;
  /** The quest currently in progress (or most recently touched) */
  current_quest: QuestRecord | null;
  /** Recent lesson history (last 10) */
  recent_lessons: LessonRecord[];
  /** All quest records for this member */
  quests: QuestRecord[];
}

// ─── Pulse Signals Domain ─────────────────────────────────────────────────────

/** Dormancy diagnosis result */
export type DormancyLevel = "active" | "drifting" | "at_risk" | "churned";

/** Pulse signals domain of the C1 Lite Learner Profile */
export interface PulseSignalsDomain {
  /**
   * Dormancy diagnosis:
   * - active: last activity < 3 days ago
   * - drifting: 3–7 days since last activity
   * - at_risk: 7–30 days since last activity
   * - churned: > 30 days since last activity
   */
  dormancy_diagnosis: DormancyLevel;
  /**
   * Momentum score (0.0–1.0).
   * Derived from: streak_days (40%), lessons_completed_30d (35%),
   * session_frequency_weekly (25%)
   */
  momentum_score: number;
  /** Days since last platform activity */
  days_since_last_active: number;
  /** Whether the member is currently on a streak-break risk (streak will break today) */
  streak_break_risk: boolean;
  /** Number of consecutive days without platform activity */
  days_inactive_streak: number;
}

// ─── Member State Domain ──────────────────────────────────────────────────────

/** Member state domain of the C1 Lite Learner Profile */
export interface MemberStateDomain {
  /** Classified state (1–4) */
  state: MemberStateValue;
  /** Human-readable label for the state */
  label: string;
  /**
   * Confidence score (0.0–1.0) for the state classification.
   * Higher = more signal. Falls back to Intent Readiness when < 3 signals present.
   */
  confidence_score: number;
  /** Whether fallback rule was applied (< 3 signals) */
  used_fallback: boolean;
  /** ISO-8601 timestamp when this state was last computed */
  computed_at: string;
}

// ─── Top-level Learner Profile (C1 Lite Schema) ───────────────────────────────

/**
 * C1 Lite Learner Profile — the backbone of the Eve Trainer system.
 * Powers dynamic prompts, nudge campaigns, and member state classification.
 */
export interface LearnerProfile {
  /** Mindvalley member ID */
  member_id: string;
  /** Profile schema version — increment when breaking changes are made */
  schema_version: "1.0";
  /** ISO-8601 timestamp when this profile was built */
  profile_built_at: string;
  /** Data freshness cadence: "realtime" | "hourly" | "daily" */
  data_freshness: "realtime" | "hourly" | "daily";

  intent: IntentDomain;
  engagement: EngagementDomain;
  learning: LearningDomain;
  pulse_signals: PulseSignalsDomain;
  member_state: MemberStateDomain;
}

// ─── Intent Confidence Score ──────────────────────────────────────────────────

/** Input signals used by the Intent Confidence Score algorithm */
export interface IntentSignals {
  has_goal_declaration: boolean;
  goal_declaration_age_days: number; // days since most recent goal was declared
  eve_conversation_frequency_30d: number;
  prompt_ctr: number; // 0.0–1.0
  lessons_completed_30d: number;
  session_frequency_weekly: number;
}

/** Output of the Intent Confidence Score algorithm v1 */
export interface IntentConfidenceResult {
  score: number; // 0.0–1.0
  intent_level: "high" | "low";
  signal_count: number; // number of non-zero signals present
  used_fallback: boolean;
  breakdown: {
    goal_declaration_weight: number;
    recency_weight: number;
    eve_engagement_weight: number;
    prompt_ctr_weight: number;
    learning_activity_weight: number;
  };
}

// ─── Data Adapter Interfaces ─────────────────────────────────────────────────

/** Raw member data as stored/returned by the upstream Learner Profile API (B1) */
export interface RawMemberData {
  member_id: string;
  email?: string;
  created_at: string;
  intent: IntentDomain;
  engagement: EngagementDomain;
  learning: LearningDomain;
  /**
   * Sprint 5 — stuck-point detection fields.
   * Set when a member has been on the same lesson for an extended period.
   */
  stuck_lesson_id?: string | null;
  days_on_current_lesson?: number;
}

/** Context payload injected into Eve AI (B2) */
export interface EveContextPayload {
  member_id: string;
  member_state: MemberStateValue;
  state_label: string;
  confidence_score: number;
  primary_goal: string | null;
  momentum_score: number;
  dormancy: DormancyLevel;
  streak_days: number;
  current_quest_title: string | null;
  /** Serialisation format agreed with Eve AI Platform */
  format: "json" | "free_text";
}

/** FTU (First-Time User) goal data from Platform/Onboarding (B3) */
export interface FtuGoalData {
  member_id: string;
  goals: GoalDeclaration[];
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
}

// ─── Algorithm Batch Test Types ───────────────────────────────────────────────

/** Single row in the algorithm test results */
export interface AlgorithmTestResult {
  member_id: string;
  intent_confidence: IntentConfidenceResult;
  momentum_score: number;
  member_state: MemberStateValue;
  state_label: string;
  confidence_score: number;
}

/** Summary statistics from batch testing */
export interface BatchTestSummary {
  total_members: number;
  state_distribution: Record<MemberStateValue, number>;
  avg_intent_confidence: number;
  avg_momentum_score: number;
  avg_state_confidence: number;
  fallback_count: number;
  high_intent_count: number;
  low_intent_count: number;
}
