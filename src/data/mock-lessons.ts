/**
 * mock-lessons.ts — 20 lesson fixtures for Learning Assistant prompt generation.
 *
 * Each lesson maps to one of the quests in the mock member data.
 * Used by the learning-prompts endpoint to look up lesson metadata
 * and generate lesson-specific prompts.
 *
 * Quests referenced (from mock-members.ts QUEST_LIBRARY):
 *   q001 Be Extraordinary (performance)
 *   q002 Lifebook Online (mindfulness)
 *   q003 The Silva Ultramind System (mindfulness)
 *   q004 Becoming Focused & Indistractable (performance)
 *   q006 Duality (spirituality)
 *   q007 WildFit (health)
 *   q008 The Financial Abundance Journey (wealth)
 *   q010 Love & Intimacy Mastery (relationships)
 *   q012 The Art of Emotional Intelligence (mindfulness)
 *   q014 The Habit of Ferocity (performance)
 */

import type { LessonMeta } from "../types/learning";

export const MOCK_LESSONS: LessonMeta[] = [
  // ── Be Extraordinary (q001) ────────────────────────────────────────────────
  {
    lesson_id: "l001",
    title: "Discovering Your Extraordinary Potential",
    topic: "unlocking potential",
    quest_id: "q001",
    quest_title: "Be Extraordinary",
    quest_category: "performance",
  },
  {
    lesson_id: "l002",
    title: "The Power of Belief Systems",
    topic: "limiting beliefs",
    quest_id: "q001",
    quest_title: "Be Extraordinary",
    quest_category: "performance",
  },

  // ── Lifebook Online (q002) ────────────────────────────────────────────────
  {
    lesson_id: "l003",
    title: "Crafting Your Life Vision",
    topic: "life vision",
    quest_id: "q002",
    quest_title: "Lifebook Online",
    quest_category: "mindfulness",
  },
  {
    lesson_id: "l004",
    title: "The Twelve Categories of Life",
    topic: "life categories",
    quest_id: "q002",
    quest_title: "Lifebook Online",
    quest_category: "mindfulness",
  },

  // ── The Silva Ultramind System (q003) ────────────────────────────────────
  {
    lesson_id: "l005",
    title: "Entering the Alpha State",
    topic: "meditation and alpha brainwaves",
    quest_id: "q003",
    quest_title: "The Silva Ultramind System",
    quest_category: "mindfulness",
  },
  {
    lesson_id: "l006",
    title: "Manifesting with the Three Fingers Technique",
    topic: "manifestation",
    quest_id: "q003",
    quest_title: "The Silva Ultramind System",
    quest_category: "mindfulness",
  },

  // ── Becoming Focused & Indistractable (q004) ─────────────────────────────
  {
    lesson_id: "l007",
    title: "Understanding the Distraction Trap",
    topic: "focus and distraction",
    quest_id: "q004",
    quest_title: "Becoming Focused & Indistractable",
    quest_category: "performance",
  },
  {
    lesson_id: "l008",
    title: "Time-Boxing Your Deep Work",
    topic: "time management",
    quest_id: "q004",
    quest_title: "Becoming Focused & Indistractable",
    quest_category: "performance",
  },

  // ── Duality (q006) ────────────────────────────────────────────────────────
  {
    lesson_id: "l009",
    title: "The Light and Shadow Self",
    topic: "shadow work",
    quest_id: "q006",
    quest_title: "Duality",
    quest_category: "spirituality",
  },
  {
    lesson_id: "l010",
    title: "Integrating Your Whole Self",
    topic: "self-integration",
    quest_id: "q006",
    quest_title: "Duality",
    quest_category: "spirituality",
  },

  // ── WildFit (q007) ────────────────────────────────────────────────────────
  {
    lesson_id: "l011",
    title: "The Human Diet — What We're Designed to Eat",
    topic: "nutrition fundamentals",
    quest_id: "q007",
    quest_title: "WildFit",
    quest_category: "health",
  },
  {
    lesson_id: "l012",
    title: "Spring: The Elimination Phase",
    topic: "food elimination",
    quest_id: "q007",
    quest_title: "WildFit",
    quest_category: "health",
  },

  // ── The Financial Abundance Journey (q008) ───────────────────────────────
  {
    lesson_id: "l013",
    title: "Money Stories That Run Your Life",
    topic: "money mindset",
    quest_id: "q008",
    quest_title: "The Financial Abundance Journey",
    quest_category: "wealth",
  },
  {
    lesson_id: "l014",
    title: "Creating Multiple Streams of Income",
    topic: "financial strategy",
    quest_id: "q008",
    quest_title: "The Financial Abundance Journey",
    quest_category: "wealth",
  },

  // ── Love & Intimacy Mastery (q010) ───────────────────────────────────────
  {
    lesson_id: "l015",
    title: "The Language of Love",
    topic: "love languages",
    quest_id: "q010",
    quest_title: "Love & Intimacy Mastery",
    quest_category: "relationships",
  },
  {
    lesson_id: "l016",
    title: "Vulnerability and Deep Connection",
    topic: "vulnerability",
    quest_id: "q010",
    quest_title: "Love & Intimacy Mastery",
    quest_category: "relationships",
  },

  // ── The Art of Emotional Intelligence (q012) ─────────────────────────────
  {
    lesson_id: "l017",
    title: "Recognising Your Emotional Triggers",
    topic: "emotional triggers",
    quest_id: "q012",
    quest_title: "The Art of Emotional Intelligence",
    quest_category: "mindfulness",
  },
  {
    lesson_id: "l018",
    title: "Empathy as a Superpower",
    topic: "empathy",
    quest_id: "q012",
    quest_title: "The Art of Emotional Intelligence",
    quest_category: "mindfulness",
  },

  // ── The Habit of Ferocity (q014) ─────────────────────────────────────────
  {
    lesson_id: "l019",
    title: "Morning Rituals That Drive Peak Performance",
    topic: "morning routines",
    quest_id: "q014",
    quest_title: "The Habit of Ferocity",
    quest_category: "performance",
  },
  {
    lesson_id: "l020",
    title: "The Identity Shift: Becoming the Best Version of Yourself",
    topic: "identity and habits",
    quest_id: "q014",
    quest_title: "The Habit of Ferocity",
    quest_category: "performance",
  },
];

// ─── Accessors ────────────────────────────────────────────────────────────────

/**
 * Look up lesson metadata by lesson_id.
 * Returns undefined if not found.
 */
export function getLessonById(lessonId: string): LessonMeta | undefined {
  return MOCK_LESSONS.find((l) => l.lesson_id === lessonId);
}

/**
 * Look up all lessons for a given quest_id.
 */
export function getLessonsForQuest(questId: string): LessonMeta[] {
  return MOCK_LESSONS.filter((l) => l.quest_id === questId);
}

/**
 * Find lesson metadata by lesson_id; fall back to first lesson of the quest
 * if the exact lesson_id is not found (e.g. lesson not yet in mock data).
 */
export function resolveLessonMeta(
  lessonId: string | null,
  questId: string | null
): LessonMeta | null {
  if (lessonId) {
    const byId = getLessonById(lessonId);
    if (byId) return byId;
  }
  if (questId) {
    const byQuest = getLessonsForQuest(questId);
    if (byQuest.length > 0) return byQuest[0];
  }
  return null;
}
