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
    display_text: "What's working in my {{goal}} journey?",
    text: "I want to reflect on my {{goal}} journey. Can you help me identify what's been working and where I should focus my energy next?",
    target_states: [1, 3],
    base_weight: 0.9,
  },
  {
    prompt_id: "goal_002",
    category: "goal",
    display_text: "What does progress look like for me this week?",
    text: "Help me define what meaningful progress toward my {{goal}} goal looks like this week — something concrete I can actually measure.",
    target_states: [1, 2, 3],
    base_weight: 0.85,
  },
  {
    prompt_id: "goal_003",
    category: "goal",
    display_text: "What small win can I build on today?",
    text: "What's one small but meaningful action I can take today to move forward on my {{goal}} path? I want something I can actually do in the next hour.",
    target_states: [1, 3, 4],
    base_weight: 0.8,
  },
  {
    prompt_id: "goal_004",
    category: "goal",
    display_text: "Where should I focus to accelerate my {{goal}}?",
    text: "If I want to accelerate my {{goal}} transformation, where should I focus first? What's the highest-leverage area right now?",
    target_states: [1],
    base_weight: 0.75,
  },
  {
    prompt_id: "goal_005",
    category: "goal",
    display_text: "What's blocking my {{goal}} progress right now?",
    text: "I'm working on {{goal}} but feel like something is holding me back. Can you help me identify and work through the main obstacle?",
    target_states: [2, 3, 4],
    base_weight: 0.7,
  },
];

// ─── Content Prompts (State 1 & 2 — quest / lesson recommendations) ───────────

const CONTENT_PROMPTS: PromptTemplate[] = [
  {
    prompt_id: "content_001",
    category: "content",
    display_text: "What should I take from {{quest}}?",
    text: "I've been working through {{quest}} — what are the most important insights I should be applying to my life right now?",
    target_states: [1, 3],
    base_weight: 0.9,
  },
  {
    prompt_id: "content_002",
    category: "content",
    display_text: "Help me pick up where I left off in {{quest}}",
    text: "I want to get back into {{quest}}. Can you remind me where I was and help me plan what to focus on in my next session?",
    target_states: [1, 2],
    base_weight: 0.85,
  },
  {
    prompt_id: "content_003",
    category: "content",
    display_text: "Which quest is right for where I am now?",
    text: "I'm looking for my next Mindvalley quest. Based on where I am in my journey, what would you recommend and why?",
    target_states: [2, 3, 4],
    base_weight: 0.75,
  },
  {
    prompt_id: "content_004",
    category: "content",
    display_text: "What topic should I go deeper on?",
    text: "I've been learning a lot this month — which topic from my recent lessons do you think I should go deeper on, and how?",
    target_states: [1],
    base_weight: 0.8,
  },
  {
    prompt_id: "content_005",
    category: "content",
    display_text: "Suggest something I can do in 10 minutes",
    text: "I only have about 10 minutes right now. What's the best short lesson or practice you'd recommend for where I am today?",
    target_states: [2, 4],
    base_weight: 0.7,
  },
];

// ─── Reflection Prompts (all states — journaling & self-assessment) ────────────

const REFLECTION_PROMPTS: PromptTemplate[] = [
  {
    prompt_id: "reflection_001",
    category: "reflection",
    display_text: "What have I learned about myself recently?",
    text: "Help me reflect — what have I likely been learning about myself through my recent lessons and experiences? What patterns might I be missing?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.85,
  },
  {
    prompt_id: "reflection_002",
    category: "reflection",
    display_text: "How aligned is my routine with my bigger vision?",
    text: "I want to honestly assess how aligned my daily routine is with my bigger vision. Can you help me think through this and identify any gaps?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.8,
  },
  {
    prompt_id: "reflection_003",
    category: "reflection",
    display_text: "What story am I telling myself that limits me?",
    text: "What's a limiting story or belief I might be carrying that's holding me back right now? Help me examine it honestly.",
    target_states: [2, 4],
    base_weight: 0.75,
  },
  {
    prompt_id: "reflection_004",
    category: "reflection",
    display_text: "What do I want to say I did 3 months from now?",
    text: "If I look back three months from now, what would I most want to have accomplished or changed? Help me clarify that vision.",
    target_states: [1, 3],
    base_weight: 0.78,
  },
  {
    prompt_id: "reflection_005",
    category: "reflection",
    display_text: "What does a great learning day look like for me?",
    text: "Help me design what an ideal growth and learning day looks like for me right now — one that I could realistically live.",
    target_states: [1, 2, 3, 4],
    base_weight: 0.7,
  },
];

