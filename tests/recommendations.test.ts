/**
 * Sprint 7 Tests — Predictive Path Continuity: Quest Completion & Next-Chapter Recommendations
 *
 * Test coverage:
 *  1.  buildQuestCompletionEvent — fires with correct fields
 *  2.  buildQuestCompletionEvent — completion_percentage clamped to [0, 100]
 *  3.  getNextChapterRecommendations — excludes completed quests
 *  4.  getNextChapterRecommendations — anchored to goal category (all results match category)
 *  5.  getNextChapterRecommendations — returns exactly 3 recommendations in < 2s
 *  6.  getAlmostTherePrompt — fires at exactly pct = 80
 *  7.  getAlmostTherePrompt — does NOT fire at pct = 79
 *  8.  getAlmostTherePrompt — fires at pct = 95 with different copy
 *  9.  Sofia persona — gets habit_builder quests (NOT mindset quests)
 *  10. Sofia persona — recommended quests exclude her two completed quests
 *  11. buildIntentFallback — returns results when no goal category is declared
 *  12. buildIntentFallback — is_fallback = true
 *  13. API: POST /members/:member_id/quest-complete — returns event + recommendations
 *  14. API: POST /members/:member_id/quest-complete — unknown member returns safe response
 *  15. API: GET  /members/:member_id/almost-there?quest_id=&completion_pct=80 — fires
 *  16. API: GET  /members/:member_id/almost-there?quest_id=&completion_pct=79 — does not fire
 *  17. API: GET  /members/:member_id/next-chapter — returns 3 recommendations
 *  18. API: GET  /members/:member_id/next-chapter — unknown member returns safe response
 *  19. API: 400 for invalid member_id on all three new endpoints
 *  20. Quest completion event pipeline — real-time (< 2s total for event + recommendations)
 */

import request from "supertest";
import { createApp } from "../src/api/server";
import {
  buildQuestCompletionEvent,
  getNextChapterRecommendations,
  getAlmostTherePrompt,
  buildIntentFallback,
} from "../src/services/recommendation-engine";
import { MOCK_MEMBERS } from "../src/data/mock-members";
import { SOFIA_FIXTURE } from "../src/data/mock-quests";
import type { RawMemberData } from "../src/types/index";
import type {
  QuestCompletionEvent,
  NextChapterRecommendation,
  RecommendationResponse,
} from "../src/types/recommendations";

const app = createApp();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/** Build a minimal RawMemberData fixture with controllable fields */
function makeMember(overrides: {
  member_id?: string;
  goal_category?: string | null;
  completed_quest_ids?: string[];
  current_quest_id?: string;
  current_quest_completion_pct?: number;
}): RawMemberData {
  const {
    member_id = "test_reco_member",
    goal_category = "habit_builder",
    completed_quest_ids = [],
    current_quest_id = "hb_q003",
    current_quest_completion_pct = 50,
  } = overrides;

  return {
    member_id,
    created_at: daysAgo(180),
    intent: {
      goal_declarations:
        goal_category !== null
          ? [{ category: goal_category, declared_at: daysAgo(30), source: "ftu" }]
          : [],
      primary_goal_category: goal_category,
      eve_conversation_frequency_30d: 3,
      prompt_ctr: 0.4,
      ftu_goal_from_mock: false,
    },
    engagement: {
      streak_days: 5,
      last_active_at: daysAgo(1),
      session_frequency_weekly: 3,
      total_active_days: 60,
    },
    learning: {
      lessons_completed_total: 30,
      lessons_completed_30d: 5,
      quests_completed_total: completed_quest_ids.length,
      current_quest: {
        quest_id:              current_quest_id,
        title:                 "Morning Ritual Mastery",
        category:              goal_category ?? "habit_builder",
        completed_at:          null,
        completion_percentage: current_quest_completion_pct,
        lessons_completed:     Math.floor((current_quest_completion_pct / 100) * 15),
        total_lessons:         15,
      },
      recent_lessons: [],
      quests: completed_quest_ids.map((qid) => ({
        quest_id:              qid,
        title:                 "Completed Quest",
        category:              goal_category ?? "habit_builder",
        completed_at:          daysAgo(10),
        completion_percentage: 100,
        lessons_completed:     20,
        total_lessons:         20,
      })),
    },
    days_on_current_lesson: 2,
    stuck_lesson_id:        null,
  };
}

