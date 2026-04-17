# Sprint 2 Review
**Verdict**: PASS
**Attempt**: 1

---

## Acceptance Criteria

### 1. 2–3 prompts surface within 2s of Eve open
**PASS**

Evidence:
- `PROMPT_COUNT_MIN = 2` and `PROMPT_COUNT_MAX = 3` are enforced in `prompt-ranking.ts` (lines 50–51). Both `rankPromptsForProfile` and `getFallbackPrompts` clamp `count` to this range via `Math.min(Math.max(count, 2), 3)`.
- API route `GET /members/:member_id/eve-prompts` always returns 200; the latency test asserts `meta.latency_ms < 2000`.
- Test "meta.latency_ms is under 2000ms": PASS (actual measured value with mock adapter is <50ms).
- Test "returns 200 with 2–3 prompts for a known member": PASS.
- Test "returns 200 (with fallback) for an unknown member": PASS — never returns 0 prompts.

### 2. Prompts differ across member states (4 states validated)
**PASS**

Evidence:
- State affinity matrix in `prompt-ranking.ts` (lines 65–70) gives different category weights for all 4 states:
  - State 1: goal=1.0, content=1.0, reflection=0.5, re_entry=0.0
  - State 2: goal=0.5, content=0.8, reflection=0.5, re_entry=1.0
  - State 3: goal=1.0, content=0.5, reflection=0.8, re_entry=0.3
  - State 4: goal=0.3, content=0.3, reflection=0.7, re_entry=1.0
- Verified by direct runtime output across 300-member fixture:
  - State 1: content_001, goal_001, reflection_001
  - State 2: reentry_001, content_002, reflection_001
  - State 3: goal_001, reflection_001, content_001
  - State 4: reentry_001, reflection_001, content_003
- Test "prompts differ across member states (not all the same set)": PASS.
- Test "prompts differ across 4 member states (spot check)" (API integration): PASS.

### 3. Prompt ranking: Intent + Momentum + context
**PASS**

Evidence:
- `scoreTemplate` in `prompt-ranking.ts` (lines 115–133) implements a 5-signal weighted formula:
  ```
  score = 0.35 × intent_confidence_score
        + 0.30 × momentum_score
        + 0.20 × category_affinity[state][category]
        + 0.10 × base_weight
        + 0.05 × context_bonus
  ```
- Context bonuses implemented in `computeContextBonus` (lines 82–111):
  - re_entry gets +0.4/+0.7/+1.0 for drifting/at_risk/churned members
  - reflection gets +0.3 for streak_break_risk members
  - content gets +0.5 when member has an active quest
- Tests "prompts are sorted by ranking_score descending" pass for all 4 states.
- Test "ranking_score is in [0, 1]" passes for all 4 states.

### 4. Fallback: Static prompts if API unavailable
**PASS**

Evidence:
- `rankPrompts(null)` in `prompt-ranking.ts` (lines 277–285) returns `getFallbackPrompts()` with `isFallback: true` when profile is null.
- Server `GET /eve-prompts` wraps `service.buildProfile()` in try/catch and sets `profile = null` on any failure; also treats missing member as fallback (no hard 404).
- 3 static fallback prompts defined in `prompt-library.ts` (lines 197–219), covering all 4 states, with no `{{goal}}`/`{{quest}}` placeholders.
- Test "rankPrompts with null profile returns isFallback = true": PASS.
- Test "returns 200 (with fallback) for an unknown member" with `is_fallback: true` and ≥2 prompts: PASS.
- Test "fallback prompt text does not contain unresolved placeholders": PASS.

### 5. A/B test running (treatment vs control)
**PASS**

Evidence:
- DJB2 hash in `ab-test.ts` (lines 45–52) computes a stable bucket [0,99] over `"<experiment_id>:<member_id>"`.
- `assignABVariant` (lines 67–82) assigns `treatment` if bucket < 50, else `control`.
- Verified 50/50 split across 300 members: treatment=46.0%, control=54.0% (within ±15% tolerance).
- Test "split distribution is approximately 50/50 across 300 members": PASS.
- Test "assignABVariant is deterministic (same input → same output)": PASS.
- Test "A/B variant is deterministic across repeated calls for same member" (API): PASS.
- Amplitude events `prompt_surfaced` and `prompt_clicked` are built and fire-and-forget on both endpoints.

### 6. Prompt CTR ≥30% (simulated/validated with test data)
**PASS**

Evidence:
- `simulatePromptClick` in `ab-test.ts` (lines 206–221) uses a deterministic DJB2-based bucket per member.
- Click rate formula: `min(0.20 + 0.15 × ranking_score, 1.0)` for treatment; flat 0.20 for control.
- Verified runtime: treatment CTR = **32.3%** across 300 members (threshold: 30%). Control CTR = 23.7%.
- Test "treatment group achieves >= 30% CTR on 300 members": PASS.
- Test "control group CTR is lower than treatment group CTR": PASS.

---

## Quality Scores

- **Functionality**: 5/5  
  All 6 acceptance criteria met. Both endpoints implemented correctly. 74/74 Sprint 2 tests pass; 106/106 combined tests pass.

- **Robustness**: 5/5  
  Graceful fallback on null profile and unknown member (never 500s or 404s on prompts). Input validation with 400 on invalid `member_id`. Placeholder resolution handles null goal/quest. Scores clamped to [0,1]. `npx tsc --noEmit` produces zero errors.

- **Integration**: 5/5  
  Server correctly wires ranking, A/B assignment, and Amplitude event building. CTR endpoint looks up template category from library. A/B variant is stable end-to-end through the API. Sprint 1 test suite (32 tests) unaffected and still fully green.