// ─── Re-entry Prompts (State 2 & 4 — dormancy recovery, low friction) ─────────

const RE_ENTRY_PROMPTS: PromptTemplate[] = [
  {
    prompt_id: "reentry_001",
    category: "re_entry",
    display_text: "Help me ease back into learning",
    text: "I've been away for a bit and want to ease back into my learning journey without overwhelming myself. What's the best way to restart?",
    target_states: [2, 4],
    base_weight: 0.95,
  },
  {
    prompt_id: "reentry_002",
    category: "re_entry",
    display_text: "What's a gentle way to restart today?",
    text: "I haven't been consistent lately and don't want to put pressure on myself. What's a gentle, low-friction way to get back on track today?",
    target_states: [2, 4],
    base_weight: 0.9,
  },
  {
    prompt_id: "reentry_003",
    category: "re_entry",
    display_text: "Where should I restart my learning journey?",
    text: "I want to pick my learning back up from where I left off. Can you help me figure out the best place to restart and what to focus on?",
    target_states: [2, 4],
    base_weight: 0.85,
  },
  {
    prompt_id: "reentry_004",
    category: "re_entry",
    display_text: "How do I reignite my momentum in 10 minutes?",
    text: "I want to reignite my learning momentum but only have 10 minutes right now. What's the single best thing I can do to get the spark back?",
    target_states: [2, 3, 4],
    base_weight: 0.8,
  },
  {
    prompt_id: "reentry_005",
    category: "re_entry",
    display_text: "I need a fresh start — where do I begin?",
    text: "I feel like I need a fresh start with my learning. Help me figure out what to let go of and what to focus on from here.",
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
    display_text: "What stood out to me in {{lesson}}?",
    text: "I just watched {{lesson}}. Can you help me unpack what stood out most and why it might matter for where I am right now?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.95,
  },
  {
    prompt_id: "lesson_002",
    category: "reflection",
    display_text: "What from {{lesson}} can I act on today?",
    text: "From {{lesson}}, what's the one insight I should actually act on today — and what would that look like in practice?",
    target_states: [1, 2, 3, 4],
    base_weight: 0.90,
  },
  {
    prompt_id: "lesson_003",
    category: "reflection",
    display_text: "How does {{topic}} apply to my life right now?",
    text: "How does {{topic}} from {{lesson}} connect to what's actually happening in my life right now? Help me make it personal.",
    target_states: [1, 2, 3, 4],
    base_weight: 0.88,
  },
  {
    prompt_id: "lesson_004",
    category: "content",
    display_text: "Take me deeper into {{topic}}",
    text: "I want to go deeper on {{topic}} after finishing {{lesson}}. What should I explore next, and what questions should I be asking?",
    target_states: [1, 2],
    base_weight: 0.85,
  },
  {
    prompt_id: "lesson_005",
    category: "reflection",
    display_text: "How would I explain {{topic}} to a friend?",
    text: "Help me articulate {{topic}} from {{lesson}} simply — if I had to explain it to a friend in one sentence, what would I say?",
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
    display_text: "How does {{topic}} connect to my {{goal}} goal?",
    text: "How does {{topic}} from {{lesson}} connect to my goal of {{goal}}? Help me draw a clear line between what I just learned and where I'm trying to go.",
    target_states: [1, 2, 3, 4],
    base_weight: 0.95,
  },
  {
    prompt_id: "lesson_goal_002",
    category: "goal",
    display_text: "What's my next step toward {{goal}} after this lesson?",
    text: "Now that I've finished {{lesson}}, what's the most important next step I should take toward my {{goal}} goal?",
    target_states: [1, 2, 3],
    base_weight: 0.90,
  },
  {
    prompt_id: "lesson_goal_003",
    category: "goal",
    display_text: "How can I apply {{topic}} to my {{goal}} journey this week?",
    text: "I want to apply {{topic}} from {{lesson}} to my {{goal}} journey this week. What's a practical way to do that?",
    target_states: [1, 3],
    base_weight: 0.88,
  },
  {
    prompt_id: "lesson_goal_004",
    category: "goal",
    display_text: "What belief from {{topic}} could accelerate my {{goal}}?",
    text: "What's one belief or mindset shift from {{topic}} that could directly accelerate my progress toward {{goal}}?",
    target_states: [1, 2],
    base_weight: 0.85,
  },
  {
    prompt_id: "lesson_goal_005",
    category: "goal",
    display_text: "Which part of {{lesson}} matters most for my {{goal}}?",
    text: "I'm focused on {{goal}} — which part of {{lesson}} was most relevant to that, and how should I build on it?",
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
