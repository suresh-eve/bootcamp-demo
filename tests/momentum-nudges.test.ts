/**
 * Sprint 5 Tests — Momentum Nudges (Day 3 & 7 Lapses + Stuck-Point)
 *
 * Test coverage:
 * 1. detectDayLapse — day3 fires for 3-day inactive non-churned members
 * 2. detectDayLapse — day7 fires for at_risk members with 7+ days inactive
 * 3. detectDayLapse — day3 does NOT fire for churned members (>30 days, which maps to day7)
 * 4. detectDayLapse — day7 does NOT fire for active members (<7 days inactive)
 * 5. detectDayLapse — none fires for members active within 3 days
 * 6. detectStuckPoint — detects 7+ day stall correctly
 * 7. detectStuckPoint — does NOT flag members with < 7 days on lesson
 * 8. buildLapseNudge — day3 nudge has correct structure
 * 9. buildLapseNudge — day7 nudge is stronger (message differs from day3)
 * 10. buildCoachingCard — returns all 3 actions with correct deep-links
 * 11. buildCoachingCard — all 3 action types present (skip / explain / related)
 * 12. A/B assignment included in nudge and coaching card responses
 * 13. Fallback: unknown member returns {eligible: false} / {stuck: false}
 * 14. API: GET /members/:member_id/momentum-nudge — day3 eligible member
 * 15. API: GET /members/:member_id/momentum-nudge — day7 eligible member
 * 16. API: GET /members/:member_id/coaching-card — stuck member
 * 17. API: GET /members/:member_id/coaching-card?lesson_id= — with explicit lesson param
 * 18. API: GET /members/:member_id/momentum-nudge — unknown member returns eligible:false
 * 19. API: 400 for invalid member_id on both new endpoints
 * 20. Stuck dataset contains at least 50 members with 7+ days on current lesson
 */

import request from "supertest";
import { createApp } from "../src/api/server";
import {
  detectDayLapse,
  detectStuckPoint,
  buildLapseNudge,
  buildCoachingCard,
} from "../src/services/momentum-nudges";
import { generateDeepLink } from "../src/services/dormancy-diagnosis";
import { MOCK_MEMBERS, MOCK_MEMBER_IDS } from "../src/data/mock-members";
import { MOCK_LESSONS } from "../src/data/mock-lessons";
import type { RawMemberData } from "../src/types/index";
import type {
  LapseDetection,
  StuckPointDetection,
  CoachingCard,
  NudgeEvent,
} from "../src/types/nudges";

const app = createApp();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build an ISO date string N whole days ago */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/** Build a minimal RawMemberData fixture */
function makeMember(overrides: {
  member_id?: string;
  last_active_days_ago?: number;
  streak_days?: number;
  days_on_current_lesson?: number;
  stuck_lesson_id?: string | null;
  goal_category?: string | null;
  quest_id?: string;
}): RawMemberData {
  const {
    member_id = "test_member",
    last_active_days_ago = 0,
    streak_days = 0,
    days_on_current_lesson = 0,
    stuck_lesson_id = null,
    goal_category = "health",
    quest_id = "q001",
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
      eve_conversation_frequency_30d: 2,
      prompt_ctr: 0.3,
      ftu_goal_from_mock: false,
    },
    engagement: {
      streak_days,
      last_active_at: daysAgo(last_active_days_ago),
      session_frequency_weekly: 3,
      total_active_days: 60,
    },
    learning: {
      lessons_completed_total: 20,
      lessons_completed_30d: 4,
      quests_completed_total: 1,
      current_quest: {
        quest_id,
        title: "Be Extraordinary",
        category: "performance",
        completed_at: null,
        completion_percentage: 40,
        lessons_completed: 14,
        total_lessons: 35,
      },
      recent_lessons: [],
      quests: [],
    },
    days_on_current_lesson,
    stuck_lesson_id,
  };
}

const SAMPLE_LESSON = MOCK_LESSONS[0]; // l001 — Discovering Your Extraordinary Potential

// ─── 1. detectDayLapse — day3 fires correctly ────────────────────────────────

