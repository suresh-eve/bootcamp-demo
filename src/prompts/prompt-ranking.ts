/**
 * Eve Trainer — Prompt Ranking Model v1 (Rule-Based)
 *
 * Ranking formula:
 *   score = (intent_weight × intent_score)
 *         + (momentum_weight × momentum_score)
 *         + (context_bonus)
 *         + (category_affinity)
 *         + (base_weight × base_weight_factor)
 *
 * Inputs from the LearnerProfile:
 *   - intent_score  (from member_state.confidence_score, proxy for intent signal strength)
 *   - momentum_score (from pulse_signals.momentum_score)
 *   - member_state  (drives category affinity)
 *   - dormancy      (drives context bonus for re_entry prompts)
 *   - streak_break_risk (small urgency boost)
 *   - primary_goal_category (filters / boosts goal prompts)
 *   - current_quest (filters / boosts content prompts)
 *
 * The ranker selects the top N prompts (2–3) ensuring category diversity:
 *   - At least 1 prompt from the primary category for the member's state
 *   - Remaining slots filled by highest-scoring prompts from other categories
 */

import type { LearnerProfile, MemberStateValue } from "../types/index";
import type { PromptTemplate, RankedPrompt, PromptCategory } from "../types/prompts";
import {
  PROMPT_LIBRARY,
  FALLBACK_PROMPTS,
  getPromptsForState,
  personalisePromptText,
} from "./prompt-library";

// ─── Weight Constants ─────────────────────────────────────────────────────────

const RANKING_WEIGHTS = {
  /** How much the intent confidence score contributes */
  INTENT: 0.35,
  /** How much the momentum score contributes */
  MOMENTUM: 0.30,
  /** Category affinity bonus for state-appropriate categories */
  CATEGORY_AFFINITY: 0.20,
  /** Base template weight (favours higher-quality templates within a category) */
  BASE_WEIGHT_FACTOR: 0.10,
  /** Context-specific bonus (re_entry boost for dormant members, streak bonus) */
  CONTEXT_BONUS: 0.05,
} as const;

/** Number of prompts to return */
const PROMPT_COUNT_MIN = 2;
const PROMPT_COUNT_MAX = 3;

// ─── Category Affinity Matrix ─────────────────────────────────────────────────

/**
 * For each member state, define which prompt categories are "primary" (high affinity)
 * vs "secondary" (lower affinity). Primary categories get a 1.0 affinity score;
 * secondary get 0.5.
 *
 * State 1 — High intent / High momentum: goal + content (deepening)
 * State 2 — High intent / Low momentum:  re_entry + content (reactivation)
 * State 3 — Low intent  / High momentum: goal + reflection (connect to goals)
 * State 4 — Low intent  / Low momentum:  re_entry + reflection (gentle re-onboard)
 */
const CATEGORY_AFFINITY: Record<MemberStateValue, Record<PromptCategory, number>> = {
  1: { goal: 1.0,     content: 1.0,     reflection: 0.5, re_entry: 0.0 },
  2: { goal: 0.5,     content: 0.8,     reflection: 0.5, re_entry: 1.0 },
  3: { goal: 1.0,     content: 0.5,     reflection: 0.8, re_entry: 0.3 },
  4: { goal: 0.3,     content: 0.3,     reflection: 0.7, re_entry: 1.0 },
};

// ─── Context Bonus Computation ────────────────────────────────────────────────

/**
 * Compute a small context-specific bonus for a template.
 *
 * Bonuses:
 * - re_entry templates get a bump when the member is dormant (drifting / at_risk / churned)
 * - reflection templates get a small bump for streak_break_risk members (mindful pause)
 * - content templates get a bump when the member has an active quest
 */
function computeContextBonus(
  template: PromptTemplate,
  profile: LearnerProfile
): number {
  const { dormancy_diagnosis, streak_break_risk } = profile.pulse_signals;
  const hasActiveQuest = profile.learning.current_quest !== null;

  let bonus = 0;

  if (template.category === "re_entry" && dormancy_diagnosis !== "active") {
    // The more dormant the member, the larger the re_entry bonus
    const dormancyBonus: Record<string, number> = {
      drifting: 0.4,
      at_risk:  0.7,
      churned:  1.0,
    };
    bonus += dormancyBonus[dormancy_diagnosis] ?? 0;
  }

  if (template.category === "reflection" && streak_break_risk) {
    bonus += 0.3;
  }

  if (template.category === "content" && hasActiveQuest) {
    bonus += 0.5;
  }

  // Clamp bonus to [0, 1] before applying its weight
  return Math.min(bonus, 1.0);
}

// ─── Score a single template ──────────────────────────────────────────────────

function scoreTemplate(
  template: PromptTemplate,
  profile: LearnerProfile,
  state: MemberStateValue
): number {
  const intentScore = profile.member_state.confidence_score;
  const momentumScore = profile.pulse_signals.momentum_score;
  const categoryAffinity = CATEGORY_AFFINITY[state][template.category];
  const contextBonus = computeContextBonus(template, profile);

  const score =
    RANKING_WEIGHTS.INTENT * intentScore +
    RANKING_WEIGHTS.MOMENTUM * momentumScore +
    RANKING_WEIGHTS.CATEGORY_AFFINITY * categoryAffinity +
    RANKING_WEIGHTS.BASE_WEIGHT_FACTOR * template.base_weight +
    RANKING_WEIGHTS.CONTEXT_BONUS * contextBonus;

  return parseFloat(Math.min(score, 1.0).toFixed(4));
}

// ─── Goal filter ──────────────────────────────────────────────────────────────