/** Build a Sofia member fixture matching SOFIA_FIXTURE */
function makeSofia(): RawMemberData {
  return makeMember({
    member_id:                   SOFIA_FIXTURE.member_id,
    goal_category:               SOFIA_FIXTURE.goal_category,
    completed_quest_ids:         SOFIA_FIXTURE.completed_quest_ids,
    current_quest_id:            SOFIA_FIXTURE.current_quest_id,
    current_quest_completion_pct: SOFIA_FIXTURE.current_quest_completion_pct,
  });
}

// ─── 1. buildQuestCompletionEvent — correct fields ────────────────────────────

describe("buildQuestCompletionEvent", () => {
  it("returns event with correct member_id and quest_id", () => {
    const event: QuestCompletionEvent = buildQuestCompletionEvent("member_001", "hb_q001", 100);
    expect(event.member_id).toBe("member_001");
    expect(event.quest_id).toBe("hb_q001");
  });

  it("includes a valid ISO-8601 completed_at timestamp", () => {
    const event = buildQuestCompletionEvent("member_001", "hb_q001", 100);
    expect(new Date(event.completed_at).toISOString()).toBe(event.completed_at);
  });

  it("records the completion_percentage accurately", () => {
    const event = buildQuestCompletionEvent("member_001", "hb_q001", 82);
    expect(event.completion_percentage).toBe(82);
  });

  it("clamps completion_percentage above 100 to 100", () => {
    const event = buildQuestCompletionEvent("member_001", "hb_q001", 150);
    expect(event.completion_percentage).toBe(100);
  });

  it("clamps negative completion_percentage to 0", () => {
    const event = buildQuestCompletionEvent("member_001", "hb_q001", -5);
    expect(event.completion_percentage).toBe(0);
  });
});

// ─── 2. getNextChapterRecommendations — excludes completed quests ─────────────

describe("getNextChapterRecommendations — exclusion of completed quests", () => {
  it("completed quests do not appear in recommendations", () => {
    const member = makeMember({
      goal_category:         "habit_builder",
      completed_quest_ids:   ["hb_q001", "hb_q002"],
    });
    const result = getNextChapterRecommendations(member, ["hb_q001", "hb_q002"]);
    const returnedIds = result.recommendations.map((r) => r.quest_id);
    expect(returnedIds).not.toContain("hb_q001");
    expect(returnedIds).not.toContain("hb_q002");
  });

  it("returns remaining quests when some are completed", () => {
    const member = makeMember({
      goal_category:       "habit_builder",
      completed_quest_ids: ["hb_q001"],
    });
    const result = getNextChapterRecommendations(member, ["hb_q001"]);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.map((r) => r.quest_id)).not.toContain("hb_q001");
  });
});

// ─── 3. getNextChapterRecommendations — anchored to goal category ─────────────

describe("getNextChapterRecommendations — goal category anchoring", () => {
  it("all recommendations match the member's goal category", () => {
    const member = makeMember({ goal_category: "health" });
    const result = getNextChapterRecommendations(member, []);
    for (const rec of result.recommendations) {
      expect(rec.category).toBe("health");
    }
  });

  it("recommendations for habit_builder are all habit_builder", () => {
    const member = makeMember({ goal_category: "habit_builder" });
    const result = getNextChapterRecommendations(member, []);
    for (const rec of result.recommendations) {
      expect(rec.category).toBe("habit_builder");
    }
  });

  it("is_fallback is false when goal category is available", () => {
    const member = makeMember({ goal_category: "career" });
    const result = getNextChapterRecommendations(member, []);
    expect(result.is_fallback).toBe(false);
  });
});

// ─── 4. getNextChapterRecommendations — returns 3 in < 2s ────────────────────

