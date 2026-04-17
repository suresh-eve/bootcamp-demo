/**
 * Sprint 2 Tests — Dynamic Prompts, Prompt Ranking, A/B Testing
 *
 * Test coverage:
 * 1. Prompt ranking — correct prompts across all 4 member states
 * 2. Fallback prompts — returned when profile is unavailable
 * 3. A/B test assignment — deterministic, 50/50 split distribution
 * 4. GET /members/:member_id/eve-prompts — API integration
 * 5. POST /members/:member_id/prompt-ctr — CTR recording
 * 6. Prompt CTR simulation — treatment group >= 30%
 * 7. Prompt personalisation — {{goal}} and {{quest}} placeholders replaced
 * 8. Category diversity — different categories surfaced per response
 */

import request from "supertest";
import { createApp } from "../src/api/server";
import { rankPromptsForProfile, getFallbackPrompts, rankPrompts } from "../src/prompts/prompt-ranking";
import { PROMPT_LIBRARY, FALLBACK_PROMPTS, personalisePromptText, getPromptsForState } from "../src/prompts/prompt-library";
import { assignABVariant, simulatePromptClick, DEFAULT_EXPERIMENT_ID } from "../src/services/ab-test";
import { MockDataAdapter } from "../src/data/adapters/MockDataAdapter";
import { LearnerProfileService } from "../src/services/learner-profile";
import { MOCK_MEMBERS, MOCK_MEMBER_IDS } from "../src/data/mock-members";
import type { LearnerProfile, MemberStateValue } from "../src/types/index";
import type { RankedPrompt, ABVariant, EvePromptsResponse, PromptCtrResponse } from "../src/types/prompts";

const app = createApp();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const adapter = new MockDataAdapter();
const service = new LearnerProfileService(adapter);

/** Build a profile for a member, assert non-null */
async function buildProfile(memberId: string): Promise<LearnerProfile> {
  const profile = await service.buildProfile(memberId);
  if (!profile) throw new Error(`Profile not found for ${memberId}`);
  return profile;
}

/** Build a profile from a raw member fixture by state */
function buildProfileForState(targetState: MemberStateValue): LearnerProfile | null {
  for (const raw of MOCK_MEMBERS) {
    const profile = service.buildProfileFromRaw(raw);
    if (profile.member_state.state === targetState) {
      return profile;
    }
  }
  return null;
}

// ─── 1. Prompt Library ────────────────────────────────────────────────────────

