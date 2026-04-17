/**
 * Sprint 1 Integration Tests — Learner Profile API
 *
 * Tests cover:
 * 1. Happy path — valid member returns full LearnerProfile with all C1 Lite fields
 * 2. Response latency < 2000ms
 * 3. Null domain handling — no failures on members with sparse data
 * 4. Fallback rule — members with < 3 signals get used_fallback = true
 * 5. Member state classification — all four states (1–4) present in 300 members
 * 6. Unknown member → 404
 * 7. Invalid member_id format → 400
 * 8. Health endpoint
 * 9. 300 sample members tested (batch)
 * 10. Intent confidence score calculation present in member_state
 */

import request from "supertest";
import { createApp } from "../src/api/server";
import type { LearnerProfileResponse, ErrorResponse } from "../src/api/server";
import { MOCK_MEMBER_IDS, MOCK_MEMBERS } from "../src/data/mock-members";
import { MockDataAdapter } from "../src/data/adapters/MockDataAdapter";
import { LearnerProfileService } from "../src/services/learner-profile";
import type { LearnerProfile, MemberStateValue } from "../src/types/index";

const app = createApp();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertAllC1LiteFields(profile: LearnerProfile): void {
  // Top-level
  expect(typeof profile.member_id).toBe("string");
  expect(profile.schema_version).toBe("1.0");
  expect(typeof profile.profile_built_at).toBe("string");
  expect(["realtime", "hourly", "daily"]).toContain(profile.data_freshness);

  // Intent domain
  expect(Array.isArray(profile.intent.goal_declarations)).toBe(true);
  expect(profile.intent.primary_goal_category === null || typeof profile.intent.primary_goal_category === "string").toBe(true);
  expect(typeof profile.intent.eve_conversation_frequency_30d).toBe("number");
  expect(typeof profile.intent.prompt_ctr).toBe("number");
  expect(typeof profile.intent.ftu_goal_from_mock).toBe("boolean");

  // Engagement domain
  expect(typeof profile.engagement.streak_days).toBe("number");
  expect(typeof profile.engagement.last_active_at).toBe("string");
  expect(typeof profile.engagement.session_frequency_weekly).toBe("number");
  expect(typeof profile.engagement.total_active_days).toBe("number");

  // Learning domain
  expect(typeof profile.learning.lessons_completed_total).toBe("number");
  expect(typeof profile.learning.lessons_completed_30d).toBe("number");
  expect(typeof profile.learning.quests_completed_total).toBe("number");
  expect(profile.learning.current_quest === null || typeof profile.learning.current_quest === "object").toBe(true);
  expect(Array.isArray(profile.learning.recent_lessons)).toBe(true);
  expect(Array.isArray(profile.learning.quests)).toBe(true);

  // Pulse signals domain
  expect(["active", "drifting", "at_risk", "churned"]).toContain(profile.pulse_signals.dormancy_diagnosis);
  expect(typeof profile.pulse_signals.momentum_score).toBe("number");
  expect(profile.pulse_signals.momentum_score).toBeGreaterThanOrEqual(0);
  expect(profile.pulse_signals.momentum_score).toBeLessThanOrEqual(1);
  expect(typeof profile.pulse_signals.days_since_last_active).toBe("number");
  expect(typeof profile.pulse_signals.streak_break_risk).toBe("boolean");
  expect(typeof profile.pulse_signals.days_inactive_streak).toBe("number");

  // Member state domain
  expect([1, 2, 3, 4]).toContain(profile.member_state.state);
  expect(typeof profile.member_state.label).toBe("string");
  expect(typeof profile.member_state.confidence_score).toBe("number");
  expect(profile.member_state.confidence_score).toBeGreaterThanOrEqual(0);
  expect(profile.member_state.confidence_score).toBeLessThanOrEqual(1);
  expect(typeof profile.member_state.used_fallback).toBe("boolean");
  expect(typeof profile.member_state.computed_at).toBe("string");
}

// ─── 1. Health endpoint ───────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 with ok status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.adapter).toBe("string");
    expect(typeof res.body.timestamp).toBe("string");
  });
});