describe("getNextChapterRecommendations — latency and count", () => {
  it("returns exactly 3 recommendations (default limit)", () => {
    const member = makeMember({ goal_category: "mindset" });
    const result = getNextChapterRecommendations(member, []);
    expect(result.recommendations).toHaveLength(3);
  });

  it("returns 3 recommendations in < 2000ms", () => {
    const member = makeMember({ goal_category: "relationships" });
    const start = Date.now();
    const result = getNextChapterRecommendations(member, []);
    const elapsed = Date.now() - start;

    expect(result.recommendations).toHaveLength(3);
    expect(elapsed).toBeLessThan(2000);
  });

  it("member_id on response matches the member", () => {
    const member = makeMember({ member_id: "timing_test_member", goal_category: "health" });
    const result = getNextChapterRecommendations(member, []);
    expect(result.member_id).toBe("timing_test_member");
  });

  it("generated_at is a valid ISO-8601 timestamp", () => {
    const member = makeMember({ goal_category: "career" });
    const result = getNextChapterRecommendations(member, []);
    expect(new Date(result.generated_at).toISOString()).toBe(result.generated_at);
  });
});

// ─── 5. getAlmostTherePrompt — 80% threshold ─────────────────────────────────

describe("getAlmostTherePrompt — 80% trigger", () => {
  const member = makeMember({
    member_id:    "almost_test",
    goal_category: "habit_builder",
  });

  it("fires (eligible: true) when completion_pct === 80", () => {
    const result = getAlmostTherePrompt(member, "hb_q003", 80);
    expect(result.eligible).toBe(true);
  });

  it("does NOT fire (eligible: false) when completion_pct === 79", () => {
    const result = getAlmostTherePrompt(member, "hb_q003", 79);
    expect(result.eligible).toBe(false);
  });

  it("fires for completion_pct === 95 with different (celebratory) message", () => {
    const result80 = getAlmostTherePrompt(member, "hb_q003", 80);
    const result95 = getAlmostTherePrompt(member, "hb_q003", 95);
    expect(result95.eligible).toBe(true);
    if (result80.eligible && result95.eligible) {
      expect(result95.message).not.toBe(result80.message);
    }
  });

  it("fires for completion_pct === 100", () => {
    const result = getAlmostTherePrompt(member, "hb_q003", 100);
    expect(result.eligible).toBe(true);
  });

  it("returned message includes the completion percentage", () => {
    const result = getAlmostTherePrompt(member, "hb_q003", 82);
    if (result.eligible) {
      expect(result.message).toContain("82");
      expect(result.completion_percentage).toBe(82);
    }
  });

  it("does NOT fire at pct = 0", () => {
    const result = getAlmostTherePrompt(member, "hb_q003", 0);
    expect(result.eligible).toBe(false);
  });

  it("does NOT fire at pct = 50", () => {
    const result = getAlmostTherePrompt(member, "hb_q003", 50);
    expect(result.eligible).toBe(false);
  });
});

// ─── 6. Sofia persona test ────────────────────────────────────────────────────