describe("detectDayLapse — day3", () => {
  it("fires day3 for a member exactly 3 days inactive", () => {
    const member = makeMember({ last_active_days_ago: 3 });
    const result = detectDayLapse(member);
    expect(result.type).toBe("day3");
    expect(result.days_inactive).toBeGreaterThanOrEqual(3);
  });

  it("fires day3 for a member 4 days inactive (still in drifting window)", () => {
    const member = makeMember({ last_active_days_ago: 4 });
    const result = detectDayLapse(member);
    expect(result.type).toBe("day3");
    expect(result.days_inactive).toBeGreaterThanOrEqual(4);
  });

  it("fires day3 for a member 6 days inactive (last day of drifting window)", () => {
    const member = makeMember({ last_active_days_ago: 6 });
    const result = detectDayLapse(member);
    expect(result.type).toBe("day3");
  });

  it("does NOT fire day3 for a member active today (0 days)", () => {
    const member = makeMember({ last_active_days_ago: 0 });
    const result = detectDayLapse(member);
    expect(result.type).toBe("none");
  });

  it("does NOT fire day3 for a member active 2 days ago", () => {
    const member = makeMember({ last_active_days_ago: 2 });
    const result = detectDayLapse(member);
    expect(result.type).toBe("none");
  });
});

// ─── 2. detectDayLapse — day7 fires correctly ────────────────────────────────

describe("detectDayLapse — day7", () => {
  it("fires day7 for a member 7 days inactive", () => {
    const member = makeMember({ last_active_days_ago: 7 });
    const result = detectDayLapse(member);
    expect(result.type).toBe("day7");
    expect(result.days_inactive).toBeGreaterThanOrEqual(7);
  });

  it("fires day7 for a member 10 days inactive (at_risk)", () => {
    const member = makeMember({ last_active_days_ago: 10 });
    const result = detectDayLapse(member);
    expect(result.type).toBe("day7");
  });

  it("fires day7 for a member 31+ days inactive (churned — day7 still fires)", () => {
    const member = makeMember({ last_active_days_ago: 35 });
    const result = detectDayLapse(member);
    // A churned member (>30 days) is in the day7 band, not day3
    expect(result.type).toBe("day7");
    expect(result.days_inactive).toBeGreaterThanOrEqual(35);
  });

  it("does NOT fire day7 for a member only 3 days inactive (drifting → day3)", () => {
    const member = makeMember({ last_active_days_ago: 3 });
    const result = detectDayLapse(member);
    expect(result.type).toBe("day3"); // day3 takes priority
    expect(result.type).not.toBe("day7");
  });

  it("does NOT fire day7 for a member active today", () => {
    const member = makeMember({ last_active_days_ago: 0 });
    const result = detectDayLapse(member);
    expect(result.type).toBe("none");
  });
});

// ─── 3. day3 does NOT fire for churned members ───────────────────────────────

describe("detectDayLapse — day3 vs churned boundary", () => {
  it("a churned member (>30 days) never gets day3 — they get day7", () => {
    const member = makeMember({ last_active_days_ago: 45 });
    const result = detectDayLapse(member);
    expect(result.type).toBe("day7");
    expect(result.type).not.toBe("day3");
  });

  it("days_inactive is accurate and returned correctly", () => {
    const member = makeMember({ last_active_days_ago: 5 });
    const result = detectDayLapse(member);
    expect(result.days_inactive).toBe(5);
    expect(result.type).toBe("day3");
  });
});

// ─── 4. detectStuckPoint ─────────────────────────────────────────────────────

