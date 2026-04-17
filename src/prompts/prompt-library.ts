/**
 * Eve Trainer — Prompt Template Library
 *
 * 4 categories × 5 templates = 20 templates total (general library).
 * Plus: lesson-specific and goal-anchored templates added in Sprint 3.
 *
 * Categories:
 *   goal       — Connect activity to the member's declared goal
 *   content    — Recommend specific quests or lessons
 *   reflection — Journaling / self-assessment prompts
 *   re_entry   — Low-friction re-engagement for dormant members
 *
 * Design principles:
 * - Templates include {{goal}}, {{quest}}, {{lesson}}, and {{topic}}
 *   placeholders for personalisation.
 *   The ranking layer replaces them with live member data before surfacing.
 * - target_states scopes each prompt to the member states it is optimised for.
 * - base_weight breaks ties within a category when all ranking signals are equal.
 */

import type { PromptTemplate, PromptCategory } from "../types/prompts";
import type { MemberStateValue } from "../types/index";

// ─── Goal Prompts (State 1 & 3 — connect activity to declared goal) ───────────

const GOAL_PROMPTS: PromptTemplate[] = [
  {
    prompt_id: "goal_001",
    category: "goal",
    text: "How is your {{goal}} journey going? Let's explore what's working for you.",
    target_states: [1, 3],
    base_weight: 0.9,
  },
  {
    prompt_id: "goal_002",
    category: "goal",
    text: "You set a {{goal}} goal — what does progress look like for you this week?",
    target_states: [1, 2, 3],
    base_weight: 0.85,
  },
  {
    prompt_id: "goal_003",
    category: "goal",
    text: "What's one small win you can celebrate today on your path to {{goal}}?",
    target_states: [1, 3, 4],
    base_weight: 0.8,
  },
  {
    prompt_id: "goal_004",
    category: "goal",
    text: "If you could accelerate your {{goal}} transformation, where would you focus first?",
    target_states: [1],
    base_weight: 0.75,
  },
  {
    prompt_id: "goal_005",
    category: "goal",
    text: "Your goal around {{goal}} is important. What obstacle is in your way right now?",
    target_states: [2, 3, 4],
    base_weight: 0.7,
  },
];

// ─── Content Prompts (State 1 & 2 — quest / lesson recommendations) ───────────

const CONTENT_PROMPTS: PromptTemplate[] = [
  {
    prompt_id: "content_001",
    category: "content",
    text: "You're making great progress in {{quest}}. What insight has surprised you most?",
    target_states: [1, 3],
    base_weight: 0.9,
  },
  {
    prompt_id: "content_002",
    category: "content",
    text: "Ready to continue {{quest}}? Let's pick up where you left off.",
    target_states: [1, 2],
    base_weight: 0.85,
  },
  {
    prompt_id: "content_003",
    category: "content",
    text: "Which Mindvalley quest are you curious about? I can help you find the right fit.",
    target_states: [2, 3, 4],
    base_weight: 0.75,
  },
  {
    prompt_id: "content_004",
    category: "content",
    text: "You've completed several lessons this month. Which topic do you want to go deeper on?",
    target_states: [1],
    base_weight: 0.8,
  },
  {
    prompt_id: "content_005",
    category: "content",
    text: "Let me suggest a short lesson that takes under 10 minutes — perfect for today.",
    target_states: [2, 4],
    base_weight: 0.7,
  },
];

// ─── Reflection Prompts (all states — journaling & self-assessment) ────────────

const REFLECTION_PROMPTS: PromptTemplate[] = [
  {
    prompt_id: "reflection_001",
    category: "reflection",
    text: "Take a moment: what's one thing you've learned about yourself recently?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.85,
  },
  {
    prompt_id: "reflection_002",
    category: "reflection",
    text: "On a scale of 1–10, how aligned does your daily routine feel with your bigger vision?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.8,
  },
  {
    prompt_id: "reflection_003",
    category: "reflection",
    text: "What's the story you keep telling yourself that might be holding you back?",
    target_states: [2, 4],
    base_weight: 0.75,
  },
  {
    prompt_id: "reflection_004",
    category: "reflection",
    text: "Three months from now, what do you want to look back and say you did?",
    target_states: [1, 3],
    base_weight: 0.78,
  },
  {
    prompt_id: "reflection_005",
    category: "reflection",
    text: "What does a great day of growth and learning look like for you right now?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.7,
  },
];

// ─── Re-entry Prompts (State 2 & 4 — dormancy recovery, low friction) ─────────