describe("Sofia persona — habit_builder recommendations", () => {
  const sofia = makeSofia();

  it("Sofia's goal category is habit_builder", () => {
    expect(sofia.intent.primary_goal_category).toBe("habit_builder");
  });

  it("Sofia receives habit_builder recommendations (not mindset)", () => {
    const result = getNextChapterRecommendations(
      sofia,
      SOFIA_FIXTURE.completed_quest_ids
    );
    for (const rec of result.recommendations) {
      expect(rec.category).toBe("habit_builder");
      expect(rec.category).not.toBe("mindset");
    }
  });

  it("Sofia's completed quests are excluded from recommendations", () => {
    const result = getNextChapterRecommendations(
      sofia,
      SOFIA_FIXTURE.completed_quest_ids
    );
    const returnedIds = result.recommendations.map((r) => r.quest_id);
    for (const completedId of SOFIA_FIXTURE.completed_quest_ids) {
      expect(returnedIds).not.toContain(completedId);
    }
  });

  it("Sofia at 82% triggers the almost-there prompt", () => {
    const result = getAlmostTherePrompt(
      sofia,
      SOFIA_FIXTURE.current_quest_id,
      SOFIA_FIXTURE.current_quest_completion_pct
    );
    expect(result.eligible).toBe(true);
  });

  it("Sofia's almost-there prompt mentions her completion percentage", () => {
    const result = getAlmostTherePrompt(
      sofia,
      SOFIA_FIXTURE.current_quest_id,
      SOFIA_FIXTURE.current_quest_completion_pct
    );
    if (result.eligible) {
      expect(result.message).toContain("82");
    }
  });

  it("Sofia's recommendations are returned in < 2s", () => {
    const start = Date.now();
    const result = getNextChapterRecommendations(
      sofia,
      SOFIA_FIXTURE.completed_quest_ids
    );
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 7. buildIntentFallback ───────────────────────────────────────────────────

describe("buildIntentFallback", () => {
  it("returns results when member has no declared goal", () => {
    const member = makeMember({ goal_category: null });
    const result = buildIntentFallback(member, []);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("is_fallback is always true", () => {
    const member = makeMember({ goal_category: "habit_builder" });
    const result = buildIntentFallback(member, []);
    expect(result.is_fallback).toBe(true);
  });

  it("excludes completed quests from fallback results", () => {
    const member = makeMember({ goal_category: null });
    const result = buildIntentFallback(member, ["hb_q001", "ms_q001"]);
    const ids = result.recommendations.map((r) => r.quest_id);
    expect(ids).not.toContain("hb_q001");
    expect(ids).not.toContain("ms_q001");
  });

  it("getNextChapterRecommendations falls back when no goal category", () => {
    const member = makeMember({ goal_category: null });
    const result = getNextChapterRecommendations(member, []);
    expect(result.is_fallback).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

// ─── 8. API: POST /members/:member_id/quest-complete ─────────────────────────

describe("POST /members/:member_id/quest-complete", () => {
  it("returns 200 with event and recommendations for a known member", async () => {
    const memberId = MOCK_MEMBERS[0].member_id;
    const response = await request(app)
      .post(`/members/${memberId}/quest-complete`)
      .send({ quest_id: "hb_q001", completion_percentage: 100 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("event");
    expect(response.body.event.member_id).toBe(memberId);
    expect(response.body.event.quest_id).toBe("hb_q001");
    expect(response.body.event.completion_percentage).toBe(100);
    expect(response.body).toHaveProperty("recommendations");
    expect(Array.isArray(response.body.recommendations)).toBe(true);
  });

  it("returns safe empty recommendations for unknown member", async () => {
    const response = await request(app)
      .post("/members/unknown_ghost_member/quest-complete")
      .send({ quest_id: "hb_q001", completion_percentage: 100 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("event");
    expect(response.body.recommendations).toHaveLength(0);
    expect(response.body.is_fallback).toBe(true);
  });

  it("returns 400 for invalid member_id", async () => {
    const response = await request(app)
      .post("/members/bad id!/quest-complete")
      .send({ quest_id: "hb_q001", completion_percentage: 100 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_MEMBER_ID");
  });

  it("returns 400 when quest_id is missing from body", async () => {
    const memberId = MOCK_MEMBERS[0].member_id;
    const response = await request(app)
      .post(`/members/${memberId}/quest-complete`)
      .send({ completion_percentage: 100 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
  });

  it("completion event + recommendations completes in < 2s", async () => {
    const memberId = MOCK_MEMBERS[0].member_id;
    const start = Date.now();
    const response = await request(app)
      .post(`/members/${memberId}/quest-complete`)
      .send({ quest_id: "hb_q002", completion_percentage: 100 });
    const elapsed = Date.now() - start;

    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  });
});

// ─── 9. API: GET /members/:member_id/almost-there ────────────────────────────

describe("GET /members/:member_id/almost-there", () => {
  it("returns eligible: true for a known member at 80%", async () => {
    const memberId = MOCK_MEMBERS[0].member_id;
    const response = await request(app)
      .get(`/members/${memberId}/almost-there?quest_id=hb_q003&completion_pct=80`);

    expect(response.status).toBe(200);
    expect(response.body.eligible).toBe(true);
    if (response.body.eligible) {
      expect(typeof response.body.message).toBe("string");
      expect(response.body.message.length).toBeGreaterThan(0);
    }
  });

  it("returns eligible: false when completion_pct is 79", async () => {
    const memberId = MOCK_MEMBERS[0].member_id;
    const response = await request(app)
      .get(`/members/${memberId}/almost-there?quest_id=hb_q003&completion_pct=79`);

    expect(response.status).toBe(200);
    expect(response.body.eligible).toBe(false);
  });

  it("returns eligible: false for unknown member", async () => {
    const response = await request(app)
      .get("/members/unknown_ghost_member/almost-there?quest_id=hb_q003&completion_pct=85");

    expect(response.status).toBe(200);
    expect(response.body.eligible).toBe(false);
  });

  it("returns 400 for invalid member_id", async () => {
    const response = await request(app)
      .get("/members/bad id!/almost-there?quest_id=hb_q003&completion_pct=80");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_MEMBER_ID");
  });

  it("returns 400 when quest_id query param is missing", async () => {
    const memberId = MOCK_MEMBERS[0].member_id;
    const response = await request(app)
      .get(`/members/${memberId}/almost-there?completion_pct=80`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 when completion_pct query param is missing", async () => {
    const memberId = MOCK_MEMBERS[0].member_id;
    const response = await request(app)
      .get(`/members/${memberId}/almost-there?quest_id=hb_q003`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
  });
});

// ─── 10. API: GET /members/:member_id/next-chapter ───────────────────────────

describe("GET /members/:member_id/next-chapter", () => {
  it("returns 200 with recommendations array for a known member", async () => {
    const memberId = MOCK_MEMBERS[0].member_id;
    const response = await request(app).get(`/members/${memberId}/next-chapter`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("recommendations");
    expect(Array.isArray(response.body.recommendations)).toBe(true);
    expect(response.body.recommendations.length).toBeGreaterThanOrEqual(1);
  });

  it("returns safe empty response for unknown member", async () => {
    const response = await request(app).get("/members/unknown_ghost_member/next-chapter");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("recommendations");
    expect(response.body.is_fallback).toBe(true);
  });

  it("returns 400 for invalid member_id", async () => {
    const response = await request(app).get("/members/bad id!/next-chapter");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_MEMBER_ID");
  });

  it("each recommendation has required fields", async () => {
    const memberId = MOCK_MEMBERS[0].member_id;
    const response = await request(app).get(`/members/${memberId}/next-chapter`);

    expect(response.status).toBe(200);
    for (const rec of response.body.recommendations as NextChapterRecommendation[]) {
      expect(typeof rec.quest_id).toBe("string");
      expect(typeof rec.title).toBe("string");
      expect(typeof rec.category).toBe("string");
      expect(typeof rec.relevance_score).toBe("number");
      expect(typeof rec.reason).toBe("string");
    }
  });

  it("returns recommendations for multiple members without errors", async () => {
    const memberIds = MOCK_MEMBERS.slice(0, 5).map((m) => m.member_id);
    for (const memberId of memberIds) {
      const response = await request(app).get(`/members/${memberId}/next-chapter`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("recommendations");
    }
  });
});

// ─── 11. Recommendation quality checks ───────────────────────────────────────

describe("Recommendation quality", () => {
  it("relevance_score is between 0.0 and 1.0", () => {
    const member = makeMember({ goal_category: "mindset" });
    const result = getNextChapterRecommendations(member, []);
    for (const rec of result.recommendations) {
      expect(rec.relevance_score).toBeGreaterThanOrEqual(0);
      expect(rec.relevance_score).toBeLessThanOrEqual(1);
    }
  });

  it("fallback relevance_score is lower than primary recommendation score", () => {
    const member = makeMember({ goal_category: "mindset" });
    const primary = getNextChapterRecommendations(member, []);
    const fallback = buildIntentFallback(member, []);

    if (primary.recommendations.length > 0 && fallback.recommendations.length > 0) {
      // Fallback scores are reduced (multiplied by 0.7)
      const topFallbackScore = fallback.recommendations[0].relevance_score;
      const topPrimaryScore = primary.recommendations[0].relevance_score;
      expect(topFallbackScore).toBeLessThan(topPrimaryScore);
    }
  });

  it("reason field is non-empty for all recommendations", () => {
    const member = makeMember({ goal_category: "career" });
    const result = getNextChapterRecommendations(member, []);
    for (const rec of result.recommendations) {
      expect(rec.reason.length).toBeGreaterThan(0);
    }
  });
});
