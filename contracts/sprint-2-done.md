# Sprint 2 Contract — Dynamic Prompts: Eve AI New Chat

**Status:** DONE  
**Date:** 2026-04-10  
**Sprint Goal:** Remove blank-page friction. Surface 2–3 personalised prompts on Eve open.

---

## What Was Built

### New Files

| File | Purpose |
|------|---------|
| `src/types/prompts.ts` | TypeScript types: PromptTemplate, RankedPrompt, EvePromptsResponse, PromptCtrRequest/Response, ABVariant, ABTestAssignment, AmplitudeEvent |
| `src/prompts/prompt-library.ts` | 20 prompt templates (4 categories × 5 each) + 3 static fallback prompts + personalisation helpers |
| `src/prompts/prompt-ranking.ts` | Rule-based ranking model v1: intent + momentum + category affinity + context bonus |
| `src/services/ab-test.ts` | DJB2 hash-based A/B assignment, Amplitude event builders, CTR simulation helper |
| `tests/eve-prompts.test.ts` | 74 tests covering all Sprint 2 acceptance criteria |

### Modified Files

| File | Changes |
|------|---------|
| `src/api/server.ts` | Added `GET /members/:member_id/eve-prompts` and `POST /members/:member_id/prompt-ctr` |
| `docs/openapi.yaml` | New paths + schemas: EvePromptsResponse, RankedPrompt, PromptCtrRequest/Response, AmplitudeEvent |

---

## Acceptance Criteria Status

| Criterion | Status | Evidence |
|-----------|--------|---------|
| 2–3 prompts surface within 2s of Eve open | PASS | `meta.latency_ms < 2000` enforced in tests; mock adapter responds in <50ms |
| Prompts differ across member states (4 states validated) | PASS | Test: "prompts differ across member states" + "prompts differ across 4 member states (spot check)" |
| Prompt ranking: Intent + Momentum + context | PASS | `prompt-ranking.ts` implements 5-signal weighted formula |
| Fallback: Static prompts if API unavailable | PASS | Unknown member returns `is_fallback: true` with 3 static prompts; always 200 |
| A/B test running (treatment vs control) | PASS | DJB2 hash gives stable 50/50 split; validated on 300 members |
| Prompt CTR ≥30% (simulated/validated) | PASS | `simulatePromptClick` on 300 members: treatment group ≥30% confirmed in test |

---

## API Endpoints Delivered

### `GET /members/:member_id/eve-prompts`
- Returns 2–3 ranked `RankedPrompt` objects
- Each prompt: `prompt_id`, `category`, `text` (personalised), `ranking_score`, `reason`
- A/B variant (`treatment` | `control`) determined deterministically per member
- Falls back to static prompts (never 404s) when profile is unavailable
- `is_fallback: true` signals static mode to callers

### `POST /members/:member_id/prompt-ctr`
- Records prompt click event
- Returns `recorded: true`, `event_id`, and full `amplitude_event` object
- `amplitude_event` conforms to Amplitude HTTP API v2 shape
- Includes `insert_id` for minute-level deduplication

---

## Prompt Library

**4 categories × 5 templates = 20 templates**

| Category | Target States | Theme |
|----------|--------------|-------|
| `goal` | 1, 2, 3, 4 | Connect activity to declared goal |
| `content` | 1, 2, 3, 4 | Quest/lesson recommendations |
| `reflection` | 1, 2, 3, 4 | Journaling & self-assessment |
| `re_entry` | 2, 3, 4 | Low-friction re-engagement |

**Personalisation placeholders:** `{{goal}}` and `{{quest}}` are replaced with live member data before surfacing.

---

## Ranking Model v1

```
score = 0.35 × intent_confidence_score
      + 0.30 × momentum_score
      + 0.20 × category_affinity[state][category]
      + 0.10 × template.base_weight
      + 0.05 × context_bonus
```

**Context bonuses:**
- `re_entry` prompts: +0.4–1.0 boost when member is drifting/at_risk/churned
- `reflection` prompts: +0.3 boost when streak_break_risk is true
- `content` prompts: +0.5 boost when member has an active quest

**Category diversity:** Greedy selection ensures at least 2 different categories per response.

---

## A/B Test Design

- **Experiment ID:** `eve_dynamic_prompts_v1`
- **Hash:** DJB2 over `"<experiment_id>:<member_id>"`
- **Split:** 50% treatment / 50% control (configurable)
- **Stability:** Same member always gets same variant (no state required)
- **Amplitude events:** `prompt_surfaced` (on GET) + `prompt_clicked` (on POST)

---

## Test Coverage

**74 tests, all passing.** Combined suite: 106 tests (32 Sprint 1 + 74 Sprint 2), all passing.

Test groups:
- Prompt Library (7 tests)
- Prompt Personalisation (4 tests)
- Prompt Ranking — all 4 member states (22 tests)
- Fallback Prompts (5 tests)
- A/B Test Assignment (6 tests)
- CTR Simulation (2 tests)
- GET /eve-prompts API (13 tests)
- POST /prompt-ctr API (10 tests)
- Amplitude Event Structure (4 tests)
- Category Diversity (2 tests)

---

## TypeScript

`npx tsc --noEmit` — zero errors.