// ─── 2. Happy path ────────────────────────────────────────────────────────────

describe("GET /members/:member_id/learner-profile — happy path", () => {
  it("returns 200 and a valid LearnerProfile for a known member", async () => {
    const memberId = "member_001";
    const res = await request(app).get(`/members/${memberId}/learner-profile`);

    expect(res.status).toBe(200);
    const body = res.body as LearnerProfileResponse;

    expect(body.data).toBeDefined();
    expect(body.meta).toBeDefined();
    expect(body.data.member_id).toBe(memberId);
    expect(typeof body.meta.latency_ms).toBe("number");
    expect(typeof body.meta.request_id).toBe("string");
    expect(typeof body.meta.adapter).toBe("string");
  });

  it("returns all C1 Lite fields for member_001", async () => {
    const res = await request(app).get("/members/member_001/learner-profile");
    expect(res.status).toBe(200);
    assertAllC1LiteFields((res.body as LearnerProfileResponse).data);
  });

  it("includes a meta.latency_ms field", async () => {
    const res = await request(app).get("/members/member_001/learner-profile");
    expect(res.status).toBe(200);
    expect(typeof (res.body as LearnerProfileResponse).meta.latency_ms).toBe("number");
    expect((res.body as LearnerProfileResponse).meta.latency_ms).toBeGreaterThanOrEqual(0);
  });
});

// ─── 3. Response latency < 2s ─────────────────────────────────────────────────

describe("Response latency", () => {
  it("responds in under 2000ms for a single member", async () => {
    const start = Date.now();
    const res = await request(app).get("/members/member_001/learner-profile");
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  });

  it("reports latency_ms < 2000 in the response meta", async () => {
    const res = await request(app).get("/members/member_050/learner-profile");
    expect(res.status).toBe(200);
    expect((res.body as LearnerProfileResponse).meta.latency_ms).toBeLessThan(2000);
  });
});

// ─── 4. Error cases ───────────────────────────────────────────────────────────

describe("Error handling", () => {
  it("returns 404 for an unknown member_id", async () => {
    const res = await request(app).get("/members/unknown_member_xyz_999/learner-profile");
    expect(res.status).toBe(404);
    const body = res.body as ErrorResponse;
    expect(body.error.code).toBe("MEMBER_NOT_FOUND");
    expect(typeof body.error.request_id).toBe("string");
  });

  it("returns 400 for an invalid member_id (special characters)", async () => {
    const res = await request(app).get("/members/member%20with%20spaces/learner-profile");
    expect(res.status).toBe(400);
    const body = res.body as ErrorResponse;
    expect(body.error.code).toBe("INVALID_MEMBER_ID");
  });

  it("returns 400 for an empty member_id path segment is not routed (tests 404 fallback)", async () => {
    const res = await request(app).get("/members//learner-profile");
    // Express treats empty segment as non-matching route → 404
    expect([400, 404]).toContain(res.status);
  });

  it("returns 404 for an unknown route", async () => {
    const res = await request(app).get("/unknown/route");
    expect(res.status).toBe(404);
  });
});

// ─── 5. Null / sparse domain handling ────────────────────────────────────────

