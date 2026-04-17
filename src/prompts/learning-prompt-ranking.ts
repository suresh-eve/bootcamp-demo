/**
 * Eve Trainer — Learning Prompt Ranking (Sprint 3)
 *
 * Ranks prompts specifically for the Learning Assistant surface.
 *
 * Selection strategy (ensures both required types appear):
 * 1. Pick the best lesson-specific prompt (uses {{lesson}} / {{topic}})
 * 2. Pick the best goal-anchored prompt (uses {{goal}}) — skipped if no goal
 * 3. Fill remaining slot(s) with general ranked prompts
 *
 * Fallback chain:
 * - If lesson_meta is null → skip lesson-specific, use general reflection
 * - If primary_goal is null → skip goal-anchored, fill with general
 * - If profile is null → return LEARNING_FALLBACK_PROMPTS
 *
 * Latency target: <1s (no async work; all in-memory computation)
 */

import type { LearnerProfile, MemberStateValue } from "../types/index";
import type { RankedPrompt } from "../types/prompts";
import type {
  LearningRankedPrompt,
  LearningPromptContext,
  LearningPromptContextType,
} from "../types/learning";
import {
  LESSON_SPECIFIC_PROMPTS,
  GOAL_ANCHORED_LESSON_PROMPTS,
  LEARNING_FALLBACK_PROMPTS,
  personalisePromptText,
} from "./prompt-library";
import { rankPromptsForProfile } from "./prompt-ranking";
import type { PromptTemplate } from "../types/prompts";

// ─── Constants ────────────────────────────────────────────────────────────────

const PROMPT_COUNT_MIN = 2;
const PROMPT_COUNT_MAX = 3;

// ─── Lesson-Specific Prompt Selection ────────────────────────────────────────

/**
 * Pick the best lesson-specific prompt for the given member state.
 * Prefers templates that target the member's state; falls back to
 * templates that target all states (state 1/2/3/4).
 */
function pickLessonSpecificPrompt(
  state: MemberStateValue,
  context: LearningPromptContext
): LearningRankedPrompt | null {
  if (!context.lesson_meta) return null;

  // Filter to templates that target this state
  const eligible = LESSON_SPECIFIC_PROMPTS.filter((t) =>
    t.target_states.includes(state)
  );

  if (eligible.length === 0) return null;

  // Sort by base_weight descending; take the highest
  const sorted = [...eligible].sort((a, b) => b.base_weight - a.base_weight);
  const template = sorted[0];

  const text = personalisePromptText(
    template,
    context.primary_goal,
    context.current_quest_title,
    context.lesson_meta.title,
    context.lesson_meta.topic
  );

  return {
    prompt_id: template.prompt_id,
    category: template.category,
    text,
    ranking_score: parseFloat(template.base_weight.toFixed(4)),
    reason: `lesson-specific — anchored to "${context.lesson_meta.title}"`,
    context_type: "lesson_specific",
  };
}

// ─── Goal-Anchored Prompt Selection ──────────────────────────────────────────

/**
 * Pick the best goal-anchored lesson prompt for the given member state and goal.
 * Returns null when no goal is declared.
 */
function pickGoalAnchoredPrompt(
  state: MemberStateValue,
  context: LearningPromptContext
): LearningRankedPrompt | null {
  if (!context.primary_goal) return null;

  const eligible = GOAL_ANCHORED_LESSON_PROMPTS.filter((t) =>
    t.target_states.includes(state)
  );

  if (eligible.length === 0) return null;

  const sorted = [...eligible].sort((a, b) => b.base_weight - a.base_weight);
  const template = sorted[0];

  const lessonTitle = context.lesson_meta?.title ?? null;
  const lessonTopic = context.lesson_meta?.topic ?? null;

  const text = personalisePromptText(
    template,
    context.primary_goal,
    context.current_quest_title,
    lessonTitle,
    lessonTopic
  );

  return {
    prompt_id: template.prompt_id,
    category: template.category,
    text,
    ranking_score: parseFloat(template.base_weight.toFixed(4)),
    reason: `goal-anchored — connects lesson to "${context.primary_goal}" goal`,
    context_type: "goal_anchored",
  };
}

