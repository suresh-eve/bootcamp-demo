/**
 * Eve Trainer — Milestone Tracker Service (Sprint 8)
 *
 * Goal milestone detection and identity reflection prompt generation.
 *
 * Public API:
 *   checkMilestone(member, completedQuestIds)
 *     → GoalMilestone | null
 *     Fires at exactly 3, 6, or 9 completions in the same category.
 *     Returns null if no milestone threshold is hit.
 *
 *   buildMilestoneReflection(milestone, member)
 *     → MilestoneReflection
 *     Builds an identity-reflection prompt for Eve to deliver.
 *
 *   buildEveProactiveMessage(member, recommendations)
 *     → string
 *     Builds Eve's proactive "Great job finishing…" follow-up message.
 *
 *   buildSilenceNudge(member, daysSilent)
 *     → SilenceNudge | null
 *     Returns a SilenceNudge when daysSilent >= 5; null otherwise.
 *
 * Design decisions:
 * - Milestone thresholds are exactly 3, 6, 9 — not >=; we use modular arithmetic
 *   so the trigger fires once per threshold, not every quest above it.
 * - Category is resolved from each completed quest's metadata via MOCK_QUESTS.
 *   Quest IDs not found in the catalogue are silently ignored.
 * - Identity labels are hard-coded by category for deterministic Eve copy.
 * - Silence nudge threshold is 5 days (>= 5) — 4 days does NOT trigger.
 * - A/B variant for both milestone and silence-nudge experiments is assigned
 *   deterministically via the same DJB2 hash used across the platform.
 */

import type { RawMemberData } from "../types/index";
import type {
  GoalMilestone,
  MilestoneLevel,
  MilestoneReflection,
  SilenceNudge,
} from "../types/milestone";
import type { NextChapterRecommendation } from "../types/recommendations";
import type { BrazePushPayload } from "../types/braze";
import { MOCK_QUESTS } from "../data/mock-quests";
import { mapToBrazeUser } from "./braze-client";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Quests-per-category thresholds that trigger a milestone */
const MILESTONE_THRESHOLDS: MilestoneLevel[] = [1, 2, 3];
const MILESTONE_QUEST_COUNTS: Record<MilestoneLevel, number> = { 1: 3, 2: 6, 3: 9 };

/** Braze campaign ID for the 5-day silence re-entry push */
const SILENCE_NUDGE_CAMPAIGN_ID = "braze_campaign_silence_reentry_v1";

/** Experiment IDs */
const MILESTONE_EXPERIMENT_ID = "eve_milestone_reflection_v1";
const SILENCE_NUDGE_EXPERIMENT_ID = "eve_silence_nudge_v1";

/** Identity labels per quest category (used in milestone copy) */
const IDENTITY_LABELS: Record<string, string> = {
  habit_builder: "habit architect",
  mindset:       "mindset explorer",
  health:        "health champion",
  relationships: "relationship master",
  career:        "career accelerator",
};

// ─── DJB2 Hash (shared pattern, no import cycle) ─────────────────────────────

function djb2Hash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

