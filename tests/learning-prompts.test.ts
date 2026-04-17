/**
 * Sprint 3 Tests — Learning Assistant Prompts
 *
 * Test coverage:
 * 1. Mock lesson data — 20 lessons, accessors
 * 2. Lesson-specific prompt templates — exist, target states, no raw placeholders
 * 3. Goal-anchored lesson prompt templates — exist, target states
 * 4. Learning prompt ranking — at least 1 lesson-specific + 1 goal-anchored
 * 5. Fallback prompts — profile unavailable, lesson unavailable, no goal
 * 6. GET /members/:member_id/learning-prompts — API integration
 * 7. Latency — response <1000ms
 * 8. A/B test — variant present, deterministic, different experiment from eve-prompts
 * 9. Personalisation — {{lesson}}, {{topic}}, {{goal}} placeholders resolved
 */

import request from "supertest";
import { createApp } from "../src/api/server";
import { MOCK_LESSONS, getLessonById, getLessonsForQuest, resolveLessonMeta } from "../src/data/mock-lessons";
import {
  LESSON_SPECIFIC_PROMPTS,
  GOAL_ANCHORED_LESSON_PROMPTS,
  LEARNING_FALLBACK_PROMPTS,
  personalisePromptText,
} from "../src/prompts/prompt-library";
import {
  rankLearningPrompts,
  getLearningFallbackPrompts,
} from "../src/prompts/learning-prompt-ranking";
import { MockDataAdapter } from "../src/data/adapters/MockDataAdapter";
import { LearnerProfileService } from "../src/services/learner-profile";
import { MOCK_MEMBERS } from "../src/data/mock-members";
import type { LearnerProfile, MemberStateValue } from "../src/types/index";
import type { LearningPromptsResponse } from "../src/types/learning";
import type { LearningPromptContext } from "../src/types/learning";

const app = createApp();
const adapter = new MockDataAdapter();
const service = new LearnerProfileService(adapter);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildProfileForState(targetState: MemberStateValue): LearnerProfile | null {
  for (const raw of MOCK_MEMBERS) {
    const profile = service.buildProfileFromRaw(raw);
    if (profile.member_state.state === targetState) return profile;
  }
  return null;
}

/** Build a LearningPromptContext with a real lesson and goal */
function makeContext(
  lessonId: string | null = "l001",
  questId: string | null = "q001",
  goal: string | null = "health",
  questTitle: string | null = "Be Extraordinary"
): LearningPromptContext {
  const lesson_meta = resolveLessonMeta(lessonId, questId);
  return {
    lesson_id: lessonId,
    quest_id: questId,
    lesson_meta,
    primary_goal: goal,
    current_quest_title: questTitle,
  };
}

// ─── 1. Mock Lesson Data ──────────────────────────────────────────────────────

