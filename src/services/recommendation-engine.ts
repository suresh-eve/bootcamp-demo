/**
 * Eve Trainer — Recommendation Engine (Sprint 7)
 *
 * Predictive Path Continuity: detects quest completions and proactively
 * surfaces the next chapter that best matches the member's declared goal.
 *
 * Public API:
 *   buildQuestCompletionEvent(memberId, questId, completionPct)
 *     → QuestCompletionEvent
 *
 *   getNextChapterRecommendations(member, completedQuestIds)
 *     → RecommendationResponse  (3–5 quests, anchored to goal category, <2s)
 *
 *   getAlmostTherePrompt(member, questId, completionPct)
 *     → { eligible: true; message: string; completion_percentage: number }
 *     → { eligible: false }
 *
 *   buildIntentFallback(member)
 *     → RecommendationResponse  (intent-based fallback when engine unavailable)
 *
 * Design decisions:
 *   - All data is in-memory (mock catalogue) → latency is sub-millisecond in practice
 *   - Goal category drives all recommendations; no cross-category pollution
 *   - Completed quests are strictly excluded (Set-based lookup for O(1) checks)
 *   - "Almost there" threshold: completionPct >= 80
 *   - Fallback: top quests by relevance_weight for the member's goal category
 *     (or the full catalogue sorted by weight if no goal is declared)
 */

import type { RawMemberData } from "../types/index";
import type {
  QuestCompletionEvent,
  NextChapterRecommendation,
  RecommendationResponse,
} from "../types/recommendations";
import {
  getRecommendedQuests,
  getQuestsByCategory,
  MOCK_QUESTS,
  type QuestMeta,
} from "../data/mock-quests";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum completion percentage that triggers the "almost there" prompt */
const ALMOST_THERE_THRESHOLD = 80;

/** Default number of recommendations to return */
const DEFAULT_RECOMMENDATION_LIMIT = 3;

/** Maximum number of recommendations to return */
const MAX_RECOMMENDATION_LIMIT = 5;

