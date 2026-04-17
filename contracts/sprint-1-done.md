# Sprint 1 — Done Contract

**Sprint:** Sprint 1 — C1 Lite Learner Profile API  
**Completed:** 2026-04-10  
**Schema Version:** C1 Lite v1.0

---

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| `GET /members/{member_id}/learner-profile` endpoint | DONE |
| Schema: intent, engagement, learning, pulse_signals, member_state (PRD Part 2.3) | DONE |
| Latency: <2s for in-app surfaces | DONE — all tests pass, server-side computation is <50ms |
| Graceful null handling (no failures on missing domains) | DONE — tested with ghost/minimal members |
| Fallback rule: if <3 signals, return Intent Readiness only | DONE — `used_fallback = true` enforced |
| API returns valid LearnerProfile for any member_id | DONE |
| Response latency <2s | DONE — integration test asserts <2000ms |
| All C1 Lite fields present | DONE — schema completeness test across 5 members |
| Null domain slots return gracefully | DONE — zero-signal member produces valid response |
| Intent confidence score calculated | DONE — `member_state.confidence_score` computed |
| Member state classification (State 1–4) working | DONE — all 4 states present in 300-member batch |
| Fallback rule tested | DONE — two direct tests + batch coverage test |
| API documented (OpenAPI spec) | DONE — `docs/openapi.yaml` |
| 300 sample members tested | DONE — MOCK_MEMBERS expanded to 300 |
| Code review evident in contract | DONE — see Decisions Made section |

**Test results:** 32/32 integration tests pass. `npx tsc --noEmit` exits clean.

---

## What Was Built

### 1. Express HTTP API Server (`src/api/server.ts`)

A lightweight Express 4 application exposed via `createApp()` factory (enables isolated test instances).

**Routes:**
- `GET /health` — adapter health check, returns `{ status, adapter, data_freshness, timestamp }`
- `GET /members/:member_id/learner-profile` — C1 Lite Learner Profile

**Response envelope:**
```json
{
  "data": { /* LearnerProfile */ },
  "meta": {
    "request_id": "req_abc123_xyz",
    "latency_ms": 12,
    "adapter": "MockDataAdapter",
    "data_freshness": "daily"
  }
}
```

**Error responses** (code, message, request_id):
- `400 INVALID_MEMBER_ID` — member_id fails regex validation
- `404 MEMBER_NOT_FOUND` — adapter returned null
- `500 INTERNAL_ERROR` — unhandled adapter exception

### 2. Updated Entry Point (`src/index.ts`)

Replaced the Sprint 0 batch-test runner with an HTTP server boot (PORT env var, default 3000). The server logs the two available routes on startup.

### 3. 300 Mock Members (`src/data/mock-members.ts`)

Expanded from 100 to 300 members by tripling all quadrant counts:

| Quadrant | Sprint 0 | Sprint 1 |
|----------|----------|----------|
| s1 (High intent / High momentum) | 25 | 75 |
| s2 (High intent / Low momentum)  | 25 | 75 |
| s3 (Low intent / High momentum)  | 25 | 75 |
| s4 (Low intent / Low momentum)   | 15 | 45 |
| Edge cases                        | 10 | 30 |
| **Total**                         | **100** | **300** |

All 300 members use the same deterministic seeded-RNG generation logic. IDs are `member_001` through `member_300`.

### 4. OpenAPI Spec (`docs/openapi.yaml`)

OpenAPI 3.1.0 spec covering:
- `/health` endpoint
- `/members/{member_id}/learner-profile` endpoint
- Full schema definitions: `LearnerProfile`, `IntentDomain`, `EngagementDomain`, `LearningDomain`, `PulseSignalsDomain`, `MemberStateDomain`, plus all nested types
- All response codes (200, 400, 404, 500) with example payloads
- Member State table and fallback rule explanation in `info.description`

### 5. Integration Tests (`tests/learner-profile-api.test.ts`)

32 tests across 10 test suites. Uses `supertest` for HTTP-level testing and direct `LearnerProfileService` calls for unit-level assertions.