// ─── General Filler Prompts ───────────────────────────────────────────────────

/**
 * Convert a general RankedPrompt into a LearningRankedPrompt with context_type "general".
 */
function toGeneralLearningPrompt(p: RankedPrompt): LearningRankedPrompt {
  return { ...p, context_type: "general" };
}

// ─── Main Learning Prompt Ranking ─────────────────────────────────────────────

/**
 * Build 2–3 prompts for the Learning Assistant surface.
 *
 * Always attempts to include:
 * 1. At least 1 lesson-specific prompt (if lesson_meta available)
 * 2. At least 1 goal-anchored prompt   (if primary_goal available)
 * 3. General prompts as fillers
 *
 * Returns { prompts, isFallback }.
 *
 * @param profile - Full LearnerProfile (or null for fallback)
 * @param context - Lesson + goal context for the Learning Assistant
 * @param count   - Number of prompts to return (2–3, default 3)
 */
export function rankLearningPrompts(
  profile: LearnerProfile | null,
  context: LearningPromptContext,
  count: number = PROMPT_COUNT_MAX
): { prompts: LearningRankedPrompt[]; isFallback: boolean } {
  const clampedCount = Math.min(Math.max(count, PROMPT_COUNT_MIN), PROMPT_COUNT_MAX);

  // ── Full fallback: no profile ────────────────────────────────────────────
  if (!profile) {
    const fallbacks = getLearningFallbackPrompts(clampedCount);
    return { prompts: fallbacks, isFallback: true };
  }

  const state = profile.member_state.state;
  const selected: LearningRankedPrompt[] = [];
  const usedPromptIds = new Set<string>();

  // ── Step 1: lesson-specific prompt ───────────────────────────────────────
  const lessonPrompt = pickLessonSpecificPrompt(state, context);
  if (lessonPrompt) {
    selected.push(lessonPrompt);
    usedPromptIds.add(lessonPrompt.prompt_id);
  }

  // ── Step 2: goal-anchored prompt ─────────────────────────────────────────
  if (selected.length < clampedCount) {
    const goalPrompt = pickGoalAnchoredPrompt(state, context);
    if (goalPrompt && !usedPromptIds.has(goalPrompt.prompt_id)) {
      selected.push(goalPrompt);
      usedPromptIds.add(goalPrompt.prompt_id);
    }
  }

  // ── Step 3: fill remaining slots with general ranked prompts ──────────────
  if (selected.length < clampedCount) {
    const generalPrompts = rankPromptsForProfile(profile, clampedCount);
    for (const gp of generalPrompts) {
      if (selected.length >= clampedCount) break;
      if (!usedPromptIds.has(gp.prompt_id)) {
        selected.push(toGeneralLearningPrompt(gp));
        usedPromptIds.add(gp.prompt_id);
      }
    }
  }

  // ── Edge case: if we somehow still have < 2, add fallback fillers ─────────
  if (selected.length < PROMPT_COUNT_MIN) {
    const fillers = getLearningFallbackPrompts(PROMPT_COUNT_MIN - selected.length);
    for (const f of fillers) {
      if (!usedPromptIds.has(f.prompt_id)) {
        selected.push(f);
        usedPromptIds.add(f.prompt_id);
        if (selected.length >= PROMPT_COUNT_MIN) break;
      }
    }
  }

  return { prompts: selected.slice(0, clampedCount), isFallback: false };
}

// ─── Learning Fallback Prompts ────────────────────────────────────────────────

/**
 * Return Learning Assistant fallback prompts (when profile / lesson unavailable).
 */
export function getLearningFallbackPrompts(count: number = PROMPT_COUNT_MAX): LearningRankedPrompt[] {
  const clampedCount = Math.min(Math.max(count, PROMPT_COUNT_MIN), PROMPT_COUNT_MAX);

  return LEARNING_FALLBACK_PROMPTS.slice(0, clampedCount).map((template, idx) => ({
    prompt_id: template.prompt_id,
    category: template.category,
    text: template.text,
    ranking_score: parseFloat((1.0 - idx * 0.1).toFixed(4)),
    reason: "static learning fallback (profile or lesson unavailable)",
    context_type: "general" as LearningPromptContextType,
  }));
}