const RE_ENTRY_PROMPTS: PromptTemplate[] = [
  {
    prompt_id: "reentry_001",
    category: "re_entry",
    text: "Welcome back! A lot has changed — what brought you back today?",
    target_states: [2, 4],
    base_weight: 0.95,
  },
  {
    prompt_id: "reentry_002",
    category: "re_entry",
    text: "It's been a little while. No pressure — want to ease back in with a 5-minute practice?",
    target_states: [2, 4],
    base_weight: 0.9,
  },
  {
    prompt_id: "reentry_003",
    category: "re_entry",
    text: "Your learning journey is still here, exactly where you left it. Where would you like to restart?",
    target_states: [2, 4],
    base_weight: 0.85,
  },
  {
    prompt_id: "reentry_004",
    category: "re_entry",
    text: "What's one thing you can do in the next 10 minutes to reignite your momentum?",
    target_states: [2, 3, 4],
    base_weight: 0.8,
  },
  {
    prompt_id: "reentry_005",
    category: "re_entry",
    text: "Sometimes a fresh start is all we need. What would you like to focus on right now?",
    target_states: [4],
    base_weight: 0.75,
  },
];

// ─── Combined Library ─────────────────────────────────────────────────────────

export const PROMPT_LIBRARY: PromptTemplate[] = [
  ...GOAL_PROMPTS,
  ...CONTENT_PROMPTS,
  ...REFLECTION_PROMPTS,
  ...RE_ENTRY_PROMPTS,
];

// ─── Static Fallback Prompts ──────────────────────────────────────────────────

/**
 * Static fallback prompts shown when the Learner Profile API is unavailable.
 * These are generic enough to be appropriate for any member state.
 */
export const FALLBACK_PROMPTS: PromptTemplate[] = [
  {
    prompt_id: "fallback_001",
    category: "reflection",
    text: "What's on your mind today? I'm here to help you move forward.",
    target_states: [1, 2, 3, 4],
    base_weight: 1.0,
  },
  {
    prompt_id: "fallback_002",
    category: "content",
    text: "Want to explore a Mindvalley quest? Tell me what area of life you want to grow.",
    target_states: [1, 2, 3, 4],
    base_weight: 0.9,
  },
  {
    prompt_id: "fallback_003",
    category: "goal",
    text: "Let's talk about what transformation means to you right now.",
    target_states: [1, 2, 3, 4],
    base_weight: 0.8,
  },
];

// ─── Sprint 3: Lesson-Specific Prompt Templates ──────────────────────────────

/**
 * Lesson-specific prompts — anchored to the lesson the member just watched.
 * Use {{lesson}} for the lesson title and {{topic}} for the lesson topic.
 *
 * These are surfaced by the /learning-prompts endpoint when a lesson_id
 * is provided in the query string.
 */
export const LESSON_SPECIFIC_PROMPTS: PromptTemplate[] = [
  {
    prompt_id: "lesson_001",
    category: "reflection",
    text: "What stood out to you in {{lesson}}?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.95,
  },
  {
    prompt_id: "lesson_002",
    category: "reflection",
    text: "What's one insight from {{lesson}} you want to act on today?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.90,
  },
  {
    prompt_id: "lesson_003",
    category: "reflection",
    text: "How does {{topic}} connect to what's happening in your life right now?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.88,
  },
  {
    prompt_id: "lesson_004",
    category: "content",
    text: "You just finished {{lesson}}. Want to explore more about {{topic}} with Eve?",
    target_states: [1, 2],
    base_weight: 0.85,
  },
  {
    prompt_id: "lesson_005",
    category: "reflection",
    text: "If you had to explain {{topic}} to a friend in one sentence, what would you say?",
    target_states: [1, 3],
    base_weight: 0.82,
  },
];

// ─── Sprint 3: Goal-Anchored Learning Prompts ─────────────────────────────────

/**
 * Goal-anchored prompts for the Learning Assistant — bridge lesson content
 * to the member's declared primary goal.
 *
 * Use {{lesson}} for the lesson title, {{topic}} for the topic,
 * and {{goal}} for the member's primary goal category.
 */
