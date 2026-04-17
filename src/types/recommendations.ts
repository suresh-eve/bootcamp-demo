/**
 * Eve Trainer — Sprint 7 Types: Predictive Path Continuity / Next-Chapter Recommendations
 *
 * Types for:
 * - QuestMeta         — minimal quest descriptor used in recommendations
 * - QuestCompletionEvent — real-time event fired when a quest is completed (or 80%+ reached)
 * - NextChapterRecommendation — a single quest recommendation with scoring metadata
 * - RecommendationResponse    — full API response shape for next-chapter endpoints
 */

// ─── Quest Metadata ───────────────────────────────────────────────────────────

/**
 * Minimal quest descriptor used in recommendation payloads.
 * Mirrors QuestMeta from mock-quests.ts but kept separate so the type layer
 * has no compile-time dependency on the data layer.
 */
export interface QuestMeta {
  /** Unique quest identifier (e.g. "hb_q001") */
  id: string;
  /** Human-readable quest title */
  title: string;
  /** Goal category the quest belongs to */
  category: string;
  /** Total number of lessons in the quest */
  lesson_count: number;
}

// ─── Quest Completion Event ───────────────────────────────────────────────────

/**
 * Real-time event fired when a member completes a quest
 * — or when they reach >= 80% completion (the "almost there" trigger).
 *
 * Produced by `buildQuestCompletionEvent()` in the recommendation engine.
 */
export interface QuestCompletionEvent {
  /** Mindvalley member ID */
  member_id: string;
  /** The quest being completed / nearly completed */
  quest_id: string;
  /** ISO-8601 timestamp when the event was generated */
  completed_at: string;
  /**
   * Completion percentage at the moment the event fired.
   * 100 = quest fully complete; >= 80 = "almost there" trigger.
   */
  completion_percentage: number;
}

// ─── Next-Chapter Recommendation ─────────────────────────────────────────────

/**
 * A single next-chapter quest recommendation.
 *
 * Returned inside RecommendationResponse.recommendations[].
 */
export interface NextChapterRecommendation {
  /** Quest identifier */
  quest_id: string;
  /** Quest title */
  title: string;
  /** Goal category */
  category: string;
  /**
   * Relevance score 0.0–1.0.
   * Derived from relevance_weight in the quest catalogue + optional intent boost.
   */
  relevance_score: number;
  /** Human-readable explanation of why this quest was recommended */
  reason: string;
}

// ─── Recommendation Response ──────────────────────────────────────────────────

/**
 * Full API response shape for:
 *   POST /members/:member_id/quest-complete
 *   GET  /members/:member_id/next-chapter
 */
export interface RecommendationResponse {
  /** Mindvalley member ID */
  member_id: string;
  /** 3–5 recommended next quests (goal-anchored, excluding completed ones) */
  recommendations: NextChapterRecommendation[];
  /** ISO-8601 timestamp when recommendations were generated */
  generated_at: string;
  /** True when the recommendation engine was unavailable and intent-based fallback was used */
  is_fallback: boolean;
}
