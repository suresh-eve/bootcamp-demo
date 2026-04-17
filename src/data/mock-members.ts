/**
 * mock-members.ts — 100 sample member fixtures for algorithm testing.
 *
 * Generation strategy: members are spread across all four learner states
 * to give meaningful test coverage of the intent confidence and momentum
 * classification algorithms.
 *
 * Distribution (roughly):
 *   State 1 (High intent / High momentum): ~25 members
 *   State 2 (High intent / Low momentum):  ~25 members
 *   State 3 (Low intent  / High momentum): ~25 members
 *   State 4 (Low intent  / Low momentum):  ~25 members
 *
 * Each group also has variation in edge cases:
 *   - Members with no goal declarations (B3 workaround path)
 *   - Members with very old goal declarations (recency decay)
 *   - Members with partial signals only (fallback rule path)
 *   - Members in early onboarding vs long-tenured
 */

import type { RawMemberData, GoalDeclaration, LessonRecord, QuestRecord } from "../types/index";

// ─── Seed Helpers ─────────────────────────────────────────────────────────────

const GOAL_CATEGORIES = [
  "health",
  "wealth",
  "relationships",
  "mindfulness",
  "performance",
  "creativity",
  "spirituality",
];

const QUEST_LIBRARY: Array<{ quest_id: string; title: string; category: string; total_lessons: number }> = [
  { quest_id: "q001", title: "Be Extraordinary", category: "performance", total_lessons: 35 },
  { quest_id: "q002", title: "Lifebook Online", category: "mindfulness", total_lessons: 40 },
  { quest_id: "q003", title: "The Silva Ultramind System", category: "mindfulness", total_lessons: 30 },
  { quest_id: "q004", title: "Becoming Focused & Indistractable", category: "performance", total_lessons: 28 },
  { quest_id: "q005", title: "The M Word — Meditation", category: "mindfulness", total_lessons: 22 },
  { quest_id: "q006", title: "Duality", category: "spirituality", total_lessons: 42 },
  { quest_id: "q007", title: "WildFit", category: "health", total_lessons: 36 },
  { quest_id: "q008", title: "The Financial Abundance Journey", category: "wealth", total_lessons: 32 },
  { quest_id: "q009", title: "The Longevity Blueprint", category: "health", total_lessons: 29 },
  { quest_id: "q010", title: "Love & Intimacy Mastery", category: "relationships", total_lessons: 25 },
  { quest_id: "q011", title: "Super Reading", category: "performance", total_lessons: 18 },
  { quest_id: "q012", title: "The Art of Emotional Intelligence", category: "mindfulness", total_lessons: 24 },
  { quest_id: "q013", title: "Unlimited Abundance", category: "wealth", total_lessons: 28 },
  { quest_id: "q014", title: "The Habit of Ferocity", category: "performance", total_lessons: 20 },
  { quest_id: "q015", title: "Speak & Inspire", category: "creativity", total_lessons: 22 },
];

/** Deterministic pseudo-random number using a simple LCG seeded by index */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function pickFrom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

// ─── Member Builder ───────────────────────────────────────────────────────────

interface MemberSpec {
  index: number;
  /** Whether to force this member into a stuck-point scenario (7+ days on one lesson) */
  forceStuck?: boolean;
  /**
   * Target quadrant for this member:
   *   "s1" = high intent + high momentum
   *   "s2" = high intent + low momentum
   *   "s3" = low intent  + high momentum
   *   "s4" = low intent  + low momentum
   *   "edge" = edge case (sparse signals, new member, etc.)
   */
  quadrant: "s1" | "s2" | "s3" | "s4" | "edge";
}