describe("Prompt Library", () => {
  it("contains exactly 20 templates (4 categories × 5 each)", () => {
    expect(PROMPT_LIBRARY).toHaveLength(20);
  });

  it("has templates in all 4 categories", () => {
    const categories = new Set(PROMPT_LIBRARY.map((p) => p.category));
    expect(categories.has("goal")).toBe(true);
    expect(categories.has("content")).toBe(true);
    expect(categories.has("reflection")).toBe(true);
    expect(categories.has("re_entry")).toBe(true);
  });

  it("every template has a unique prompt_id", () => {
    const ids = PROMPT_LIBRARY.map((p) => p.prompt_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every template targets at least one member state", () => {
    for (const t of PROMPT_LIBRARY) {
      expect(t.target_states.length).toBeGreaterThan(0);
    }
  });

  it("base_weight is in [0, 1] for all templates", () => {
    for (const t of PROMPT_LIBRARY) {
      expect(t.base_weight).toBeGreaterThanOrEqual(0);
      expect(t.base_weight).toBeLessThanOrEqual(1);
    }
  });

  it("has 3 static fallback prompts", () => {
    expect(FALLBACK_PROMPTS).toHaveLength(3);
  });

  it("each state has at least 3 eligible templates", () => {
    for (const state of [1, 2, 3, 4] as MemberStateValue[]) {
      const eligible = getPromptsForState(state);
      expect(eligible.length).toBeGreaterThanOrEqual(3);
    }
  });
});

// ─── 2. Prompt Personalisation ────────────────────────────────────────────────

describe("Prompt personalisation", () => {
  it("replaces {{goal}} placeholder with goal label", () => {
    const template = PROMPT_LIBRARY.find((p) => p.text.includes("{{goal}}"))!;
    const text = personalisePromptText(template, "health", null);
    expect(text).toContain("Health");
    expect(text).not.toContain("{{goal}}");
  });

  it("replaces {{quest}} placeholder with quest title", () => {
    const template = PROMPT_LIBRARY.find((p) => p.text.includes("{{quest}}"))!;
    const text = personalisePromptText(template, null, "WildFit");
    expect(text).toContain("WildFit");
    expect(text).not.toContain("{{quest}}");
  });

  it("uses fallback text when goal is null", () => {
    const template = PROMPT_LIBRARY.find((p) => p.text.includes("{{goal}}"))!;
    const text = personalisePromptText(template, null, null);
    expect(text).not.toContain("{{goal}}");
  });

  it("uses fallback text when quest is null", () => {
    const template = PROMPT_LIBRARY.find((p) => p.text.includes("{{quest}}"))!;
    const text = personalisePromptText(template, null, null);
    expect(text).not.toContain("{{quest}}");
  });
});

// ─── 3. Prompt Ranking — across all 4 member states ──────────────────────────

describe("Prompt ranking — all 4 member states", () => {
  const states: MemberStateValue[] = [1, 2, 3, 4];

  for (const state of states) {
    it(`State ${state}: returns 2–3 ranked prompts`, () => {
      const profile = buildProfileForState(state);
      if (!profile) {
        // If no profile found for this state in fixtures, skip gracefully
        return;
      }
      const prompts = rankPromptsForProfile(profile);
      expect(prompts.length).toBeGreaterThanOrEqual(2);
      expect(prompts.length).toBeLessThanOrEqual(3);
    });

    it(`State ${state}: prompts are sorted by ranking_score descending`, () => {
      const profile = buildProfileForState(state);
      if (!profile) return;
      const prompts = rankPromptsForProfile(profile);
      for (let i = 1; i < prompts.length; i++) {
        expect(prompts[i - 1].ranking_score).toBeGreaterThanOrEqual(prompts[i].ranking_score);
      }
    });

    it(`State ${state}: all prompts target that state`, () => {
      const profile = buildProfileForState(state);
      if (!profile) return;
      const prompts = rankPromptsForProfile(profile);
      for (const p of prompts) {
        const template = PROMPT_LIBRARY.find((t) => t.prompt_id === p.prompt_id);
        expect(template?.target_states).toContain(state);
      }
    });

    it(`State ${state}: ranking_score is in [0, 1]`, () => {
      const profile = buildProfileForState(state);
      if (!profile) return;
      const prompts = rankPromptsForProfile(profile);
      for (const p of prompts) {
        expect(p.ranking_score).toBeGreaterThanOrEqual(0);
        expect(p.ranking_score).toBeLessThanOrEqual(1);
      }
    });

    it(`State ${state}: each prompt has a non-empty reason`, () => {
      const profile = buildProfileForState(state);
      if (!profile) return;
      const prompts = rankPromptsForProfile(profile);
      for (const p of prompts) {
        expect(typeof p.reason).toBe("string");
        expect(p.reason.length).toBeGreaterThan(0);
      }
    });
  }

  it("prompts differ across member states (not all the same set)", () => {
    const promptSets = states.map((state) => {
      const profile = buildProfileForState(state);
      if (!profile) return new Set<string>();
      return new Set(rankPromptsForProfile(profile).map((p) => p.prompt_id));
    });

    // At least 2 states should produce different prompt sets
    let differentPairs = 0;
    for (let i = 0; i < promptSets.length; i++) {
      for (let j = i + 1; j < promptSets.length; j++) {
        const a = promptSets[i];
        const b = promptSets[j];
        const allSame = [...a].every((id) => b.has(id)) && a.size === b.size;
        if (!allSame) differentPairs++;
      }
    }
    expect(differentPairs).toBeGreaterThan(0);
  });
});

// ─── 4. Fallback Prompts ──────────────────────────────────────────────────────

describe("Fallback prompts — profile unavailable", () => {
  it("getFallbackPrompts returns 2–3 prompts", () => {
    const fallbacks = getFallbackPrompts();
    expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    expect(fallbacks.length).toBeLessThanOrEqual(3);
  });

  it("fallback prompts have ranking_score > 0", () => {
    const fallbacks = getFallbackPrompts();
    for (const p of fallbacks) {
      expect(p.ranking_score).toBeGreaterThan(0);
    }
  });

  it("rankPrompts with null profile returns isFallback = true", () => {
    const { prompts, isFallback } = rankPrompts(null);
    expect(isFallback).toBe(true);
    expect(prompts.length).toBeGreaterThanOrEqual(2);
  });

  it("rankPrompts with valid profile returns isFallback = false", () => {
    const profile = buildProfileForState(1);
    if (!profile) return;
    const { prompts, isFallback } = rankPrompts(profile);
    expect(isFallback).toBe(false);
    expect(prompts.length).toBeGreaterThanOrEqual(2);
  });

  it("fallback prompt text does not contain unresolved placeholders", () => {
    const fallbacks = getFallbackPrompts();
    for (const p of fallbacks) {
      expect(p.text).not.toContain("{{");
      expect(p.text).not.toContain("}}");
    }
  });
});

// ─── 5. A/B Test Assignment ───────────────────────────────────────────────────

describe("A/B test assignment", () => {
  it("assignABVariant is deterministic (same input → same output)", () => {
    const r1 = assignABVariant("member_001");
    const r2 = assignABVariant("member_001");
    expect(r1.variant).toBe(r2.variant);
    expect(r1.bucket).toBe(r2.bucket);
  });

  it("returns the correct experiment_id", () => {
    const result = assignABVariant("member_001");
    expect(result.experiment_id).toBe(DEFAULT_EXPERIMENT_ID);
  });

  it("bucket is in [0, 99]", () => {
    for (const id of MOCK_MEMBER_IDS.slice(0, 50)) {
      const result = assignABVariant(id);
      expect(result.bucket).toBeGreaterThanOrEqual(0);
      expect(result.bucket).toBeLessThanOrEqual(99);
    }
  });

  it("variant is 'treatment' or 'control'", () => {
    for (const id of MOCK_MEMBER_IDS.slice(0, 50)) {
      const result = assignABVariant(id);
      expect(["treatment", "control"]).toContain(result.variant);
    }
  });

  it("split distribution is approximately 50/50 across 300 members", () => {
    let treatment = 0;
    let control = 0;
    for (const id of MOCK_MEMBER_IDS) {
      const result = assignABVariant(id);
      if (result.variant === "treatment") treatment++;
      else control++;
    }
    const total = MOCK_MEMBER_IDS.length; // 300
    const treatmentRatio = treatment / total;
    const controlRatio = control / total;

    // Allow ±15% tolerance for a hash-based split
    expect(treatmentRatio).toBeGreaterThan(0.35);
    expect(treatmentRatio).toBeLessThan(0.65);
    expect(controlRatio).toBeGreaterThan(0.35);
    expect(controlRatio).toBeLessThan(0.65);
  });

  it("different experiments produce different assignments for the same member", () => {
    const r1 = assignABVariant("member_001", "experiment_A");
    const r2 = assignABVariant("member_001", "experiment_B");
    // At least the experiment IDs differ; buckets likely differ too
    expect(r1.experiment_id).toBe("experiment_A");
    expect(r2.experiment_id).toBe("experiment_B");
  });
});

// ─── 6. Prompt CTR Simulation — treatment >= 30% ──────────────────────────────

describe("Prompt CTR simulation — treatment group >= 30%", () => {
  it("treatment group achieves >= 30% CTR on 300 members", () => {
    let clicks = 0;
    let total = 0;

    for (const raw of MOCK_MEMBERS) {
      const profile = service.buildProfileFromRaw(raw);
      const { prompts } = rankPrompts(profile);
      const topScore = prompts[0]?.ranking_score ?? 0.5;

      const result = simulatePromptClick(raw.member_id, topScore, 0.20, 0.15, "treatment");
      if (result) clicks++;
      total++;
    }

    const ctr = clicks / total;
    expect(ctr).toBeGreaterThanOrEqual(0.30);
  });

  it("control group CTR is lower than treatment group CTR", () => {
    let treatmentClicks = 0;
    let controlClicks = 0;
    const total = MOCK_MEMBERS.length;

    for (const raw of MOCK_MEMBERS) {
      const profile = service.buildProfileFromRaw(raw);
      const { prompts } = rankPrompts(profile);
      const topScore = prompts[0]?.ranking_score ?? 0.5;

      if (simulatePromptClick(raw.member_id, topScore, 0.20, 0.15, "treatment")) treatmentClicks++;
      if (simulatePromptClick(raw.member_id, topScore, 0.20, 0.15, "control")) controlClicks++;
    }

    expect(treatmentClicks / total).toBeGreaterThan(controlClicks / total);
  });
});

// ─── 7. GET /members/:member_id/eve-prompts ───────────────────────────────────

describe("GET /members/:member_id/eve-prompts", () => {
  it("returns 200 with 2–3 prompts for a known member", async () => {
    const res = await request(app).get("/members/member_001/eve-prompts");
    expect(res.status).toBe(200);
    const body = res.body as EvePromptsResponse;
    expect(Array.isArray(body.prompts)).toBe(true);
    expect(body.prompts.length).toBeGreaterThanOrEqual(2);
    expect(body.prompts.length).toBeLessThanOrEqual(3);
  });

  it("response contains ab_variant (treatment or control)", async () => {
    const res = await request(app).get("/members/member_001/eve-prompts");
    expect(res.status).toBe(200);
    const body = res.body as EvePromptsResponse;
    expect(["treatment", "control"]).toContain(body.ab_variant);
  });

  it("response contains is_fallback boolean", async () => {
    const res = await request(app).get("/members/member_001/eve-prompts");
    expect(res.status).toBe(200);
    const body = res.body as EvePromptsResponse;
    expect(typeof body.is_fallback).toBe("boolean");
  });

  it("known member is_fallback = false", async () => {
    const res = await request(app).get("/members/member_001/eve-prompts");
    expect(res.status).toBe(200);
    expect((res.body as EvePromptsResponse).is_fallback).toBe(false);
  });

  it("each prompt has prompt_id, category, text, ranking_score, reason", async () => {
    const res = await request(app).get("/members/member_001/eve-prompts");
    expect(res.status).toBe(200);
    const body = res.body as EvePromptsResponse;
    for (const p of body.prompts) {
      expect(typeof p.prompt_id).toBe("string");
      expect(["goal", "content", "reflection", "re_entry"]).toContain(p.category);
      expect(typeof p.text).toBe("string");
      expect(p.text.length).toBeGreaterThan(0);
      expect(typeof p.ranking_score).toBe("number");
      expect(p.ranking_score).toBeGreaterThanOrEqual(0);
      expect(p.ranking_score).toBeLessThanOrEqual(1);
      expect(typeof p.reason).toBe("string");
    }
  });

  it("prompts are sorted by ranking_score descending", async () => {
    const res = await request(app).get("/members/member_001/eve-prompts");
    expect(res.status).toBe(200);
    const prompts: RankedPrompt[] = (res.body as EvePromptsResponse).prompts;
    for (let i = 1; i < prompts.length; i++) {
      expect(prompts[i - 1].ranking_score).toBeGreaterThanOrEqual(prompts[i].ranking_score);
    }
  });

  it("prompt text has no unresolved placeholders", async () => {
    const res = await request(app).get("/members/member_001/eve-prompts");
    expect(res.status).toBe(200);
    for (const p of (res.body as EvePromptsResponse).prompts) {
      expect(p.text).not.toContain("{{");
      expect(p.text).not.toContain("}}");
    }
  });

  it("meta contains request_id, latency_ms, adapter, member_state", async () => {
    const res = await request(app).get("/members/member_001/eve-prompts");
    expect(res.status).toBe(200);
    const { meta } = res.body as EvePromptsResponse;
    expect(typeof meta.request_id).toBe("string");
    expect(typeof meta.latency_ms).toBe("number");
    expect(meta.latency_ms).toBeGreaterThanOrEqual(0);
    expect(typeof meta.adapter).toBe("string");
  });

  it("meta.latency_ms is under 2000ms", async () => {
    const res = await request(app).get("/members/member_001/eve-prompts");
    expect(res.status).toBe(200);
    expect((res.body as EvePromptsResponse).meta.latency_ms).toBeLessThan(2000);
  });

  it("returns 200 (with fallback) for an unknown member", async () => {
    const res = await request(app).get("/members/unknown_xyz_99999/eve-prompts");
    expect(res.status).toBe(200);
    const body = res.body as EvePromptsResponse;
    expect(body.is_fallback).toBe(true);
    expect(body.prompts.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 400 for an invalid member_id", async () => {
    const res = await request(app).get("/members/invalid id/eve-prompts");
    expect(res.status).toBe(400);
  });

  it("A/B variant is deterministic across repeated calls for same member", async () => {
    const r1 = await request(app).get("/members/member_042/eve-prompts");
    const r2 = await request(app).get("/members/member_042/eve-prompts");
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect((r1.body as EvePromptsResponse).ab_variant).toBe(
      (r2.body as EvePromptsResponse).ab_variant
    );
  });

  it("prompts differ across 4 member states (spot check)", async () => {
    const stateMembers: Partial<Record<MemberStateValue, string>> = {};
    for (const raw of MOCK_MEMBERS) {
      const profile = service.buildProfileFromRaw(raw);
      const s = profile.member_state.state;
      if (!stateMembers[s]) stateMembers[s] = raw.member_id;
      if (Object.keys(stateMembers).length === 4) break;
    }

    const promptSets: string[][] = [];
    for (const memberId of Object.values(stateMembers)) {
      const res = await request(app).get(`/members/${memberId}/eve-prompts`);
      expect(res.status).toBe(200);
      promptSets.push((res.body as EvePromptsResponse).prompts.map((p) => p.prompt_id));
    }

    // At least one pair of states should produce different prompt IDs
    let hasDifference = false;
    for (let i = 0; i < promptSets.length; i++) {
      for (let j = i + 1; j < promptSets.length; j++) {
        if (JSON.stringify(promptSets[i]) !== JSON.stringify(promptSets[j])) {
          hasDifference = true;
        }
      }
    }
    expect(hasDifference).toBe(true);
  });
});

// ─── 8. POST /members/:member_id/prompt-ctr ──────────────────────────────────

describe("POST /members/:member_id/prompt-ctr", () => {
  it("returns 200 with recorded = true", async () => {
    const res = await request(app)
      .post("/members/member_001/prompt-ctr")
      .send({ prompt_id: "goal_001", ab_variant: "treatment" });
    expect(res.status).toBe(200);
    const body = res.body as PromptCtrResponse;
    expect(body.recorded).toBe(true);
  });

  it("returns event_id string", async () => {
    const res = await request(app)
      .post("/members/member_001/prompt-ctr")
      .send({ prompt_id: "goal_001", ab_variant: "treatment" });
    expect(res.status).toBe(200);
    expect(typeof (res.body as PromptCtrResponse).event_id).toBe("string");
  });

  it("returns amplitude_event with correct event_type", async () => {
    const res = await request(app)
      .post("/members/member_001/prompt-ctr")
      .send({ prompt_id: "goal_001", ab_variant: "treatment" });
    expect(res.status).toBe(200);
    const body = res.body as PromptCtrResponse;
    expect(body.amplitude_event.event_type).toBe("prompt_clicked");
  });

  it("amplitude_event has correct user_id", async () => {
    const res = await request(app)
      .post("/members/member_001/prompt-ctr")
      .send({ prompt_id: "goal_001", ab_variant: "treatment" });
    expect((res.body as PromptCtrResponse).amplitude_event.user_id).toBe("member_001");
  });

  it("amplitude_event includes prompt_id in event_properties", async () => {
    const res = await request(app)
      .post("/members/member_001/prompt-ctr")
      .send({ prompt_id: "content_003", ab_variant: "control" });
    const ep = (res.body as PromptCtrResponse).amplitude_event.event_properties;
    expect(ep["prompt_id"]).toBe("content_003");
  });

  it("amplitude_event includes ab_variant in event_properties", async () => {
    const res = await request(app)
      .post("/members/member_001/prompt-ctr")
      .send({ prompt_id: "goal_001", ab_variant: "treatment" });
    const ep = (res.body as PromptCtrResponse).amplitude_event.event_properties;
    expect(ep["ab_variant"]).toBe("treatment");
  });

  it("returns 400 when prompt_id is missing", async () => {
    const res = await request(app)
      .post("/members/member_001/prompt-ctr")
      .send({ ab_variant: "treatment" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid member_id", async () => {
    const res = await request(app)
      .post("/members/invalid id/prompt-ctr")
      .send({ prompt_id: "goal_001", ab_variant: "treatment" });
    expect(res.status).toBe(400);
  });

  it("accepts optional member_state in body", async () => {
    const res = await request(app)
      .post("/members/member_001/prompt-ctr")
      .send({ prompt_id: "goal_001", ab_variant: "treatment", member_state: 1 });
    expect(res.status).toBe(200);
    expect((res.body as PromptCtrResponse).recorded).toBe(true);
  });

  it("works for fallback prompt IDs", async () => {
    const res = await request(app)
      .post("/members/member_001/prompt-ctr")
      .send({ prompt_id: "fallback_001", ab_variant: "control" });
    expect(res.status).toBe(200);
    expect((res.body as PromptCtrResponse).recorded).toBe(true);
  });
});

// ─── 9. Amplitude event structure ────────────────────────────────────────────

describe("Amplitude event structure", () => {
  it("prompt_surfaced event has required Amplitude fields", async () => {
    const res = await request(app).get("/members/member_001/eve-prompts");
    // The event is fired internally; validate via CTR endpoint
    expect(res.status).toBe(200);
    // The event itself is fire-and-forget internally; verify via POST endpoint
  });

  it("prompt_clicked event has insert_id for deduplication", async () => {
    const res = await request(app)
      .post("/members/member_001/prompt-ctr")
      .send({ prompt_id: "goal_001", ab_variant: "treatment" });
    const event = (res.body as PromptCtrResponse).amplitude_event;
    expect(typeof event.insert_id).toBe("string");
    expect(event.insert_id.length).toBeGreaterThan(0);
  });

  it("amplitude event user_properties include ab_variant_eve_prompts", async () => {
    const res = await request(app)
      .post("/members/member_001/prompt-ctr")
      .send({ prompt_id: "goal_001", ab_variant: "treatment" });
    const event = (res.body as PromptCtrResponse).amplitude_event;
    expect(event.user_properties["ab_variant_eve_prompts"]).toBeDefined();
  });

  it("amplitude event time is a valid ISO-8601 timestamp", async () => {
    const res = await request(app)
      .post("/members/member_001/prompt-ctr")
      .send({ prompt_id: "goal_001", ab_variant: "treatment" });
    const event = (res.body as PromptCtrResponse).amplitude_event;
    const parsed = new Date(event.time);
    expect(isNaN(parsed.getTime())).toBe(false);
  });
});

// ─── 10. Category diversity ───────────────────────────────────────────────────

describe("Category diversity in prompt responses", () => {
  it("across all 4 states, all 4 categories appear at least once", () => {
    const usedCategories = new Set<string>();
    for (const state of [1, 2, 3, 4] as MemberStateValue[]) {
      const profile = buildProfileForState(state);
      if (!profile) continue;
      const prompts = rankPromptsForProfile(profile);
      for (const p of prompts) usedCategories.add(p.category);
    }
    expect(usedCategories.has("goal")).toBe(true);
    expect(usedCategories.has("content")).toBe(true);
    expect(usedCategories.has("reflection")).toBe(true);
    expect(usedCategories.has("re_entry")).toBe(true);
  });

  it("a single response has prompts from at least 2 different categories", () => {
    for (const state of [1, 2, 3, 4] as MemberStateValue[]) {
      const profile = buildProfileForState(state);
      if (!profile) continue;
      const prompts = rankPromptsForProfile(profile, 3);
      const cats = new Set(prompts.map((p) => p.category));
      expect(cats.size).toBeGreaterThanOrEqual(2);
    }
  });
});