function assignVariant(
  memberId: string,
  experimentId: string
): "treatment" | "control" {
  const bucket = djb2Hash(`${experimentId}:${memberId}`);
  return bucket < 50 ? "treatment" : "control";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a lookup of category → number of completions from a list of quest IDs.
 *
 * Quest IDs not found in MOCK_QUESTS are silently ignored.
 */
function buildCategoryCompletionMap(
  completedQuestIds: string[]
): Map<string, number> {
  const map = new Map<string, number>();
  const questCatalogue = new Map(MOCK_QUESTS.map((q) => [q.id, q.category]));

  for (const questId of completedQuestIds) {
    const category = questCatalogue.get(questId);
    if (category) {
      map.set(category, (map.get(category) ?? 0) + 1);
    }
  }

  return map;
}

/**
 * Determine whether the given completion count hits a milestone threshold
 * and return the milestone level, or null if no threshold is hit.
 *
 * We use exact-match rather than >= so each threshold fires exactly once.
 */
function resolveMilestoneLevel(count: number): MilestoneLevel | null {
  for (const [level, threshold] of Object.entries(MILESTONE_QUEST_COUNTS) as [
    string,
    number,
  ][]) {
    if (count === threshold) {
      return parseInt(level, 10) as MilestoneLevel;
    }
  }
  return null;
}

/**
 * Return the identity label for a given category, defaulting to "learner".
 */
function identityLabel(category: string): string {
  return IDENTITY_LABELS[category] ?? "dedicated learner";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether the given set of completed quest IDs triggers a goal milestone.
 *
 * A milestone fires at exactly 3, 6, or 9 completions in the same category.
 * The most recently added quest is used as the trigger — we scan all categories
 * and return the first milestone that is hit (only one can fire per call since
 * only one quest was just completed).
 *
 * @param member            - Raw member data (used for member_id and personalisation)
 * @param completedQuestIds - Full list of quest IDs the member has completed
 *                            (including the quest just completed)
 * @returns GoalMilestone when a threshold is hit, null otherwise
 */
export function checkMilestone(
  member: RawMemberData,
  completedQuestIds: string[]
): GoalMilestone | null {
  const categoryMap = buildCategoryCompletionMap(completedQuestIds);

  for (const [category, count] of categoryMap) {
    const level = resolveMilestoneLevel(count);
    if (level !== null) {
      return {
        member_id:         member.member_id,
        category,
        quests_completed:  count,
        milestone_level:   level,
        triggered_at:      new Date().toISOString(),
        ab_variant:        assignVariant(member.member_id, MILESTONE_EXPERIMENT_ID),
      };
    }
  }

  return null;
}

/**
 * Build an identity-reflection MilestoneReflection for Eve to deliver.
 *
 * The prompt_text is personalised to the category and milestone level.
 * The eve_context string is injected into the Eve AI model context.
 *
 * @param milestone - The GoalMilestone that was triggered
 * @param member    - Raw member data (used for personalisation)
 * @returns MilestoneReflection with prompt_text, eve_context, and dismissible flag
 */
export function buildMilestoneReflection(
  milestone: GoalMilestone,
  member: RawMemberData
): MilestoneReflection {
  const label = identityLabel(milestone.category);
  const categoryDisplay = milestone.category.replace("_", " ");
  const questWord = milestone.quests_completed === 1 ? "quest" : "quests";

  // Personalised prompt text anchored to the milestone level
  let promptText: string;
  switch (milestone.milestone_level) {
    case 1:
      promptText = `You've completed ${milestone.quests_completed} ${categoryDisplay} ${questWord} — you're becoming a ${label}. How has this journey changed how you see yourself?`;
      break;
    case 2:
      promptText = `${milestone.quests_completed} ${categoryDisplay} ${questWord} completed — you're deepening your identity as a ${label}. What's one belief about yourself that has shifted?`;
      break;
    case 3:
      promptText = `Remarkable — ${milestone.quests_completed} ${categoryDisplay} ${questWord} and you've truly embodied the role of ${label}. What does your life look like from this new vantage point?`;
      break;
  }

  // Eve context string injected into the AI model
  const eveContext =
    `Member ${member.member_id} just reached Milestone Level ${milestone.milestone_level} ` +
    `in the ${categoryDisplay} category (${milestone.quests_completed} quests completed). ` +
    `Identity label: "${label}". ` +
    `Primary goal: ${member.intent.primary_goal_category ?? "not declared"}. ` +
    `Use an encouraging, reflective tone. Do not be generic — anchor to the ${categoryDisplay} journey.`;

  return {
    milestone,
    prompt_text: promptText,
    eve_context: eveContext,
    dismissible: milestone.ab_variant === "control", // control: dismissible; treatment: engage
  };
}

/**
 * Build Eve's proactive follow-up message after a quest is completed.
 *
 * This is the first message Eve sends on the New Chapter landing screen:
 * "Great job finishing [quest]! Based on your journey, here's what to explore next…"
 *
 * @param member          - Raw member data
 * @param recommendations - The next-chapter recommendations being surfaced
 * @returns A personalised proactive message string
 */
export function buildEveProactiveMessage(
  member: RawMemberData,
  recommendations: NextChapterRecommendation[]
): string {
  const goalCategory = member.intent.primary_goal_category;
  const goalPhrase = goalCategory
    ? ` on your ${goalCategory.replace("_", " ")} journey`
    : "";

  const currentQuest = member.learning.current_quest;
  const questTitle = currentQuest?.title ?? "your quest";

  if (recommendations.length === 0) {
    return (
      `Great job finishing "${questTitle}"${goalPhrase}! ` +
      `You've made incredible progress. ` +
      `Keep exploring to uncover your next breakthrough.`
    );
  }

  const topRec = recommendations[0];
  return (
    `Great job finishing "${questTitle}"${goalPhrase}! ` +
    `Based on your journey, here's what to explore next: ` +
    `"${topRec.title}" — ${topRec.reason}. ` +
    `${recommendations.length > 1 ? `Plus ${recommendations.length - 1} more recommendation${recommendations.length > 2 ? "s" : ""} waiting for you.` : ""}`
  ).trim();
}

/**
 * Build a SilenceNudge for a member who has been inactive for 5+ days.
 *
 * Returns null when daysSilent < 5 so callers can skip delivery.
 *
 * The nudge is assigned to the `eve_silence_nudge_v1` A/B experiment:
 *   treatment → Braze push payload included
 *   control   → in-app only, no Braze push
 *
 * @param member      - Raw member data
 * @param daysSilent  - How many days the member has been inactive
 * @returns SilenceNudge when eligible, null when daysSilent < 5
 */
export function buildSilenceNudge(
  member: RawMemberData,
  daysSilent: number
): SilenceNudge | null {
  if (daysSilent < 5) {
    return null;
  }

  const variant = assignVariant(member.member_id, SILENCE_NUDGE_EXPERIMENT_ID);
  const goalCategory = member.intent.primary_goal_category;
  const goalPhrase = goalCategory
    ? ` on your ${goalCategory.replace("_", " ")} journey`
    : "";

  const inAppFallback =
    `We've missed you! It's been ${daysSilent} days${goalPhrase}. ` +
    `Your next lesson is waiting — come back and keep the momentum going.`;

  const pushMessage =
    `It's been ${daysSilent} days — your ${goalCategory?.replace("_", " ") ?? "learning"} journey misses you. ` +
    `Tap to pick up where you left off.`;

  const brazeUser = mapToBrazeUser(member);

  const brazePushPayload: BrazePushPayload =
    variant === "treatment"
      ? {
          campaign_id: SILENCE_NUDGE_CAMPAIGN_ID,
          recipient:   brazeUser,
          message:     pushMessage,
          deep_link:   `eve://dashboard?member=${member.member_id}&source=silence_nudge`,
          ab_variant:  "treatment",
          timestamp:   new Date().toISOString(),
        }
      : {
          campaign_id: SILENCE_NUDGE_CAMPAIGN_ID,
          recipient:   brazeUser,
          message:     inAppFallback,
          ab_variant:  "control",
          timestamp:   new Date().toISOString(),
        };

  const channel: SilenceNudge["channel"] = variant === "treatment" ? "push" : "in_app";

  return {
    member_id:       member.member_id,
    days_silent:     daysSilent,
    channel,
    braze_payload:   variant === "treatment" ? brazePushPayload : undefined,
    in_app_fallback: inAppFallback,
    ab_variant:      variant,
    created_at:      new Date().toISOString(),
  };
}