function buildMember(spec: MemberSpec): RawMemberData {
  const { index, quadrant } = spec;
  const rng = seededRandom(index * 31337 + 42);
  const memberId = `member_${String(index + 1).padStart(3, "0")}`;

  // ── Intent parameters by quadrant ──────────────────────────────────────────
  let hasGoal: boolean;
  let goalAgeDays: number;
  let eveConvFreq30d: number;
  let promptCtr: number;

  // ── Engagement parameters by quadrant ─────────────────────────────────────
  let streakDays: number;
  let lastActiveDaysAgo: number;
  let sessionFreqWeekly: number;
  let totalActiveDays: number;

  // ── Learning parameters by quadrant ───────────────────────────────────────
  let lessons30d: number;
  let questsCompleted: number;

  switch (quadrant) {
    case "s1": // High intent + High momentum
      hasGoal = true;
      goalAgeDays = Math.floor(rng() * 30); // Recent goal
      eveConvFreq30d = Math.floor(rng() * 6) + 5; // 5–10
      promptCtr = parseFloat((rng() * 0.4 + 0.5).toFixed(2)); // 0.50–0.90
      streakDays = Math.floor(rng() * 20) + 10; // 10–30
      lastActiveDaysAgo = Math.floor(rng() * 2); // 0–1 days ago
      sessionFreqWeekly = parseFloat((rng() * 3 + 4).toFixed(1)); // 4–7
      totalActiveDays = Math.floor(rng() * 150) + 50;
      lessons30d = Math.floor(rng() * 8) + 8; // 8–16
      questsCompleted = Math.floor(rng() * 4) + 2;
      break;

    case "s2": // High intent + Low momentum
      hasGoal = true;
      goalAgeDays = Math.floor(rng() * 60); // Moderately recent
      eveConvFreq30d = Math.floor(rng() * 5) + 3; // 3–7
      promptCtr = parseFloat((rng() * 0.3 + 0.35).toFixed(2)); // 0.35–0.65
      streakDays = Math.floor(rng() * 3); // 0–2 (low streak)
      lastActiveDaysAgo = Math.floor(rng() * 6) + 3; // 3–8 days (drifting)
      sessionFreqWeekly = parseFloat((rng() * 1.5 + 0.5).toFixed(1)); // 0.5–2
      totalActiveDays = Math.floor(rng() * 100) + 20;
      lessons30d = Math.floor(rng() * 3) + 1; // 1–3
      questsCompleted = Math.floor(rng() * 3);
      break;

    case "s3": // Low intent + High momentum
      hasGoal = rng() > 0.4; // 60% have a goal but it's old/irrelevant
      goalAgeDays = hasGoal ? Math.floor(rng() * 200) + 90 : 999; // Old declaration
      eveConvFreq30d = Math.floor(rng() * 2); // 0–1 (low Eve engagement)
      promptCtr = parseFloat((rng() * 0.2).toFixed(2)); // 0–0.20
      streakDays = Math.floor(rng() * 15) + 8; // 8–22
      lastActiveDaysAgo = Math.floor(rng() * 2); // Recent activity
      sessionFreqWeekly = parseFloat((rng() * 3 + 3).toFixed(1)); // 3–6
      totalActiveDays = Math.floor(rng() * 200) + 80;
      lessons30d = Math.floor(rng() * 8) + 5; // 5–12 (active learner)
      questsCompleted = Math.floor(rng() * 6) + 3;
      break;

    case "s4": // Low intent + Low momentum
      hasGoal = rng() > 0.65; // 35% have a goal (stale)
      goalAgeDays = hasGoal ? Math.floor(rng() * 300) + 120 : 999; // Very old
      eveConvFreq30d = 0; // No Eve engagement
      promptCtr = 0; // No prompt interaction
      streakDays = 0;
      lastActiveDaysAgo = Math.floor(rng() * 60) + 14; // 14–74 days ago
      sessionFreqWeekly = parseFloat((rng() * 0.5).toFixed(1)); // 0–0.5
      totalActiveDays = Math.floor(rng() * 80) + 5;
      lessons30d = 0;
      questsCompleted = Math.floor(rng() * 2);
      break;

    case "edge":
    default:
      // Edge cases: new members, zero signals, maximum values, etc.
      // Mix of different profiles to stress-test the algorithm
      const edgeType = index % 5;
      if (edgeType === 0) {
        // Brand new member — just signed up, only FTU goal
        hasGoal = true;
        goalAgeDays = 0;
        eveConvFreq30d = 0;
        promptCtr = 0;
        streakDays = 1;
        lastActiveDaysAgo = 0;
        sessionFreqWeekly = 1;
        totalActiveDays = 1;
        lessons30d = 1;
        questsCompleted = 0;
      } else if (edgeType === 1) {
        // Ghost member — never came back after signup
        hasGoal = false;
        goalAgeDays = 999;
        eveConvFreq30d = 0;
        promptCtr = 0;
        streakDays = 0;
        lastActiveDaysAgo = 180;
        sessionFreqWeekly = 0;
        totalActiveDays = 1;
        lessons30d = 0;
        questsCompleted = 0;
      } else if (edgeType === 2) {
        // Power learner — all signals maxed out
        hasGoal = true;
        goalAgeDays = 1;
        eveConvFreq30d = 15;
        promptCtr = 0.95;
        streakDays = 45;
        lastActiveDaysAgo = 0;
        sessionFreqWeekly = 7;
        totalActiveDays = 365;
        lessons30d = 25;
        questsCompleted = 12;
      } else if (edgeType === 3) {
        // Curious browser — sessions but no goal, low eve engagement
        hasGoal = false;
        goalAgeDays = 999;
        eveConvFreq30d = 1;
        promptCtr = parseFloat((rng() * 0.15).toFixed(2));
        streakDays = Math.floor(rng() * 8) + 2;
        lastActiveDaysAgo = Math.floor(rng() * 2);
        sessionFreqWeekly = parseFloat((rng() * 2 + 1).toFixed(1));
        totalActiveDays = Math.floor(rng() * 40) + 10;
        lessons30d = Math.floor(rng() * 5) + 2;
        questsCompleted = 0;
      } else {
        // Re-engaged member — was churned, just came back
        hasGoal = true;
        goalAgeDays = Math.floor(rng() * 20) + 5; // Re-declared goal recently
        eveConvFreq30d = Math.floor(rng() * 3) + 1;
        promptCtr = parseFloat((rng() * 0.3 + 0.2).toFixed(2));
        streakDays = Math.floor(rng() * 4) + 1;
        lastActiveDaysAgo = Math.floor(rng() * 2);
        sessionFreqWeekly = parseFloat((rng() * 2 + 1).toFixed(1));
        totalActiveDays = Math.floor(rng() * 120) + 30;
        lessons30d = Math.floor(rng() * 4) + 1;
        questsCompleted = Math.floor(rng() * 3) + 1;
      }
      break;
  }

  // ── Build goal declarations ─────────────────────────────────────────────────
  const goalDeclarations: GoalDeclaration[] = [];
  if (hasGoal) {
    const primaryCategory = pickFrom(GOAL_CATEGORIES, rng);
    goalDeclarations.push({
      category: primaryCategory,
      declared_at: isoDate(goalAgeDays),
      source: goalAgeDays < 7 ? "ftu" : rng() > 0.5 ? "in_app" : "onboarding_survey",
    });
    // ~30% of members have a second goal
    if (rng() > 0.7) {
      const secondCategory = pickFrom(
        GOAL_CATEGORIES.filter((c) => c !== primaryCategory),
        rng
      );
      goalDeclarations.push({
        category: secondCategory,
        declared_at: isoDate(Math.floor(goalAgeDays * 0.6)),
        source: "in_app",
      });
    }
  }

  // ── Build quest records ─────────────────────────────────────────────────────
  const questPool = QUEST_LIBRARY.slice(0, 8); // Limit to first 8 quests for variety
  const selectedQuests: QuestRecord[] = [];
  const numQuests = clamp(questsCompleted + (rng() > 0.5 ? 1 : 0), 0, 6);

  for (let qi = 0; qi < numQuests; qi++) {
    const questTemplate = questPool[qi % questPool.length];
    const isCompleted = qi < questsCompleted;
    const completionPct = isCompleted ? 100 : Math.floor(rng() * 80) + 10;
    const lessonsCompleted = isCompleted
      ? questTemplate.total_lessons
      : Math.floor((completionPct / 100) * questTemplate.total_lessons);

    selectedQuests.push({
      quest_id: questTemplate.quest_id,
      title: questTemplate.title,
      category: questTemplate.category,
      completed_at: isCompleted ? isoDate(Math.floor(rng() * 120) + 5) : null,
      completion_percentage: completionPct,
      lessons_completed: lessonsCompleted,
      total_lessons: questTemplate.total_lessons,
    });
  }

  const currentQuest = selectedQuests.find((q) => q.completed_at === null) ?? null;

  // ── Build recent lesson records ─────────────────────────────────────────────
  const recentLessons: LessonRecord[] = [];
  const numRecentLessons = clamp(lessons30d, 0, 10);
  for (let li = 0; li < numRecentLessons; li++) {
    const questRef = currentQuest ?? selectedQuests[0];
    if (!questRef) break;
    recentLessons.push({
      lesson_id: `${questRef.quest_id}_lesson_${li + 1}`,
      quest_id: questRef.quest_id,
      completed_at: isoDate(Math.floor(rng() * 28)),
      duration_seconds: Math.floor(rng() * 1200) + 300, // 5–25 minutes
    });
  }

  const totalLessonsCompleted = selectedQuests.reduce(
    (acc, q) => acc + q.lessons_completed,
    0
  );

  // ── Stuck-point fields (Sprint 5) ──────────────────────────────────────────
  // forceStuck = true always generates 7+ days; otherwise use index-based heuristic
  // (~10% of all members get a non-trivial days_on_current_lesson to ensure
  //  the 50-member stuck threshold is comfortably exceeded)
  const stuckChance = spec.forceStuck ? 1 : rng();
  let daysOnCurrentLesson: number;
  let stuckLessonId: string | null;

  if (spec.forceStuck || stuckChance < 0.10) {
    // Generate a stuck scenario: 7–21 days on a lesson
    daysOnCurrentLesson = Math.floor(rng() * 15) + 7; // 7–21
    const stuckQuest = currentQuest ?? selectedQuests[0];
    stuckLessonId = stuckQuest
      ? `${stuckQuest.quest_id}_lesson_${Math.floor(rng() * 5) + 1}`
      : null;
  } else {
    // 1–6 days on current lesson (not stuck) — or 0 if brand new
    daysOnCurrentLesson = Math.floor(rng() * 6);
    stuckLessonId = null;
  }

  return {
    member_id: memberId,
    created_at: isoDate(totalActiveDays + Math.floor(rng() * 30)),

    intent: {
      goal_declarations: goalDeclarations,
      primary_goal_category:
        goalDeclarations.length > 0 ? goalDeclarations[0].category : null,
      eve_conversation_frequency_30d: eveConvFreq30d,
      prompt_ctr: promptCtr,
      ftu_goal_from_mock: false, // Will be set by LearnerProfileService based on adapter
    },

    engagement: {
      streak_days: streakDays,
      last_active_at: isoDate(lastActiveDaysAgo),
      session_frequency_weekly: sessionFreqWeekly,
      total_active_days: totalActiveDays,
    },

    learning: {
      lessons_completed_total: totalLessonsCompleted,
      lessons_completed_30d: lessons30d,
      quests_completed_total: questsCompleted,
      current_quest: currentQuest,
      recent_lessons: recentLessons,
      quests: selectedQuests,
    },

    // Sprint 5 — stuck-point fields
    days_on_current_lesson: daysOnCurrentLesson,
    stuck_lesson_id: stuckLessonId,
  };
}