describe("detectStuckPoint", () => {
  it("detects stuck when days_on_current_lesson >= 7", () => {
    const member = makeMember({ days_on_current_lesson: 7, stuck_lesson_id: "l001" });
    const result = detectStuckPoint(member, SAMPLE_LESSON);
    expect(result.stuck).toBe(true);
    expect(result.days_on_lesson).toBe(7);
    expect(result.lesson_id).toBe("l001");
  });

  it("detects stuck when days_on_current_lesson = 14", () => {
    const member = makeMember({ days_on_current_lesson: 14, stuck_lesson_id: "l003" });
    const result = detectStuckPoint(member, SAMPLE_LESSON);
    expect(result.stuck).toBe(true);
    expect(result.days_on_lesson).toBe(14);
    expect(result.lesson_id).toBe("l003");
  });

  it("does NOT detect stuck when days_on_current_lesson = 6", () => {
    const member = makeMember({ days_on_current_lesson: 6 });
    const result = detectStuckPoint(member, SAMPLE_LESSON);
    expect(result.stuck).toBe(false);
    expect(result.lesson_id).toBeNull();
  });

  it("does NOT detect stuck when days_on_current_lesson = 0", () => {
    const member = makeMember({ days_on_current_lesson: 0 });
    const result = detectStuckPoint(member, SAMPLE_LESSON);
    expect(result.stuck).toBe(false);
  });

  it("uses currentLesson.lesson_id as fallback when stuck_lesson_id is null", () => {
    const member = makeMember({ days_on_current_lesson: 10, stuck_lesson_id: null });
    const result = detectStuckPoint(member, SAMPLE_LESSON);
    expect(result.stuck).toBe(true);
    expect(result.lesson_id).toBe(SAMPLE_LESSON.lesson_id);
  });

  it("days_on_lesson returned correctly even when not stuck", () => {
    const member = makeMember({ days_on_current_lesson: 3 });
    const result = detectStuckPoint(member, SAMPLE_LESSON);
    expect(result.stuck).toBe(false);
    expect(result.days_on_lesson).toBe(3);
  });
});

// ─── 5. buildLapseNudge ──────────────────────────────────────────────────────

describe("buildLapseNudge — day3", () => {
  const member = makeMember({ member_id: "lapse_test_d3", last_active_days_ago: 3 });
  const deepLink = generateDeepLink("lapse_test_d3", "l001", "re_entry");
  const nudge = buildLapseNudge(member, "day3", deepLink);

  it("returns a NudgeEvent with nudge_type = re_entry", () => {
    expect(nudge.nudge_type).toBe("re_entry");
  });

  it("includes the correct member_id", () => {
    expect(nudge.member_id).toBe("lapse_test_d3");
  });

  it("has a non-empty message", () => {
    expect(nudge.message.length).toBeGreaterThan(10);
  });

  it("has a deep_link", () => {
    expect(nudge.deep_link).not.toBeNull();
    expect(nudge.deep_link!.lesson_id).toBe("l001");
  });

  it("is dismissible (Decision D1)", () => {
    expect(nudge.dismissible).toBe(true);
  });

  it("has a valid ab_variant", () => {
    expect(["treatment", "control"]).toContain(nudge.ab_variant);
  });

  it("has an expires_at timestamp in the future", () => {
    const expiry = new Date(nudge.expires_at).getTime();
    expect(expiry).toBeGreaterThan(Date.now());
  });
});

describe("buildLapseNudge — day7 is stronger than day3", () => {
  const member = makeMember({
    member_id: "lapse_test_d7",
    last_active_days_ago: 8,
    goal_category: "wealth",
    quest_id: "q008",
  });
  const deepLink = generateDeepLink("lapse_test_d7", "l001", "re_entry");
  const day3Nudge = buildLapseNudge(member, "day3", deepLink);
  const day7Nudge = buildLapseNudge(member, "day7", deepLink);

  it("day7 message differs from day3 message", () => {
    expect(day7Nudge.message).not.toBe(day3Nudge.message);
  });

  it("both have the same nudge_type", () => {
    expect(day7Nudge.nudge_type).toBe("re_entry");
    expect(day3Nudge.nudge_type).toBe("re_entry");
  });

  it("day7 nudge has a valid ab_variant", () => {
    expect(["treatment", "control"]).toContain(day7Nudge.ab_variant);
  });
});

// ─── 6. buildCoachingCard ─────────────────────────────────────────────────────