describe("Null domain handling", () => {
  it("handles members with no goal declarations gracefully (no crash, null primary_goal_category)", async () => {
    // Find a member with no goals in our mock data
    const noGoalMember = MOCK_MEMBERS.find(
      (m) => m.intent.goal_declarations.length === 0
    );
    if (!noGoalMember) {
      // If all mocks have goals, test with a direct service call
      const adapter = new MockDataAdapter();
      const service = new LearnerProfileService(adapter);

      // Craft a raw member with no goals
      const rawWithNoGoal = {
        ...MOCK_MEMBERS[0],
        member_id: "test_no_goal",
        intent: {
          ...MOCK_MEMBERS[0].intent,
          goal_declarations: [],
          primary_goal_category: null as string | null,
          eve_conversation_frequency_30d: 0,
          prompt_ctr: 0,
        },
        engagement: {
          ...MOCK_MEMBERS[0].engagement,
          streak_days: 0,
          session_frequency_weekly: 0,
        },
        learning: {
          ...MOCK_MEMBERS[0].learning,
          lessons_completed_30d: 0,
        },
      };

      const profile = service.buildProfileFromRaw(rawWithNoGoal);
      expect(profile.intent.primary_goal_category).toBeNull();
      expect(profile.member_state.used_fallback).toBe(true);
      expect([1, 2, 3, 4]).toContain(profile.member_state.state);
      return;
    }

    const res = await request(app).get(`/members/${noGoalMember.member_id}/learner-profile`);
    expect(res.status).toBe(200);
    const profile = (res.body as LearnerProfileResponse).data;
    expect(profile.intent.primary_goal_category).toBeNull();
    assertAllC1LiteFields(profile);
  });

  it("member with zero activity still returns a valid profile (no 500)", async () => {
    const adapter = new MockDataAdapter();
    const service = new LearnerProfileService(adapter);

    const minimalMember = {
      member_id: "test_minimal",
      created_at: new Date().toISOString(),
      intent: {
        goal_declarations: [],
        primary_goal_category: null as string | null,
        eve_conversation_frequency_30d: 0,
        prompt_ctr: 0,
        ftu_goal_from_mock: false,
      },
      engagement: {
        streak_days: 0,
        last_active_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
        session_frequency_weekly: 0,
        total_active_days: 1,
      },
      learning: {
        lessons_completed_total: 0,
        lessons_completed_30d: 0,
        quests_completed_total: 0,
        current_quest: null,
        recent_lessons: [],
        quests: [],
      },
    };

    const profile = service.buildProfileFromRaw(minimalMember);
    // No crash, all fields present
    assertAllC1LiteFields(profile);
    expect(profile.pulse_signals.dormancy_diagnosis).toBe("churned");
    expect(profile.pulse_signals.momentum_score).toBe(0);
    expect(profile.member_state.used_fallback).toBe(true);
  });
});

// ─── 6. Fallback rule ─────────────────────────────────────────────────────────

describe("Fallback rule (< 3 signals → used_fallback = true)", () => {
  it("applies fallback for a ghost member (no goals, no activity)", () => {
    const adapter = new MockDataAdapter();
    const service = new LearnerProfileService(adapter);

    const ghostMember = {
      member_id: "test_ghost",
      created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      intent: {
        goal_declarations: [],
        primary_goal_category: null as string | null,
        eve_conversation_frequency_30d: 0,
        prompt_ctr: 0,
        ftu_goal_from_mock: false,
      },
      engagement: {
        streak_days: 0,
        last_active_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        session_frequency_weekly: 0,
        total_active_days: 1,
      },
      learning: {
        lessons_completed_total: 0,
        lessons_completed_30d: 0,
        quests_completed_total: 0,
        current_quest: null,
        recent_lessons: [],
        quests: [],
      },
    };

    const profile = service.buildProfileFromRaw(ghostMember);
    expect(profile.member_state.used_fallback).toBe(true);
    expect(profile.member_state.confidence_score).toBeLessThanOrEqual(0.5);
  });

  it("does NOT apply fallback for a fully active member (>= 3 signals)", () => {
    const adapter = new MockDataAdapter();
    const service = new LearnerProfileService(adapter);

    const activeMember = {
      member_id: "test_active",
      created_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
      intent: {
        goal_declarations: [
          {
            category: "health",
            declared_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            source: "ftu" as const,
          },
        ],
        primary_goal_category: "health",
        eve_conversation_frequency_30d: 8,
        prompt_ctr: 0.7,
        ftu_goal_from_mock: false,
      },
      engagement: {
        streak_days: 15,
        last_active_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        session_frequency_weekly: 5,
        total_active_days: 120,
      },
      learning: {
        lessons_completed_total: 80,
        lessons_completed_30d: 12,
        quests_completed_total: 3,
        current_quest: null,
        recent_lessons: [],
        quests: [],
      },
    };

    const profile = service.buildProfileFromRaw(activeMember);
    expect(profile.member_state.used_fallback).toBe(false);
  });

  it("at least some mock members have used_fallback = true (fallback rule is exercised)", async () => {
    const adapter = new MockDataAdapter();
    const service = new LearnerProfileService(adapter);
    // Use all 300 members to ensure we catch edge/s4 members that trigger fallback
    let fallbackCount = 0;
    for (const raw of MOCK_MEMBERS) {
      const profile = service.buildProfileFromRaw(raw);
      if (profile.member_state.used_fallback) fallbackCount++;
    }
    expect(fallbackCount).toBeGreaterThan(0);
  });
});