// ─── Generate 500 Members ─────────────────────────────────────────────────────
//
// Distribution across 500 members:
//   State 1 (s1): 125 members  (25%)
//   State 2 (s2): 125 members  (25%)
//   State 3 (s3): 125 members  (25%)
//   State 4 (s4):  75 members  (15%)
//   Edge cases:    50 members  (10%)

const QUADRANT_SCHEDULE: Array<{ quadrant: MemberSpec["quadrant"]; forceStuck?: boolean }> = [
  // 125 State 1 (high intent + high momentum) — 12 forced-stuck
  ...Array(113).fill({ quadrant: "s1" as const }),
  ...Array(12).fill({ quadrant: "s1" as const, forceStuck: true }),
  // 125 State 2 (high intent + low momentum) — 12 forced-stuck
  ...Array(113).fill({ quadrant: "s2" as const }),
  ...Array(12).fill({ quadrant: "s2" as const, forceStuck: true }),
  // 125 State 3 (low intent + high momentum) — 13 forced-stuck
  ...Array(112).fill({ quadrant: "s3" as const }),
  ...Array(13).fill({ quadrant: "s3" as const, forceStuck: true }),
  // 75 State 4 (low intent + low momentum) — 13 forced-stuck
  ...Array(62).fill({ quadrant: "s4" as const }),
  ...Array(13).fill({ quadrant: "s4" as const, forceStuck: true }),
  // 50 Edge cases
  ...Array(50).fill({ quadrant: "edge" as const }),
];
// Total forced-stuck: 12 + 12 + 13 + 13 = 50 members (meets the ≥50 acceptance criterion)

export const MOCK_MEMBERS: RawMemberData[] = QUADRANT_SCHEDULE.map(({ quadrant, forceStuck }, index) =>
  buildMember({ index, quadrant, forceStuck })
);

// ─── Convenience Exports ───────────────────────────────────────────────────────

export const MOCK_MEMBER_IDS: string[] = MOCK_MEMBERS.map((m) => m.member_id);

/** Return a single mock member by index (0-based) */
export function getMockMember(index: number): RawMemberData {
  return MOCK_MEMBERS[index];
}

/** Return mock members matching a specific quadrant pattern by member_id prefix */
export function getMockMemberById(memberId: string): RawMemberData | undefined {
  return MOCK_MEMBERS.find((m) => m.member_id === memberId);
}