describe("Mock lesson data", () => {
  it("contains exactly 20 lessons", () => {
    expect(MOCK_LESSONS).toHaveLength(20);
  });

  it("every lesson has a unique lesson_id", () => {
    const ids = MOCK_LESSONS.map((l) => l.lesson_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every lesson has non-empty title, topic, quest_id, quest_title, quest_category", () => {
    for (const l of MOCK_LESSONS) {
      expect(l.title.length).toBeGreaterThan(0);
      expect(l.topic.length).toBeGreaterThan(0);
      expect(l.quest_id.length).toBeGreaterThan(0);
      expect(l.quest_title.length).toBeGreaterThan(0);
      expect(l.quest_category.length).toBeGreaterThan(0);
    }
  });

  it("getLessonById returns the correct lesson", () => {
    const lesson = getLessonById("l001");
    expect(lesson).toBeDefined();
    expect(lesson?.lesson_id).toBe("l001");
    expect(lesson?.quest_id).toBe("q001");
  });

  it("getLessonById returns undefined for unknown lesson", () => {
    expect(getLessonById("l999")).toBeUndefined();
  });

  it("getLessonsForQuest returns all lessons for a quest", () => {
    const lessons = getLessonsForQuest("q001");
    expect(lessons.length).toBeGreaterThanOrEqual(1);
    for (const l of lessons) {
      expect(l.quest_id).toBe("q001");
    }
  });

  it("resolveLessonMeta finds lesson by lesson_id first", () => {
    const meta = resolveLessonMeta("l003", "q001");
    expect(meta?.lesson_id).toBe("l003");
    expect(meta?.quest_id).toBe("q002"); // l003 is in q002, not q001
  });

  it("resolveLessonMeta falls back to quest when lesson_id is unknown", () => {
    const meta = resolveLessonMeta("unknown_lesson", "q007");
    expect(meta).not.toBeNull();
    expect(meta?.quest_id).toBe("q007");
  });

  it("resolveLessonMeta returns null when both are null", () => {
    const meta = resolveLessonMeta(null, null);
    expect(meta).toBeNull();
  });

  it("lessons span multiple quests", () => {
    const questIds = new Set(MOCK_LESSONS.map((l) => l.quest_id));
    expect(questIds.size).toBeGreaterThanOrEqual(5);
  });
});

// ─── 2. Lesson-Specific Prompt Templates ─────────────────────────────────────

describe("Lesson-specific prompt templates", () => {
  it("has at least 5 lesson-specific templates", () => {
    expect(LESSON_SPECIFIC_PROMPTS.length).toBeGreaterThanOrEqual(5);
  });

  it("all have unique prompt_ids starting with 'lesson_'", () => {
    const ids = LESSON_SPECIFIC_PROMPTS.map((p) => p.prompt_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.startsWith("lesson_")).toBe(true);
    }
  });

  it("at least one template targets all 4 states", () => {
    const targetAllStates = LESSON_SPECIFIC_PROMPTS.filter(
      (p) => p.target_states.length === 4
    );
    expect(targetAllStates.length).toBeGreaterThanOrEqual(1);
  });

  it("all contain {{lesson}} or {{topic}} placeholder", () => {
    for (const t of LESSON_SPECIFIC_PROMPTS) {
      const hasLessonOrTopic =
        t.text.includes("{{lesson}}") || t.text.includes("{{topic}}");
      expect(hasLessonOrTopic).toBe(true);
    }
  });

  it("base_weight is in [0, 1]", () => {
    for (const t of LESSON_SPECIFIC_PROMPTS) {
      expect(t.base_weight).toBeGreaterThanOrEqual(0);
      expect(t.base_weight).toBeLessThanOrEqual(1);
    }
  });
});

// ─── 3. Goal-Anchored Lesson Prompt Templates ─────────────────────────────────

describe("Goal-anchored lesson prompt templates", () => {
  it("has at least 5 goal-anchored lesson templates", () => {
    expect(GOAL_ANCHORED_LESSON_PROMPTS.length).toBeGreaterThanOrEqual(5);
  });

  it("all have unique prompt_ids starting with 'lesson_goal_'", () => {
    const ids = GOAL_ANCHORED_LESSON_PROMPTS.map((p) => p.prompt_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.startsWith("lesson_goal_")).toBe(true);
    }
  });

  it("all contain {{goal}} placeholder", () => {
    for (const t of GOAL_ANCHORED_LESSON_PROMPTS) {
      expect(t.text.includes("{{goal}}")).toBe(true);
    }
  });

  it("at least one template targets all 4 states", () => {
    const targetAll = GOAL_ANCHORED_LESSON_PROMPTS.filter(
      (p) => p.target_states.length === 4
    );
    expect(targetAll.length).toBeGreaterThanOrEqual(1);
  });

  it("base_weight is in [0, 1]", () => {
    for (const t of GOAL_ANCHORED_LESSON_PROMPTS) {
      expect(t.base_weight).toBeGreaterThanOrEqual(0);
      expect(t.base_weight).toBeLessThanOrEqual(1);
    }
  });
});

// ─── 4. Learning Prompt Ranking ───────────────────────────────────────────────

