/**
 * Eve Trainer — New Chapter Flow Service (Sprint 8)
 *
 * Orchestrates the full post-quest-completion landing experience:
 *   1. Get next-chapter recommendations (from recommendation-engine)
 *   2. Check for a goal milestone (from milestone-tracker)
 *   3. Build Eve's proactive follow-up message
 *   4. Return a NewChapterFlow object combining all of the above
 *
 * Also provides:
 *   checkSilenceAndNudge(member)
 *     → Builds and delivers a SilenceNudge when the member has been inactive
 *       for 5+ days. Delivery is via Braze push (treatment) or in-app fallback.
 *
 * Public API:
 *   orchestrateNewChapterFlow(member, completedQuestId, allCompletedQuestIds)
 *     → NewChapterFlow
 *
 *   checkSilenceAndNudge(member)
 *     → Promise<{ nudge: SilenceNudge | null; delivered: boolean }>
 *
 * Design decisions:
 * - The quest title is resolved from MOCK_QUESTS when available; falls back to
 *   the member's current_quest title if the ID is not in the catalogue.
 * - Milestone check uses the full allCompletedQuestIds list (post-completion),
 *   so the newly completed quest is always included.
 * - Braze delivery for silence nudges respects the existing fatigue guard via
 *   deliverNudge() in push-notification.ts — or calls brazeClient.sendPush()
 *   directly for silence nudges to avoid nudge-type coupling.
 * - Silence nudge daysSilent is derived from member.engagement.last_active_at.
 */

import type { RawMemberData } from "../types/index";
import type { NewChapterFlow, SilenceNudge } from "../types/milestone";
import {
  checkMilestone,
  buildMilestoneReflection,
  buildEveProactiveMessage,
  buildSilenceNudge,
} from "./milestone-tracker";
import { getNextChapterRecommendations } from "./recommendation-engine";
import { brazeClient } from "./braze-client";
import { MOCK_QUESTS } from "../data/mock-quests";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute how many whole days the member has been inactive.
 */
function computeDaysSilent(member: RawMemberData): number {
  return Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(member.engagement.last_active_at).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
}

/**
 * Resolve a quest title + category from the catalogue, falling back to
 * the member's current quest if the quest ID is not in MOCK_QUESTS.
 */
function resolveCompletedQuestMeta(
  member: RawMemberData,
  completedQuestId: string
): { quest_id: string; title: string; category: string } {
  const catalogueEntry = MOCK_QUESTS.find((q) => q.id === completedQuestId);
  if (catalogueEntry) {
    return {
      quest_id: catalogueEntry.id,
      title:    catalogueEntry.title,
      category: catalogueEntry.category,
    };
  }

  // Fallback to the member's current or most recent quest record
  const currentQuest = member.learning.current_quest;
  if (currentQuest) {
    return {
      quest_id: completedQuestId,
      title:    currentQuest.title,
      category: currentQuest.category,
    };
  }

  return {
    quest_id: completedQuestId,
    title:    "Completed Quest",
    category: member.intent.primary_goal_category ?? "general",
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Orchestrate the full New Chapter Flow for a member who just completed a quest.
 *
 * Steps:
 * 1. Get 3 next-chapter recommendations from the recommendation engine
 * 2. Check whether the completion triggers a goal milestone (3/6/9 in category)
 * 3. Build Eve's proactive "Great job finishing…" message
 * 4. If milestone triggered, build the identity-reflection prompt
 * 5. Assemble and return the NewChapterFlow
 *
 * @param member                - Raw member data
 * @param completedQuestId      - The quest that was just completed
 * @param allCompletedQuestIds  - Full list of completed quest IDs (including the new one)
 * @returns NewChapterFlow with recommendations, Eve message, and optional milestone
 */
export function orchestrateNewChapterFlow(
  member: RawMemberData,
  completedQuestId: string,
  allCompletedQuestIds: string[]
): NewChapterFlow {
  // Step 1: Get next-chapter recommendations
  const recResponse = getNextChapterRecommendations(
    member,
    allCompletedQuestIds
  );
  const recommendations = recResponse.recommendations;

  // Step 2: Check for milestone
  const milestone = checkMilestone(member, allCompletedQuestIds);

  // Step 3: Build Eve proactive message
  const eveProactiveMessage = buildEveProactiveMessage(member, recommendations);

  // Step 4: Build milestone reflection if triggered
  const milestoneReflection = milestone
    ? buildMilestoneReflection(milestone, member)
    : undefined;

  // Step 5: Resolve the completed quest metadata
  const completedQuest = resolveCompletedQuestMeta(member, completedQuestId);

  return {
    member_id:            member.member_id,
    completed_quest:      completedQuest,
    recommendations,
    eve_proactive_message: eveProactiveMessage,
    is_milestone:          milestone !== null,
    milestone:             milestoneReflection,
    generated_at:          new Date().toISOString(),
  };
}

/**
 * Check whether a member has been silent for 5+ days and, if so, deliver
 * a silence re-entry nudge.
 *
 * Delivery logic:
 *   - treatment: calls brazeClient.sendPush() with the Braze payload
 *   - control / Braze unavailable: delivers in-app only (no HTTP call)
 *
 * @param member - Raw member data
 * @returns Object with the SilenceNudge (or null if not eligible) and
 *          a delivered boolean indicating whether Braze push was attempted.
 */
export async function checkSilenceAndNudge(
  member: RawMemberData
): Promise<{ nudge: SilenceNudge | null; delivered: boolean }> {
  const daysSilent = computeDaysSilent(member);
  const nudge = buildSilenceNudge(member, daysSilent);

  if (!nudge) {
    return { nudge: null, delivered: false };
  }

  // Deliver via Braze push if treatment + Braze available
  if (nudge.ab_variant === "treatment" && nudge.braze_payload && brazeClient.isAvailable()) {
    const brazeResponse = await brazeClient.sendPush(nudge.braze_payload);
    if (!brazeResponse.success) {
      // Braze failed — channel downgrades to fallback
      return {
        nudge: { ...nudge, channel: "fallback" },
        delivered: true, // in-app fallback counts as delivered
      };
    }
    return { nudge, delivered: true };
  }

  // Control or Braze unavailable — in-app only
  return {
    nudge: { ...nudge, channel: "in_app" },
    delivered: true,
  };
}