/**
 * Filter out goal-category prompts that explicitly restrict to specific goal
 * categories when the member's goal doesn't match.
 */
function matchesGoalFilter(template: PromptTemplate, primaryGoal: string | null): boolean {
  if (!template.goal_categories || template.goal_categories.length === 0) {
    return true; // No filter → match all
  }
  if (!primaryGoal) return false; // Template is goal-specific but member has no goal
  return template.goal_categories.includes(primaryGoal);
}

// ─── Build reason string ──────────────────────────────────────────────────────

function buildReason(
  template: PromptTemplate,
  profile: LearnerProfile,
  state: MemberStateValue
): string {
  const stateLabels: Record<MemberStateValue, string> = {
    1: "high-intent/high-momentum",
    2: "high-intent/low-momentum",
    3: "low-intent/high-momentum",
    4: "low-intent/low-momentum",
  };

  const categoryReasons: Record<PromptCategory, string> = {
    goal: "connects to your declared goal",
    content: "builds on your learning momentum",
    reflection: "supports deeper self-awareness",
    re_entry: "offers a low-friction way to re-engage",
  };

  return `${categoryReasons[template.category]} (${stateLabels[state]} member)`;
}

// ─── Main Ranking Function ────────────────────────────────────────────────────

/**
 * Rank prompt templates for a given member profile.
 *
 * Returns 2–3 prompts with category diversity:
 * 1. Score all eligible templates for the member's state
 * 2. Greedily pick the top-scoring prompt from the primary category for the state
 * 3. Fill remaining slots with the highest-scoring prompts from other categories
 *
 * Personalises {{goal}} and {{quest}} placeholders before returning.
 *
 * @param profile - Full LearnerProfile (from Sprint 1 API)
 * @param count   - Number of prompts to return (default 3, clamped to 2–3)
 * @returns Ordered list of ranked prompts (highest score first)
 */
export function rankPromptsForProfile(
  profile: LearnerProfile,
  count: number = PROMPT_COUNT_MAX
): RankedPrompt[] {
  const clampedCount = Math.min(Math.max(count, PROMPT_COUNT_MIN), PROMPT_COUNT_MAX);
  const state = profile.member_state.state;
  const primaryGoal = profile.intent.primary_goal_category;
  const currentQuestTitle = profile.learning.current_quest?.title ?? null;

  // 1. Get all templates that target this state
  const eligible = getPromptsForState(state).filter((t) =>
    matchesGoalFilter(t, primaryGoal)
  );

  // 2. Score each eligible template
  const scored = eligible.map((template) => ({
    template,
    score: scoreTemplate(template, profile, state),
  }));

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // 3. Greedy category-diverse selection
  const selected: typeof scored = [];
  const usedCategories = new Set<PromptCategory>();

  // First pass: pick best from each category (ensures diversity)
  for (const item of scored) {
    if (selected.length >= clampedCount) break;
    if (!usedCategories.has(item.template.category)) {
      selected.push(item);
      usedCategories.add(item.template.category);
    }
  }

  // Second pass: fill remaining slots with highest-scored not yet included
  if (selected.length < clampedCount) {
    for (const item of scored) {
      if (selected.length >= clampedCount) break;
      if (!selected.includes(item)) {
        selected.push(item);
      }
    }
  }

  // Sort the final selection by score again (diversity pass may have reordered)
  selected.sort((a, b) => b.score - a.score);

  // 4. Personalise and build RankedPrompt output
  return selected.map(({ template, score }) => {
    const personalisedText = personalisePromptText(template, primaryGoal, currentQuestTitle);
    const rawDisplay = template.display_text ?? template.text;
    const personalisedDisplay = personalisePromptText(
      { ...template, text: rawDisplay },
      primaryGoal,
      currentQuestTitle
    );
    return {
      prompt_id: template.prompt_id,
      category: template.category,
      display_text: personalisedDisplay,
      text: personalisedText,
      ranking_score: score,
      reason: buildReason(template, profile, state),
    };
  });
}

// ─── Fallback Ranking ─────────────────────────────────────────────────────────

/**
 * Return static fallback prompts when the Learner Profile is unavailable.
 * Falls back to the FALLBACK_PROMPTS pool (generic, state-agnostic).
 *
 * @param count - Number of prompts to return (default 3, clamped to 2–3)
 */
export function getFallbackPrompts(count: number = PROMPT_COUNT_MAX): RankedPrompt[] {
  const clampedCount = Math.min(Math.max(count, PROMPT_COUNT_MIN), PROMPT_COUNT_MAX);

  return FALLBACK_PROMPTS.slice(0, clampedCount).map((template, idx) => ({
    prompt_id: template.prompt_id,
    category: template.category,
    display_text: template.display_text ?? template.text,
    text: template.text,
    ranking_score: parseFloat((1.0 - idx * 0.1).toFixed(4)),
    reason: "static fallback prompt (profile unavailable)",
  }));
}

// ─── Convenience: rank from profile or fallback ───────────────────────────────

/**
 * Rank prompts, falling back gracefully when the profile is null.
 *
 * @param profile - LearnerProfile | null
 * @param count   - Number of prompts
 * @returns { prompts, isFallback }
 */
export function rankPrompts(
  profile: LearnerProfile | null,
  count: number = PROMPT_COUNT_MAX
): { prompts: RankedPrompt[]; isFallback: boolean } {
  if (!profile) {
    return { prompts: getFallbackPrompts(count), isFallback: true };
  }
  return { prompts: rankPromptsForProfile(profile, count), isFallback: false };
}