/** Valid goal categories as they appear in the quest catalogue */
const VALID_QUEST_CATEGORIES = new Set([
  "habit_builder",
  "mindset",
  "health",
  "relationships",
  "career",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a member's declared primary_goal_category to the nearest quest catalogue
 * category. Handles legacy category names from mock-members (e.g. "performance"
 * → "mindset", "wealth" → "career", "spirituality" → "mindset").
 */
function resolveQuestCategory(
  primaryGoal: string | null
): QuestMeta["category"] | null {
  if (!primaryGoal) return null;

  if (VALID_QUEST_CATEGORIES.has(primaryGoal)) {
    return primaryGoal as QuestMeta["category"];
  }

  // Legacy / alias mappings
  const ALIAS: Record<string, QuestMeta["category"]> = {
    performance:  "mindset",
    mindfulness:  "mindset",
    spirituality: "mindset",
    wealth:       "career",
    creativity:   "career",
  };

  return ALIAS[primaryGoal] ?? null;
}

/**
 * Build a human-readable recommendation reason string.
 */
function buildReason(quest: QuestMeta, goalCategory: string): string {
  return `Matches your ${goalCategory.replace("_", " ")} goal — ${quest.description}`;
}

/**
 * Convert a QuestMeta from the catalogue into a NextChapterRecommendation.
 */
function toRecommendation(
  quest: QuestMeta,
  goalCategory: string,
  isFallback = false
): NextChapterRecommendation {
  return {
    quest_id:        quest.id,
    title:           quest.title,
    category:        quest.category,
    relevance_score: isFallback
      ? parseFloat((quest.relevance_weight * 0.7).toFixed(3))
      : parseFloat(quest.relevance_weight.toFixed(3)),
    reason: isFallback
      ? `Based on your recent activity — ${quest.description}`
      : buildReason(quest, goalCategory),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a QuestCompletionEvent.
 *
 * This event is produced any time a quest reaches 100% completion.
 * It can also be produced at 80%+ for the "almost there" trigger — the
 * completion_percentage field carries the exact value so consumers can
 * distinguish the two cases.
 *
 * @param memberId       - Mindvalley member ID
 * @param questId        - The quest being completed
 * @param completionPct  - Completion percentage at event time (0–100)
 */
export function buildQuestCompletionEvent(
  memberId: string,
  questId: string,
  completionPct: number
): QuestCompletionEvent {
  return {
    member_id:             memberId,
    quest_id:              questId,
    completed_at:          new Date().toISOString(),
    completion_percentage: Math.min(100, Math.max(0, completionPct)),
  };
}

/**
 * Return 3–5 next-chapter quest recommendations for a member.
 *
 * - Anchored to the member's declared primary_goal_category
 * - Excludes already-completed quests
 * - Sorted by relevance_weight descending
 * - Target latency: <2s (in practice <1ms — all in-memory)
 *
 * @param member           - Raw member data (intent.primary_goal_category is used)
 * @param completedQuestIds - Quest IDs the member has already finished
 * @param limit            - How many recommendations to return (default 3, max 5)
 */
export function getNextChapterRecommendations(
  member: RawMemberData,
  completedQuestIds: string[],
  limit = DEFAULT_RECOMMENDATION_LIMIT
): RecommendationResponse {
  const clampedLimit = Math.min(Math.max(limit, 1), MAX_RECOMMENDATION_LIMIT);
  const goalCategory = resolveQuestCategory(member.intent.primary_goal_category);

  if (!goalCategory) {
    // No goal category — fall back to intent-based recommendations
    return buildIntentFallback(member, completedQuestIds, clampedLimit);
  }

  const quests = getRecommendedQuests(completedQuestIds, goalCategory, clampedLimit);

  if (quests.length === 0) {
    // All quests in the category are completed — fall back to intent-based
    return buildIntentFallback(member, completedQuestIds, clampedLimit);
  }

  const recommendations = quests.map((q) => toRecommendation(q, goalCategory));

  return {
    member_id:       member.member_id,
    recommendations,
    generated_at:    new Date().toISOString(),
    is_fallback:     false,
  };
}

/**
 * Return an "almost there" prompt when the member is >= 80% through a quest.
 *
 * Returns `{ eligible: false }` when completionPct < 80 so the API layer
 * can respond without building a message.
 *
 * @param member        - Raw member data (used for personalisation)
 * @param questId       - The quest the member is progressing through
 * @param completionPct - Current completion percentage (0–100)
 */
export function getAlmostTherePrompt(
  member: RawMemberData,
  questId: string,
  completionPct: number
):
  | { eligible: true; message: string; completion_percentage: number }
  | { eligible: false } {
  if (completionPct < ALMOST_THERE_THRESHOLD) {
    return { eligible: false };
  }

  // Look up the quest title for personalised copy
  const quest = MOCK_QUESTS.find((q) => q.id === questId);
  const questTitle = quest?.title ?? "this quest";

  // Personalise with goal if available
  const goalCategory = member.intent.primary_goal_category;
  const goalPhrase = goalCategory
    ? ` on your ${goalCategory.replace("_", " ")} journey`
    : "";

  const remaining = 100 - completionPct;
  const pct = Math.round(completionPct);

  let message: string;
  if (completionPct >= 95) {
    message = `Almost done! You're ${pct}% through "${questTitle}"${goalPhrase}. Just a few lessons left — finish strong!`;
  } else {
    message = `You're almost there! ${pct}% done with "${questTitle}"${goalPhrase}. Only ${remaining}% to go — keep the momentum going!`;
  }

  return {
    eligible:            true,
    message,
    completion_percentage: pct,
  };
}

/**
 * Build intent-based fallback recommendations.
 *
 * Used when:
 * 1. The member has no declared goal category
 * 2. All quests in the member's category are already completed
 * 3. The main recommendation engine is unavailable
 *
 * Strategy: return the highest-weighted quests across all categories,
 * excluding already-completed ones.
 *
 * @param member           - Raw member data
 * @param completedQuestIds - Quest IDs to exclude
 * @param limit            - How many fallback recommendations to return
 */
export function buildIntentFallback(
  member: RawMemberData,
  completedQuestIds: string[] = [],
  limit = DEFAULT_RECOMMENDATION_LIMIT
): RecommendationResponse {
  const completedSet = new Set(completedQuestIds);

  // Sort entire catalogue by relevance_weight, exclude completed
  const fallbackQuests = MOCK_QUESTS.filter((q) => !completedSet.has(q.id))
    .sort((a, b) => b.relevance_weight - a.relevance_weight)
    .slice(0, Math.min(limit, MAX_RECOMMENDATION_LIMIT));

  const recommendations = fallbackQuests.map((q) =>
    toRecommendation(q, q.category, true)
  );

  return {
    member_id:       member.member_id,
    recommendations,
    generated_at:    new Date().toISOString(),
    is_fallback:     true,
  };
}