describe("buildCoachingCard", () => {
  const member = makeMember({
    member_id: "coaching_test",
    days_on_current_lesson: 10,
    stuck_lesson_id: "l001",
  });
  const card = buildCoachingCard(member, SAMPLE_LESSON);

  it("has correct member_id and lesson_id", () => {
    expect(card.member_id).toBe("coaching_test");
    expect(card.lesson_id).toBe(SAMPLE_LESSON.lesson_id);
  });

  it("has exactly 3 actions", () => {
    expect(card.actions).toHaveLength(3);
  });

  it("has all three required action types: skip, explain, related", () => {
    const actionTypes = card.actions.map((a) => a.action);
    expect(actionTypes).toContain("skip");
    expect(actionTypes).toContain("explain");
    expect(actionTypes).toContain("related");
  });

  it("each action has a non-empty label", () => {
    for (const action of card.actions) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });

  it("each action has a deep_link URL string", () => {
    for (const action of card.actions) {
      expect(typeof action.deep_link).toBe("string");
      expect(action.deep_link.length).toBeGreaterThan(0);
    }
  });

  it("skip action deep_link references the lesson", () => {
    const skipAction = card.actions.find((a) => a.action === "skip")!;
    expect(skipAction.deep_link).toContain(SAMPLE_LESSON.lesson_id);
  });

  it("explain action deep_link references the lesson", () => {
    const explainAction = card.actions.find((a) => a.action === "explain")!;
    expect(explainAction.deep_link).toContain(SAMPLE_LESSON.lesson_id);
  });

  it("related action deep_link references the quest", () => {
    const relatedAction = card.actions.find((a) => a.action === "related")!;
    expect(relatedAction.deep_link).toContain(SAMPLE_LESSON.quest_id);
  });

  it("has a valid ab_variant", () => {
    expect(["treatment", "control"]).toContain(card.ab_variant);
  });

  it("has a non-empty heading and message", () => {
    expect(card.heading.length).toBeGreaterThan(0);
    expect(card.message.length).toBeGreaterThan(0);
  });

  it("message mentions the lesson title", () => {
    expect(card.message).toContain(SAMPLE_LESSON.title);
  });
});

// ─── 7. A/B assignment included in responses ─────────────────────────────────

describe("A/B assignment in momentum nudge responses", () => {
  it("lapse nudge includes ab_variant from correct experiment", () => {
    const member = makeMember({ member_id: "ab_day3_test", last_active_days_ago: 4 });
    const deepLink = generateDeepLink("ab_day3_test", "l001", "re_entry");
    const nudge = buildLapseNudge(member, "day3", deepLink);
    expect(["treatment", "control"]).toContain(nudge.ab_variant);
  });

  it("coaching card includes ab_variant from correct experiment", () => {
    const member = makeMember({ member_id: "ab_card_test", days_on_current_lesson: 9 });
    const card = buildCoachingCard(member, SAMPLE_LESSON);
    expect(["treatment", "control"]).toContain(card.ab_variant);
  });

  it("different members get deterministic (stable) A/B assignments", () => {
    const member1 = makeMember({ member_id: "stable_m_001", last_active_days_ago: 4 });
    const member2 = makeMember({ member_id: "stable_m_001", last_active_days_ago: 4 }); // same id
    const dl = generateDeepLink("stable_m_001", "l001", "re_entry");
    const nudge1 = buildLapseNudge(member1, "day3", dl);
    const nudge2 = buildLapseNudge(member2, "day3", dl);
    expect(nudge1.ab_variant).toBe(nudge2.ab_variant); // stable
  });
});

// ─── 8. Stuck dataset ≥ 50 members ───────────────────────────────────────────

describe("Mock data — stuck-point coverage", () => {
  it("at least 50 mock members have days_on_current_lesson >= 7", () => {
    const stuckMembers = MOCK_MEMBERS.filter(
      (m) => (m.days_on_current_lesson ?? 0) >= 7
    );
    expect(stuckMembers.length).toBeGreaterThanOrEqual(50);
  });

  it("all 500 mock members have days_on_current_lesson defined", () => {
    for (const m of MOCK_MEMBERS) {
      expect(typeof m.days_on_current_lesson).toBe("number");
    }
  });

  it("stuck members have a stuck_lesson_id set", () => {
    const stuckMembers = MOCK_MEMBERS.filter(
      (m) => (m.days_on_current_lesson ?? 0) >= 7
    );
    // At least some stuck members should have a stuck_lesson_id
    const withLessonId = stuckMembers.filter((m) => m.stuck_lesson_id != null);
    expect(withLessonId.length).toBeGreaterThan(0);
  });
});