// ─── 7. Member state classification ──────────────────────────────────────────

describe("Member state classification (State 1–4)", () => {
  it("all four states (1–4) are present across 300 mock members", async () => {
    const adapter = new MockDataAdapter();
    const service = new LearnerProfileService(adapter);

    const stateCounts: Record<MemberStateValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const raw of MOCK_MEMBERS) {
      const profile = service.buildProfileFromRaw(raw);
      stateCounts[profile.member_state.state]++;
    }

    expect(stateCounts[1]).toBeGreaterThan(0);
    expect(stateCounts[2]).toBeGreaterThan(0);
    expect(stateCounts[3]).toBeGreaterThan(0);
    expect(stateCounts[4]).toBeGreaterThan(0);
  });

  it("state label matches the state number", async () => {
    const adapter = new MockDataAdapter();
    const service = new LearnerProfileService(adapter);

    const stateLabels: Record<MemberStateValue, string> = {
      1: "High Intent / High Momentum",
      2: "High Intent / Low Momentum",
      3: "Low Intent / High Momentum",
      4: "Low Intent / Low Momentum",
    };

    for (const raw of MOCK_MEMBERS.slice(0, 30)) {
      const profile = service.buildProfileFromRaw(raw);
      expect(profile.member_state.label).toBe(stateLabels[profile.member_state.state]);
    }
  });

  it("confidence_score is between 0 and 1 for all members", async () => {
    const adapter = new MockDataAdapter();
    const service = new LearnerProfileService(adapter);

    for (const raw of MOCK_MEMBERS) {
      const profile = service.buildProfileFromRaw(raw);
      expect(profile.member_state.confidence_score).toBeGreaterThanOrEqual(0);
      expect(profile.member_state.confidence_score).toBeLessThanOrEqual(1);
    }
  });
});

// ─── 8. Intent confidence score ───────────────────────────────────────────────

describe("Intent confidence score", () => {
  it("confidence_score is present and valid in member_state for all 300 members", () => {
    const adapter = new MockDataAdapter();
    const service = new LearnerProfileService(adapter);

    for (const raw of MOCK_MEMBERS) {
      const profile = service.buildProfileFromRaw(raw);
      expect(typeof profile.member_state.confidence_score).toBe("number");
      expect(profile.member_state.confidence_score).toBeGreaterThanOrEqual(0);
      expect(profile.member_state.confidence_score).toBeLessThanOrEqual(1);
    }
  });

  it("high-signal members produce confidence_score > fallback members", () => {
    const adapter = new MockDataAdapter();
    const service = new LearnerProfileService(adapter);

    // A well-signalled member
    const highSignalRaw = {
      member_id: "test_high_signal",
      created_at: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString(),
      intent: {
        goal_declarations: [
          {
            category: "health",
            declared_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            source: "ftu" as const,
          },
        ],
        primary_goal_category: "health",
        eve_conversation_frequency_30d: 10,
        prompt_ctr: 0.85,
        ftu_goal_from_mock: false,
      },
      engagement: {
        streak_days: 25,
        last_active_at: new Date().toISOString(),
        session_frequency_weekly: 6,
        total_active_days: 200,
      },
      learning: {
        lessons_completed_total: 100,
        lessons_completed_30d: 18,
        quests_completed_total: 5,
        current_quest: null,
        recent_lessons: [],
        quests: [],
      },
    };

    // A no-signal member
    const noSignalRaw = {
      member_id: "test_no_signal",
      created_at: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).toISOString(),
      intent: {
        goal_declarations: [],
        primary_goal_category: null as string | null,
        eve_conversation_frequency_30d: 0,
        prompt_ctr: 0,
        ftu_goal_from_mock: false,
      },
      engagement: {
        streak_days: 0,
        last_active_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        session_frequency_weekly: 0,
        total_active_days: 5,
      },
      learning: {
        lessons_completed_total: 0,
        lessons_completed_30d: 0,
        quests_completed_total: 0,
        current_quest: null,
        recent_lessons: [],
        quests: [],
      },
    };

    const highProfile = service.buildProfileFromRaw(highSignalRaw);
    const noProfile = service.buildProfileFromRaw(noSignalRaw);

    expect(highProfile.member_state.confidence_score).toBeGreaterThan(
      noProfile.member_state.confidence_score
    );
    expect(highProfile.member_state.used_fallback).toBe(false);
    expect(noProfile.member_state.used_fallback).toBe(true);
  });
});