export const GOAL_ANCHORED_LESSON_PROMPTS: PromptTemplate[] = [
  {
    prompt_id: "lesson_goal_001",
    category: "goal",
    text: "How does {{topic}} connect to your goal of {{goal}}?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.95,
  },
  {
    prompt_id: "lesson_goal_002",
    category: "goal",
    text: "After {{lesson}}, what's the next step you'll take toward {{goal}}?",
    target_states: [1, 2, 3],
    base_weight: 0.90,
  },
  {
    prompt_id: "lesson_goal_003",
    category: "goal",
    text: "How can you apply {{topic}} to your {{goal}} journey this week?",
    target_states: [1, 3],
    base_weight: 0.88,
  },
  {
    prompt_id: "lesson_goal_004",
    category: "goal",
    text: "What's one belief about {{topic}} that could accelerate your {{goal}} goal?",
    target_states: [1, 2],
    base_weight: 0.85,
  },
  {
    prompt_id: "lesson_goal_005",
    category: "goal",
    text: "You're working on {{goal}} — which part of {{lesson}} felt most relevant?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.82,
  },
];

// ─── Learning-Specific Fallback Prompts ───────────────────────────────────────

/**
 * Fallback prompts for the Learning Assistant when profile or lesson data
 * is unavailable. These are generic enough to always feel appropriate.
 */
export const LEARNING_FALLBACK_PROMPTS: PromptTemplate[] = [
  {
    prompt_id: "learn_fallback_001",
    category: "reflection",
    text: "What's on your mind after this lesson? I'm here to help you go deeper.",
    target_states: [1, 2, 3, 4],
    base_weight: 1.0,
  },
  {
    prompt_id: "learn_fallback_002",
    category: "goal",
    text: "How does what you just learned connect to what matters most to you right now?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.9,
  },
  {
    prompt_id: "learn_fallback_003",
    category: "content",
    text: "What would you like to explore further about this topic with Eve?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.8,
  },
];

// ─── Accessors ────────────────────────────────────────────────────────────────

/**
 * Return all prompt templates that target a given member state.
 * If no state is provided, return all templates.
 */
export function getPromptsForState(state: MemberStateValue): PromptTemplate[] {
  return PROMPT_LIBRARY.filter((p) => p.target_states.includes(state));
}

/**
 * Return templates filtered by both state and category.
 */
export function getPromptsByCategory(
  state: MemberStateValue,
  category: PromptCategory
): PromptTemplate[] {
  return PROMPT_LIBRARY.filter(
    (p) => p.target_states.includes(state) && p.category === category
  );
}

/**
 * Look up a single template by its stable ID.
 * Returns undefined if not found (also checks fallback pool).
 */
export function getPromptById(promptId: string): PromptTemplate | undefined {
  return (
    PROMPT_LIBRARY.find((p) => p.prompt_id === promptId) ??
    FALLBACK_PROMPTS.find((p) => p.prompt_id === promptId)
  );
}

/**
 * Replace {{goal}}, {{quest}}, {{lesson}}, and {{topic}} placeholders
 * in a prompt template's text.
 *
 * @param template    - The prompt template
 * @param goal        - The member's primary_goal_category (or null)
 * @param quest       - The current quest title (or null)
 * @param lessonTitle - The lesson title (or null) — Sprint 3
 * @param lessonTopic - The lesson topic (or null) — Sprint 3
 * @returns Personalised prompt text
 */
export function personalisePromptText(
  template: PromptTemplate,
  goal: string | null,
  quest: string | null,
  lessonTitle: string | null = null,
  lessonTopic: string | null = null
): string {
  let text = template.text;

  const goalLabel = goal ? goal.charAt(0).toUpperCase() + goal.slice(1) : "your goals";
  const questLabel = quest ?? "your current quest";
  const lessonLabel = lessonTitle ?? "this lesson";
  const topicLabel = lessonTopic ?? "this topic";

  text = text.replace(/\{\{goal\}\}/g, goalLabel);
  text = text.replace(/\{\{quest\}\}/g, questLabel);
  text = text.replace(/\{\{lesson\}\}/g, lessonLabel);
  text = text.replace(/\{\{topic\}\}/g, topicLabel);

  return text;
}

/**
 * Look up a prompt template from all pools: general, lesson-specific,
 * goal-anchored lesson, general fallback, and learning fallback.
 * Returns undefined if not found.
 */
export function getAnyPromptById(promptId: string): PromptTemplate | undefined {
  return (
    PROMPT_LIBRARY.find((p) => p.prompt_id === promptId) ??
    LESSON_SPECIFIC_PROMPTS.find((p) => p.prompt_id === promptId) ??
    GOAL_ANCHORED_LESSON_PROMPTS.find((p) => p.prompt_id === promptId) ??
    FALLBACK_PROMPTS.find((p) => p.prompt_id === promptId) ??
    LEARNING_FALLBACK_PROMPTS.find((p) => p.prompt_id === promptId)
  );
}