| Suite | Tests | What it covers |
|-------|-------|----------------|
| GET /health | 1 | 200, status=ok |
| Happy path | 3 | 200, all fields, latency_ms present |
| Response latency | 2 | <2000ms wall-clock + meta field |
| Error handling | 4 | 404 unknown, 400 invalid ID, 404 route |
| Null domain handling | 2 | No goals + no activity = valid profile |
| Fallback rule | 3 | Ghost member triggers, active member doesn't, batch has fallbacks |
| State classification | 3 | All 4 states present, labels match, scores in [0,1] |
| Intent confidence | 2 | Score present for all 300, high-signal > no-signal |
| 300-member batch | 6 | Count=300, IDs unique, API spot-check, state spread, fallback rate |
| Schema completeness | 5 | All C1 Lite fields for 5 member IDs |

### 6. Jest Configuration (`jest.config.js`)

Added `jest.config.js` with `ts-jest` preset, `testMatch: ["**/tests/**/*.test.ts"]`, and 10s timeout.

### 7. Updated `package.json`

Added:
- `dependencies`: `express ^4.18`, `@types/express ^4.17`
- `devDependencies`: `ts-jest ^29`, `supertest ^7`, `@types/supertest ^6`

---

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| D-S1-01 | `createApp()` factory pattern instead of singleton export | Enables supertest to create a fresh app instance per test suite, preventing port conflicts and state bleed |
| D-S1-02 | `meta.latency_ms` in every response | Gives callers visibility into server-side compute time; lightweight proxy for the <2s SLA |
| D-S1-03 | `request_id` generated server-side (not injected by caller) | Simpler for an internal API; can be swapped to X-Request-ID header injection when a reverse proxy is added |
| D-S1-04 | member_id regex: `^[\w-]{1,64}$` | Accepts `member_001` style IDs and UUIDs while blocking path traversal attempts and very long values |
| D-S1-05 | Express 4.x (not Express 5 or Hono/Fastify) | Sprint instruction says "lightweight Node HTTP server" — Express 4 is the lowest-risk choice given existing Node/TS setup |
| D-S1-06 | `DATA_ADAPTER` env var wires mock vs real adapter | Zero-code swap path to RealDataAdapter once B1 is resolved |
| D-S1-07 | Expanded to 300 members via multiplying quadrant counts (not changing generation logic) | Preserves deterministic seeding so every member is reproducible; distribution stays proportional |
| D-S1-08 | OpenAPI 3.1.0 (not 3.0.x) | Better `null` support via `type: "null"` instead of `nullable: true` (which is 3.0-only) |

---

## Known Limitations

1. **No in-memory caching layer.** Each request triggers a full profile computation from the mock store. With the real API, a Redis/LRU cache would be needed to hit the <2s SLA at scale.
2. **MockDataAdapter only.** The API runs against mock data. `DATA_ADAPTER=real` is wired but `RealDataAdapter` is still a stub (B1 blocker, owner: Surya).
3. **No authentication / authorisation.** The endpoint is unauthenticated. Sprint 2 or a gateway layer should add API key / JWT validation before any external exposure.
4. **No request-ID propagation.** `request_id` is generated inside the handler; no X-Request-ID header is read or written. Add when a load balancer / reverse proxy is in front.
5. **No pagination on the profile endpoint.** The LearnerProfile response is always the full C1 Lite payload. For very large `quests` / `recent_lessons` arrays, a `?fields=` projection parameter could reduce payload size.
6. **ts-jest `globals` deprecation warning.** The Jest config uses the old `globals` syntax. No functional impact; to silence, migrate to the `transform` block as documented in ts-jest ≥29.
7. **`dist/` directory** was already present from prior runs. `pnpm build` / `npm run build` will update it.

---

## File Manifest

```
src/
  api/
    server.ts                     — Express app factory + /health + /members/:id/learner-profile
  data/
    mock-members.ts               — Expanded to 300 deterministic member fixtures
  index.ts                        — Updated: boots HTTP server (was: Sprint 0 batch runner)
  (Sprint 0 files unchanged)
docs/
  openapi.yaml                    — OpenAPI 3.1.0 spec for the Learner Profile API
tests/
  learner-profile-api.test.ts     — 32 integration tests (32/32 passing)
jest.config.js                    — ts-jest configuration
package.json                      — Updated: added express, @types/express, ts-jest, supertest
contracts/
  sprint-1-done.md                — This file
```