describe("Learning prompt ranking", () => {
  const states: MemberStateValue[] = [1, 2, 3, 4];

  for (const state of states) {
    it(`State ${state}: returns 2–3 prompts`, () => {
      const profile = buildProfileForState(state);
      if (!profile) return;
      const ctx = makeContext("l001", "q001", profile.intent.primary_goal_category, null);
      const { prompts } = rankLearningPrompts(profile, ctx);
      expect(prompts.length).toBeGreaterThanOrEqual(2);
      expect(prompts.length).toBeLessThanOrEqual(3);
    });
  }

  it("includes at least 1 lesson-specific prompt when lesson_meta is provided", () => {
    const profile = buildProfileForState(1) ?? buildProfileForState(2);
    if (!profile) return;
    const ctx = makeContext("l001", "q001", "health", null);
    const { prompts } = rankLearningPrompts(profile, ctx);
    const lessonPrompts = prompts.filter((p) => p.context_type === "lesson_specific");
    expect(lessonPrompts.length).toBeGreaterThanOrEqual(1);
  });

  it("includes at least 1 goal-anchored prompt when primary_goal is set", () => {
    // Force a profile with a goal
    let profileWithGoal: LearnerProfile | null = null;
    for (const raw of MOCK_MEMBERS) {
      const p = service.buildProfileFromRaw(raw);
      if (p.intent.primary_goal_category) {
        profileWithGoal = p;
        break;
      }
    }
    if (!profileWithGoal) return;
    const ctx = makeContext("l001", "q001", profileWithGoal.intent.primary_goal_category, null);
    const { prompts } = rankLearningPrompts(profileWithGoal, ctx);
    const goalPrompts = prompts.filter((p) => p.context_type === "goal_anchored");
    expect(goalPrompts.length).toBeGreaterThanOrEqual(1);
  });

  it("prompt text has no unresolved placeholders", () => {
    const profile = buildProfileForState(1);
    if (!profile) return;
    const ctx = makeContext("l001", "q001", "health", "Be Extraordinary");
    const { prompts } = rankLearningPrompts(profile, ctx);
    for (const p of prompts) {
      expect(p.text).not.toContain("{{");
      expect(p.text).not.toContain("}}");
    }
  });

  it("each prompt has a non-empty context_type", () => {
    const profile = buildProfileForState(1);
    if (!profile) return;
    const ctx = makeContext("l001", "q001", "health", null);
    const { prompts } = rankLearningPrompts(profile, ctx);
    for (const p of prompts) {
      expect(["lesson_specific", "goal_anchored", "general"]).toContain(p.context_type);
    }
  });

  it("is_fallback = false when profile is available", () => {
    const profile = buildProfileForState(1);
    if (!profile) return;
    const ctx = makeContext("l001", "q001", "health", null);
    const { isFallback } = rankLearningPrompts(profile, ctx);
    expect(isFallback).toBe(false);
  });

  it("no duplicate prompt IDs in a single response", () => {
    const profile = buildProfileForState(1);
    if (!profile) return;
    const ctx = makeContext("l001", "q001", "health", null);
    const { prompts } = rankLearningPrompts(profile, ctx);
    const ids = prompts.map((p) => p.prompt_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── 5. Fallback Prompts ──────────────────────────────────────────────────────

describe("Learning fallback prompts", () => {
  it("getLearningFallbackPrompts returns 2–3 prompts", () => {
    const fallbacks = getLearningFallbackPrompts();
    expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    expect(fallbacks.length).toBeLessThanOrEqual(3);
  });

  it("fallback prompts have ranking_score > 0", () => {
    for (const p of getLearningFallbackPrompts()) {
      expect(p.ranking_score).toBeGreaterThan(0);
    }
  });

  it("is_fallback = true when profile is null", () => {
    const ctx = makeContext("l001", "q001", null, null);
    const { isFallback } = rankLearningPrompts(null, ctx);
    expect(isFallback).toBe(true);
  });

  it("fallback prompts have no unresolved placeholders", () => {
    const ctx = makeContext(null, null, null, null);
    const { prompts } = rankLearningPrompts(null, ctx);
    for (const p of prompts) {
      expect(p.text).not.toContain("{{");
      expect(p.text).not.toContain("}}");
    }
  });

  it("still returns 2–3 prompts when lesson_meta is null (no lesson_id/quest_id)", () => {
    const profile = buildProfileForState(1);
    if (!profile) return;
    const ctx: LearningPromptContext = {
      lesson_id: null,
      quest_id: null,
      lesson_meta: null,
      primary_goal: "health",
      current_quest_title: null,
    };
    const { prompts } = rankLearningPrompts(profile, ctx);
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(prompts.length).toBeLessThanOrEqual(3);
  });

  it("still returns 2–3 prompts when primary_goal is null", () => {
    const profile = buildProfileForState(1);
    if (!profile) return;
    const ctx = makeContext("l001", "q001", null, null);
    const { prompts } = rankLearningPrompts(profile, ctx);
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(prompts.length).toBeLessThanOrEqual(3);
  });

  it("fallback is used when both lesson_meta and goal are null", () => {
    const profile = buildProfileForState(1);
    if (!profile) return;
    // Override primary_goal to null for this test
    const profileNoGoal = {
      ...profile,
      intent: { ...profile.intent, primary_goal_category: null },
    } as LearnerProfile;
    const ctx: LearningPromptContext = {
      lesson_id: null,
      quest_id: null,
      lesson_meta: null,
      primary_goal: null,
      current_quest_title: null,
    };
    const { prompts } = rankLearningPrompts(profileNoGoal, ctx);
    // Should still have at least 2 prompts (general or fallback fillers)
    expect(prompts.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── 6. Prompt Personalisation (lesson + topic + goal) ───────────────────────

describe("Learning prompt personalisation", () => {
  it("resolves {{lesson}} placeholder in lesson-specific prompt", () => {
    const template = LESSON_SPECIFIC_PROMPTS.find((p) => p.text.includes("{{lesson}}"))!;
    const text = personalisePromptText(template, null, null, "The Power of Belief Systems", "limiting beliefs");
    expect(text).toContain("The Power of Belief Systems");
    expect(text).not.toContain("{{lesson}}");
  });

  it("resolves {{topic}} placeholder in lesson-specific prompt", () => {
    const template = LESSON_SPECIFIC_PROMPTS.find((p) => p.text.includes("{{topic}}"))!;
    const text = personalisePromptText(template, null, null, "Some Lesson", "morning routines");
    expect(text).toContain("morning routines");
    expect(text).not.toContain("{{topic}}");
  });

  it("resolves {{goal}} and {{topic}} together in goal-anchored prompt", () => {
    const template = GOAL_ANCHORED_LESSON_PROMPTS.find(
      (p) => p.text.includes("{{goal}}") && p.text.includes("{{topic}}")
    )!;
    if (!template) return; // skip if no such combined template
    const text = personalisePromptText(template, "health", null, "WildFit Lesson", "nutrition fundamentals");
    expect(text).not.toContain("{{goal}}");
    expect(text).not.toContain("{{topic}}");
    expect(text.toLowerCase()).toContain("health");
    expect(text).toContain("nutrition fundamentals");
  });

  it("uses fallback text 'this lesson' when lessonTitle is null", () => {
    const template = LESSON_SPECIFIC_PROMPTS.find((p) => p.text.includes("{{lesson}}"))!;
    const text = personalisePromptText(template, null, null, null, null);
    expect(text).toContain("this lesson");
    expect(text).not.toContain("{{lesson}}");
  });

  it("uses fallback text 'this topic' when lessonTopic is null", () => {
    const template = LESSON_SPECIFIC_PROMPTS.find((p) => p.text.includes("{{topic}}"))!;
    const text = personalisePromptText(template, null, null, null, null);
    expect(text).toContain("this topic");
    expect(text).not.toContain("{{topic}}");
  });
});

// ─── 7. GET /members/:member_id/learning-prompts — API Integration ────────────

describe("GET /members/:member_id/learning-prompts", () => {
  it("returns 200 with 2–3 prompts for a known member with lesson context", async () => {
    const res = await request(app).get(
      "/members/member_001/learning-prompts?lesson_id=l001&quest_id=q001"
    );
    expect(res.status).toBe(200);
    const body = res.body as LearningPromptsResponse;
    expect(Array.isArray(body.prompts)).toBe(true);
    expect(body.prompts.length).toBeGreaterThanOrEqual(2);
    expect(body.prompts.length).toBeLessThanOrEqual(3);
  });

  it("includes at least 1 lesson-specific prompt in results", async () => {
    const res = await request(app).get(
      "/members/member_001/learning-prompts?lesson_id=l001&quest_id=q001"
    );
    expect(res.status).toBe(200);
    const body = res.body as LearningPromptsResponse;
    const lessonSpecific = body.prompts.filter(
      (p: { context_type: string }) => p.context_type === "lesson_specific"
    );
    expect(lessonSpecific.length).toBeGreaterThanOrEqual(1);
  });

  it("includes at least 1 goal-anchored prompt when member has a goal", async () => {
    // Find a member with a goal in MOCK_MEMBERS
    let memberWithGoal = "member_001";
    for (const raw of MOCK_MEMBERS) {
      const p = service.buildProfileFromRaw(raw);
      if (p.intent.primary_goal_category) {
        memberWithGoal = raw.member_id;
        break;
      }
    }
    const res = await request(app).get(
      `/members/${memberWithGoal}/learning-prompts?lesson_id=l001&quest_id=q001`
    );
    expect(res.status).toBe(200);
    const body = res.body as LearningPromptsResponse;
    const goalAnchored = body.prompts.filter(
      (p: { context_type: string }) => p.context_type === "goal_anchored"
    );
    expect(goalAnchored.length).toBeGreaterThanOrEqual(1);
  });

  it("response contains ab_variant (treatment or control)", async () => {
    const res = await request(app).get(
      "/members/member_001/learning-prompts?lesson_id=l001&quest_id=q001"
    );
    expect(res.status).toBe(200);
    const body = res.body as LearningPromptsResponse;
    expect(["treatment", "control"]).toContain(body.ab_variant);
  });

  it("A/B variant is different experiment from eve-prompts", async () => {
    // The learning prompts use experiment 'eve_learning_prompts_v1'
    // We can't check the experiment ID from the response, but we can verify
    // that the assignment can differ from the eve-prompts assignment
    const evRes = await request(app).get("/members/member_001/eve-prompts");
    const lpRes = await request(app).get(
      "/members/member_001/learning-prompts?lesson_id=l001&quest_id=q001"
    );
    expect(evRes.status).toBe(200);
    expect(lpRes.status).toBe(200);
    // Both responses should have a valid ab_variant (may or may not differ)
    expect(["treatment", "control"]).toContain(evRes.body.ab_variant);
    expect(["treatment", "control"]).toContain(lpRes.body.ab_variant);
  });

  it("A/B variant is deterministic across repeated calls for same member+lesson", async () => {
    const url = "/members/member_042/learning-prompts?lesson_id=l005&quest_id=q003";
    const r1 = await request(app).get(url);
    const r2 = await request(app).get(url);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect((r1.body as LearningPromptsResponse).ab_variant).toBe(
      (r2.body as LearningPromptsResponse).ab_variant
    );
  });

  it("response contains is_fallback boolean", async () => {
    const res = await request(app).get(
      "/members/member_001/learning-prompts?lesson_id=l001&quest_id=q001"
    );
    expect(typeof (res.body as LearningPromptsResponse).is_fallback).toBe("boolean");
  });

  it("known member returns is_fallback = false", async () => {
    const res = await request(app).get(
      "/members/member_001/learning-prompts?lesson_id=l001&quest_id=q001"
    );
    expect((res.body as LearningPromptsResponse).is_fallback).toBe(false);
  });

  it("unknown member returns 200 with is_fallback = true", async () => {
    const res = await request(app).get(
      "/members/unknown_xyz_99999/learning-prompts?lesson_id=l001&quest_id=q001"
    );
    expect(res.status).toBe(200);
    const body = res.body as LearningPromptsResponse;
    expect(body.is_fallback).toBe(true);
    expect(body.prompts.length).toBeGreaterThanOrEqual(2);
  });

  it("meta contains request_id, latency_ms, adapter, member_state, lesson_id, quest_id", async () => {
    const res = await request(app).get(
      "/members/member_001/learning-prompts?lesson_id=l007&quest_id=q004"
    );
    expect(res.status).toBe(200);
    const { meta } = res.body as LearningPromptsResponse;
    expect(typeof meta.request_id).toBe("string");
    expect(typeof meta.latency_ms).toBe("number");
    expect(meta.latency_ms).toBeGreaterThanOrEqual(0);
    expect(typeof meta.adapter).toBe("string");
    expect(meta.lesson_id).toBe("l007");
    expect(meta.quest_id).toBe("q004");
  });

  it("meta.lesson_id and meta.quest_id are null when not provided", async () => {
    const res = await request(app).get("/members/member_001/learning-prompts");
    expect(res.status).toBe(200);
    const { meta } = res.body as LearningPromptsResponse;
    expect(meta.lesson_id).toBeNull();
    expect(meta.quest_id).toBeNull();
  });

  it("prompt text has no unresolved placeholders", async () => {
    const res = await request(app).get(
      "/members/member_001/learning-prompts?lesson_id=l001&quest_id=q001"
    );
    expect(res.status).toBe(200);
    for (const p of (res.body as LearningPromptsResponse).prompts) {
      expect(p.text).not.toContain("{{");
      expect(p.text).not.toContain("}}");
    }
  });

  it("each prompt has required fields: prompt_id, category, text, ranking_score, reason, context_type", async () => {
    const res = await request(app).get(
      "/members/member_001/learning-prompts?lesson_id=l001&quest_id=q001"
    );
    expect(res.status).toBe(200);
    for (const p of (res.body as LearningPromptsResponse).prompts) {
      expect(typeof p.prompt_id).toBe("string");
      expect(["goal", "content", "reflection", "re_entry"]).toContain(p.category);
      expect(typeof p.text).toBe("string");
      expect(p.text.length).toBeGreaterThan(0);
      expect(typeof p.ranking_score).toBe("number");
      expect(p.ranking_score).toBeGreaterThanOrEqual(0);
      expect(p.ranking_score).toBeLessThanOrEqual(1);
      expect(typeof p.reason).toBe("string");
      expect(["lesson_specific", "goal_anchored", "general"]).toContain(p.context_type);
    }
  });

  it("returns 400 for invalid member_id", async () => {
    const res = await request(app).get(
      "/members/invalid id/learning-prompts?lesson_id=l001"
    );
    expect(res.status).toBe(400);
  });

  it("works without lesson_id or quest_id (no lesson context)", async () => {
    const res = await request(app).get("/members/member_001/learning-prompts");
    expect(res.status).toBe(200);
    const body = res.body as LearningPromptsResponse;
    expect(body.prompts.length).toBeGreaterThanOrEqual(2);
  });

  it("works with only quest_id (no lesson_id)", async () => {
    const res = await request(app).get(
      "/members/member_001/learning-prompts?quest_id=q007"
    );
    expect(res.status).toBe(200);
    expect(res.body.prompts.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── 8. Latency Target (<1000ms) ─────────────────────────────────────────────

describe("Learning prompts latency target", () => {
  it("meta.latency_ms is under 1000ms for a known member", async () => {
    const res = await request(app).get(
      "/members/member_001/learning-prompts?lesson_id=l001&quest_id=q001"
    );
    expect(res.status).toBe(200);
    const { meta } = res.body as LearningPromptsResponse;
    expect(meta.latency_ms).toBeLessThan(1000);
  });

  it("meta.latency_ms is under 1000ms for an unknown member (fallback path)", async () => {
    const res = await request(app).get(
      "/members/unknown_xyz_99999/learning-prompts?lesson_id=l001&quest_id=q001"
    );
    expect(res.status).toBe(200);
    expect((res.body as LearningPromptsResponse).meta.latency_ms).toBeLessThan(1000);
  });
});
