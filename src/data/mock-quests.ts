/**
 * mock-quests.ts — Quest catalogue for Sprint 7 Predictive Path Continuity.
 *
 * 20 quests spread across 5 goal categories:
 *   habit_builder, mindset, health, relationships, career
 *
 * Provides helper functions used by the recommendation engine:
 *   getQuestsByCategory    — filter quests by goal category
 *   getRecommendedQuests   — top quests excluding already-completed ones
 *
 * Sofia fixture — demo member used for acceptance-criteria testing:
 *   - Goal category: habit_builder
 *   - Completed quests: hb_q001, hb_q002
 *   - Current quest: hb_q003 at 82% completion (triggers "almost there" prompt)
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface QuestMeta {
  /** Unique quest identifier */
  id: string;
  /** Human-readable quest title */
  title: string;
  /** Goal category this quest belongs to */
  category: "habit_builder" | "mindset" | "health" | "relationships" | "career";
  /** Total number of lessons in the quest */
  lesson_count: number;
  /** One-sentence description of the quest */
  description: string;
  /** Relevance weight for recommendation ranking (higher = surfaced first within category) */
  relevance_weight: number;
}

// ─── Quest Catalogue ──────────────────────────────────────────────────────────

export const MOCK_QUESTS: QuestMeta[] = [
  // ── habit_builder (4 quests) ──────────────────────────────────────────────
  {
    id: "hb_q001",
    title: "The Habit of Ferocity",
    category: "habit_builder",
    lesson_count: 20,
    description: "Build atomic daily habits that stack into extraordinary long-term results.",
    relevance_weight: 1.0,
  },
  {
    id: "hb_q002",
    title: "Becoming Focused & Indistractable",
    category: "habit_builder",
    lesson_count: 28,
    description: "Eliminate distractions at the source and build unbreakable deep-work rituals.",
    relevance_weight: 0.95,
  },
  {
    id: "hb_q003",
    title: "Morning Ritual Mastery",
    category: "habit_builder",
    lesson_count: 15,
    description: "Design a morning routine that primes your mind and body for peak performance every day.",
    relevance_weight: 0.9,
  },
  {
    id: "hb_q004",
    title: "The 6-Phase Meditation Practice",
    category: "habit_builder",
    lesson_count: 18,
    description: "Commit to a daily six-phase practice that blends gratitude, forgiveness, and vision.",
    relevance_weight: 0.85,
  },

  // ── mindset (4 quests) ────────────────────────────────────────────────────
  {
    id: "ms_q001",
    title: "Be Extraordinary",
    category: "mindset",
    lesson_count: 35,
    description: "Unlock your extraordinary potential by rewiring the beliefs that limit you.",
    relevance_weight: 1.0,
  },
  {
    id: "ms_q002",
    title: "Lifebook Online",
    category: "mindset",
    lesson_count: 40,
    description: "Craft a vivid vision across the 12 dimensions of a fulfilling life.",
    relevance_weight: 0.95,
  },
  {
    id: "ms_q003",
    title: "The Silva Ultramind System",
    category: "mindset",
    lesson_count: 30,
    description: "Tap into your alpha brainwaves to accelerate intuition, creativity, and manifestation.",
    relevance_weight: 0.9,
  },
  {
    id: "ms_q004",
    title: "Duality",
    category: "mindset",
    lesson_count: 42,
    description: "Integrate your light and shadow self to unlock wholeness and authentic power.",
    relevance_weight: 0.85,
  },

  // ── health (4 quests) ─────────────────────────────────────────────────────
  {
    id: "hl_q001",
    title: "WildFit",
    category: "health",
    lesson_count: 36,
    description: "Understand the human diet your biology was designed for and transform your relationship with food.",
    relevance_weight: 1.0,
  },
  {
    id: "hl_q002",
    title: "The Longevity Blueprint",
    category: "health",
    lesson_count: 29,
    description: "Science-backed strategies to add healthy years to your life through sleep, movement, and recovery.",
    relevance_weight: 0.95,
  },
  {
    id: "hl_q003",
    title: "10x Fitness",
    category: "health",
    lesson_count: 22,
    description: "Achieve maximum fitness gains in minimum time using evidence-based training principles.",
    relevance_weight: 0.9,
  },
  {
    id: "hl_q004",
    title: "The M Word — Meditation",
    category: "health",
    lesson_count: 22,
    description: "Build a sustainable meditation practice that reduces stress and elevates your baseline energy.",
    relevance_weight: 0.85,
  },

  // ── relationships (4 quests) ──────────────────────────────────────────────
  {
    id: "re_q001",
    title: "Love & Intimacy Mastery",
    category: "relationships",
    lesson_count: 25,
    description: "Create deep romantic connection through vulnerability, communication, and intentional love.",
    relevance_weight: 1.0,
  },
  {
    id: "re_q002",
    title: "The Art of Emotional Intelligence",
    category: "relationships",
    lesson_count: 24,
    description: "Master the five pillars of emotional intelligence to strengthen every relationship in your life.",
    relevance_weight: 0.95,
  },
  {
    id: "re_q003",
    title: "Speak & Inspire",
    category: "relationships",
    lesson_count: 22,
    description: "Communicate with clarity, confidence, and charisma to move hearts and influence outcomes.",
    relevance_weight: 0.9,
  },
  {
    id: "re_q004",
    title: "Conscious Parenting Mastery",
    category: "relationships",
    lesson_count: 30,
    description: "Raise emotionally whole children by becoming a more present, connected, and conscious parent.",
    relevance_weight: 0.85,
  },

  // ── career (4 quests) ─────────────────────────────────────────────────────
  {
    id: "ca_q001",
    title: "The Financial Abundance Journey",
    category: "career",
    lesson_count: 32,
    description: "Rewrite your money story and build multiple income streams aligned with your authentic purpose.",
    relevance_weight: 1.0,
  },
  {
    id: "ca_q002",
    title: "Super Reading",
    category: "career",
    lesson_count: 18,
    description: "Triple your reading speed and retention to absorb knowledge faster than ever before.",
    relevance_weight: 0.95,
  },
  {
    id: "ca_q003",
    title: "Unlimited Abundance",
    category: "career",
    lesson_count: 28,
    description: "Clear the subconscious blocks that prevent you from receiving wealth, opportunity, and success.",
    relevance_weight: 0.9,
  },
  {
    id: "ca_q004",
    title: "Mastering Authentic Networking",
    category: "career",
    lesson_count: 16,
    description: "Build a powerful personal network by showing up authentically and creating genuine value.",
    relevance_weight: 0.85,
  },
];