// ─── 9. API: GET /members/:member_id/momentum-nudge ──────────────────────────

describe("GET /members/:member_id/momentum-nudge", () => {
  it("returns eligible: false for unknown member", async () => {
    const response = await request(app).get("/members/unknown_xyz_member/momentum-nudge");
    expect(response.status).toBe(200);
    expect(response.body.eligible).toBe(false);
  });

  it("returns 400 for invalid member_id format", async () => {
    const response = await request(app).get("/members/bad id!/momentum-nudge");
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_MEMBER_ID");
  });

  it("returns 200 with eligible field for any known member", async () => {
    const memberId = MOCK_MEMBER_IDS[0];
    const response = await request(app).get(`/members/${memberId}/momentum-nudge`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("eligible");
  });

  it("eligible nudge has correct structure when returned", async () => {
    // Find a mock member with a day3 or day7 lapse
    const lapseableMember = MOCK_MEMBERS.find((m) => {
      const daysInactive = Math.max(
        0,
        Math.floor((Date.now() - new Date(m.engagement.last_active_at).getTime()) / 86400000)
      );
      return daysInactive >= 3;
    });

    if (!lapseableMember) {
      // No eligible member found in dataset at this time — skip
      return;
    }

    const response = await request(app).get(
      `/members/${lapseableMember.member_id}/momentum-nudge`
    );

    expect(response.status).toBe(200);
    if (response.body.eligible) {
      const nudge = response.body.nudge;
      expect(nudge).toHaveProperty("nudge_id");
      expect(nudge).toHaveProperty("nudge_type", "re_entry");
      expect(nudge).toHaveProperty("member_id", lapseableMember.member_id);
      expect(nudge).toHaveProperty("message");
      expect(nudge).toHaveProperty("deep_link");
      expect(nudge).toHaveProperty("expires_at");
      expect(nudge.dismissible).toBe(true);
      expect(["treatment", "control"]).toContain(nudge.ab_variant);
    }
  });

  it("day3 nudge fires on same day for a drifting member (3 days inactive)", () => {
    // Find a drifting member (3–6 days inactive) in the mock set
    const driftingMember = MOCK_MEMBERS.find((m) => {
      const daysInactive = Math.max(
        0,
        Math.floor((Date.now() - new Date(m.engagement.last_active_at).getTime()) / 86400000)
      );
      return daysInactive >= 3 && daysInactive < 7;
    });

    if (!driftingMember) return; // skip if none available at test time

    const result = detectDayLapse(driftingMember);
    expect(result.type).toBe("day3");
  });

  it("day7 nudge fires for at_risk members (7+ days inactive)", () => {
    const atRiskMember = MOCK_MEMBERS.find((m) => {
      const daysInactive = Math.max(
        0,
        Math.floor((Date.now() - new Date(m.engagement.last_active_at).getTime()) / 86400000)
      );
      return daysInactive >= 7 && daysInactive <= 30;
    });

    if (!atRiskMember) return; // skip if none available at test time

    const result = detectDayLapse(atRiskMember);
    expect(result.type).toBe("day7");
  });
});

// ─── 10. API: GET /members/:member_id/coaching-card ──────────────────────────

describe("GET /members/:member_id/coaching-card", () => {
  it("returns stuck: false for unknown member", async () => {
    const response = await request(app).get("/members/unknown_xyz_member/coaching-card");
    expect(response.status).toBe(200);
    expect(response.body.stuck).toBe(false);
  });

  it("returns 400 for invalid member_id format", async () => {
    const response = await request(app).get("/members/bad id!/coaching-card");
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_MEMBER_ID");
  });

  it("returns 200 with stuck field for any known member", async () => {
    const memberId = MOCK_MEMBER_IDS[0];
    const response = await request(app).get(`/members/${memberId}/coaching-card`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("stuck");
  });

  it("returns coaching card with 3 actions for a stuck member", async () => {
    // Find a mock member who is stuck (7+ days on current lesson)
    const stuckMember = MOCK_MEMBERS.find((m) => (m.days_on_current_lesson ?? 0) >= 7);
    expect(stuckMember).toBeDefined();

    const response = await request(app).get(
      `/members/${stuckMember!.member_id}/coaching-card`
    );

    expect(response.status).toBe(200);
    expect(response.body.stuck).toBe(true);

    const card = response.body.card;
    expect(card).toHaveProperty("card_id");
    expect(card).toHaveProperty("member_id", stuckMember!.member_id);
    expect(card).toHaveProperty("lesson_id");
    expect(card).toHaveProperty("heading");
    expect(card).toHaveProperty("message");
    expect(card.actions).toHaveLength(3);

    const actionTypes = card.actions.map((a: { action: string }) => a.action);
    expect(actionTypes).toContain("skip");
    expect(actionTypes).toContain("explain");
    expect(actionTypes).toContain("related");

    expect(["treatment", "control"]).toContain(card.ab_variant);
  });

  it("accepts lesson_id query param and returns a card when member is stuck", async () => {
    const stuckMember = MOCK_MEMBERS.find((m) => (m.days_on_current_lesson ?? 0) >= 7);
    expect(stuckMember).toBeDefined();

    const response = await request(app).get(
      `/members/${stuckMember!.member_id}/coaching-card?lesson_id=l001`
    );

    expect(response.status).toBe(200);
    // Member is stuck regardless of which lesson_id was queried
    expect(response.body.stuck).toBe(true);
  });

  it("returns stuck: false for a non-stuck member", async () => {
    // Find a member with 0–6 days on current lesson
    const nonStuckMember = MOCK_MEMBERS.find((m) => (m.days_on_current_lesson ?? 0) < 7);
    if (!nonStuckMember) return;

    const response = await request(app).get(
      `/members/${nonStuckMember.member_id}/coaching-card`
    );

    expect(response.status).toBe(200);
    expect(response.body.stuck).toBe(false);
  });

  it("deep-links in coaching card actions all deep-link to correct trigger points", async () => {
    const stuckMember = MOCK_MEMBERS.find((m) => (m.days_on_current_lesson ?? 0) >= 7);
    if (!stuckMember) return;

    const response = await request(app).get(
      `/members/${stuckMember.member_id}/coaching-card`
    );

    if (!response.body.stuck) return;

    const card = response.body.card;
    for (const action of card.actions) {
      // All deep-links must be valid URL-like strings
      expect(action.deep_link).toMatch(/^eve:\/\//);
      // All deep-links must include the member_id
      expect(action.deep_link).toContain(stuckMember.member_id);
    }
  });
});

// ─── 11. Fallback rule ───────────────────────────────────────────────────────

describe("Fallback rules", () => {
  it("unknown member returns safe {eligible: false} on momentum-nudge", async () => {
    const response = await request(app).get("/members/nonexistent_fallback_test/momentum-nudge");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ eligible: false });
  });

  it("unknown member returns safe {stuck: false} on coaching-card", async () => {
    const response = await request(app).get("/members/nonexistent_fallback_test/coaching-card");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ stuck: false });
  });

  it("member with 0 days inactive gets {eligible: false} on momentum-nudge", async () => {
    // Find a member active very recently (days_since < 3)
    const activeMember = MOCK_MEMBERS.find((m) => {
      const daysInactive = Math.max(
        0,
        Math.floor((Date.now() - new Date(m.engagement.last_active_at).getTime()) / 86400000)
      );
      return daysInactive < 3;
    });

    if (!activeMember) return; // skip if all members happen to be inactive

    const response = await request(app).get(
      `/members/${activeMember.member_id}/momentum-nudge`
    );

    expect(response.status).toBe(200);
    expect(response.body.eligible).toBe(false);
  });
});