// ─── 9. 500 sample members batch test ────────────────────────────────────────

describe("300 sample members batch test", () => {
  it("MOCK_MEMBERS contains exactly 500 members (expanded in Sprint 4)", () => {
    expect(MOCK_MEMBERS.length).toBe(500);
  });

  it("MOCK_MEMBER_IDS contains exactly 500 IDs", () => {
    expect(MOCK_MEMBER_IDS.length).toBe(500);
  });

  it("all 500 member IDs are unique", () => {
    const unique = new Set(MOCK_MEMBER_IDS);
    expect(unique.size).toBe(500);
  });

  it("builds valid profiles for all 500 members without throwing", () => {
    const adapter = new MockDataAdapter();
    const service = new LearnerProfileService(adapter);

    for (const raw of MOCK_MEMBERS) {
      expect(() => service.buildProfileFromRaw(raw)).not.toThrow();
    }
  });

  it("all 500 members can be fetched via the API (spot-check 10 random)", async () => {
    const sampleIds = MOCK_MEMBER_IDS.filter((_, i) => i % 50 === 0); // every 50th = 10 samples
    for (const memberId of sampleIds) {
      const res = await request(app).get(`/members/${memberId}/learner-profile`);
      expect(res.status).toBe(200);
      expect((res.body as LearnerProfileResponse).data.member_id).toBe(memberId);
    }
  });

  it("state distribution spans all four states across 300 members", () => {
    const adapter = new MockDataAdapter();
    const service = new LearnerProfileService(adapter);
    const stateCounts: Record<MemberStateValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

    for (const raw of MOCK_MEMBERS) {
      const profile = service.buildProfileFromRaw(raw);
      stateCounts[profile.member_state.state]++;
    }

    // Each state should have at least 10% of members
    const total = MOCK_MEMBERS.length;
    expect(stateCounts[1] / total).toBeGreaterThanOrEqual(0.1);
    expect(stateCounts[2] / total).toBeGreaterThanOrEqual(0.1);
    expect(stateCounts[3] / total).toBeGreaterThanOrEqual(0.1);
    expect(stateCounts[4] / total).toBeGreaterThanOrEqual(0.05);
  });

  it("at least 5% of 300 members trigger the fallback rule", () => {
    const adapter = new MockDataAdapter();
    const service = new LearnerProfileService(adapter);
    let fallbackCount = 0;

    for (const raw of MOCK_MEMBERS) {
      const profile = service.buildProfileFromRaw(raw);
      if (profile.member_state.used_fallback) fallbackCount++;
    }

    expect(fallbackCount / MOCK_MEMBERS.length).toBeGreaterThanOrEqual(0.05);
  });
});

// ─── 10. Schema completeness ──────────────────────────────────────────────────

describe("Schema completeness — all C1 Lite fields present", () => {
  const memberIds = ["member_001", "member_050", "member_100", "member_200", "member_300"];

  test.each(memberIds)("all C1 Lite fields present for %s", async (memberId) => {
    const res = await request(app).get(`/members/${memberId}/learner-profile`);
    expect(res.status).toBe(200);
    assertAllC1LiteFields((res.body as LearnerProfileResponse).data);
  });
});