// ─── Accessors ────────────────────────────────────────────────────────────────

/**
 * Return all quests belonging to a given goal category.
 * Sorted by relevance_weight descending.
 */
export function getQuestsByCategory(
  category: QuestMeta["category"]
): QuestMeta[] {
  return MOCK_QUESTS.filter((q) => q.category === category).sort(
    (a, b) => b.relevance_weight - a.relevance_weight
  );
}

/**
 * Return up to `limit` recommended quests for a member.
 *
 * Rules:
 * 1. Anchored to goalCategory — only quests from that category are returned.
 * 2. Excludes any quest whose id appears in completedQuestIds.
 * 3. Sorted by relevance_weight descending.
 * 4. Returns exactly `limit` quests (or fewer if the catalogue is exhausted).
 *
 * @param completedQuestIds - IDs of quests the member has already completed
 * @param goalCategory      - Member's declared primary goal category
 * @param limit             - Maximum number of recommendations (default: 3)
 */
export function getRecommendedQuests(
  completedQuestIds: string[],
  goalCategory: QuestMeta["category"],
  limit = 3
): QuestMeta[] {
  const completedSet = new Set(completedQuestIds);
  return getQuestsByCategory(goalCategory)
    .filter((q) => !completedSet.has(q.id))
    .slice(0, limit);
}

// ─── Demo Member: Sofia ───────────────────────────────────────────────────────

/**
 * Sofia — demo member fixture for Sprint 7 acceptance-criteria testing.
 *
 * Persona: habit builder
 * Completed quests: hb_q001, hb_q002
 * Current quest:    hb_q003 (Morning Ritual Mastery) at 82% completion
 */
export const SOFIA_FIXTURE = {
  member_id: "sofia_demo",
  goal_category: "habit_builder" as const,
  completed_quest_ids: ["hb_q001", "hb_q002"],
  current_quest_id: "hb_q003",
  current_quest_completion_pct: 82,
};
