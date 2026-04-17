# Sprint 0 — Done Contract

**Sprint:** Sprint 0 — Foundation & Blocker Resolution  
**Completed:** 2026-04-10  
**Schema Version:** C1 Lite v1.0  

---

## Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| B1, B2, B3 resolved or interim workarounds confirmed | DONE — workarounds active |
| C1 Lite schema locked and approved | DONE — `src/types/index.ts` |
| Intent confidence score algorithm v1 tested on 100 members | DONE — 100 members, 4 states, output below |
| All blockers documented in this file | DONE |

---

## What Was Built

### 1. C1 Lite Schema (`src/types/index.ts`)

All TypeScript interfaces for the Learner Profile system:

- `LearnerProfile` — top-level C1 Lite schema (schema_version: "1.0")
- `IntentDomain` — goal declarations, Eve conversation frequency, prompt CTR, FTU flag
- `EngagementDomain` — streak, last_active, session_frequency, total_active_days
- `LearningDomain` — lessons completed (total + 30d), quests, current quest, recent lessons
- `PulseSignalsDomain` — dormancy diagnosis (4 levels), momentum score, streak break risk
- `MemberStateDomain` — state (1–4), label, confidence score, fallback flag
- `GoalDeclaration`, `LessonRecord`, `QuestRecord` — supporting types
- `IntentSignals`, `IntentConfidenceResult` — algorithm I/O types
- `RawMemberData`, `EveContextPayload`, `FtuGoalData` — adapter contract types
- `AlgorithmTestResult`, `BatchTestSummary` — batch test types
- `MEMBER_STATE_LABELS` — state 1–4 label constants

### 2. Intent Confidence Score Algorithm v1 (`src/services/intent-confidence.ts`)

Weighted scoring algorithm with 5 signal categories:

| Signal | Weight | Notes |
|--------|--------|-------|
| Goal declaration presence | 30% | Binary: has declared goal? |
| Goal declaration recency | 20% | 90-day half-life decay |
| Eve conversation frequency (30d) | 20% | Saturates at 10 conversations |
| Prompt CTR | 15% | Raw 0.0–1.0 value |
| Lessons completed (30d) | 15% | Saturates at 20 lessons |

**Fallback rule:** If fewer than 3 signals are present, score is capped at 0.5 and `used_fallback = true`.  
**Classification threshold:** score ≥ 0.5 → "high" intent; score < 0.5 → "low" intent.

### 3. LearnerProfileService (`src/services/learner-profile.ts`)

- `buildProfile(memberId)` — builds a complete LearnerProfile for one member
- `buildBatchProfiles(memberIds)` — builds profiles for multiple members
- `buildProfileFromRaw(raw)` — pure computation from RawMemberData (no I/O)
- `runBatchTest(memberIds)` — runs both algorithms on all members and returns results + summary

**Momentum score computation:**
- Streak days: 40% weight (saturates at 30 days)
- Lessons completed in 30d: 35% weight (saturates at 20)
- Session frequency (weekly): 25% weight (saturates at 7 sessions/week)

**State classification (intent × momentum):**
- State 1: high intent + high momentum (threshold ≥ 0.4)
- State 2: high intent + low momentum
- State 3: low intent + high momentum
- State 4: low intent + low momentum

### 4. 100 Member Fixtures (`src/data/mock-members.ts`)

Deterministic (seeded) generation of 100 RawMemberData records:

| Quadrant | Count | Description |
|----------|-------|-------------|
| s1 (high intent / high momentum) | 25 | Recent goals, active Eve users, strong streaks |
| s2 (high intent / low momentum) | 25 | Goals declared but drifting, low sessions |
| s3 (low intent / high momentum) | 25 | Active learners with old/absent goals |
| s4 (low intent / low momentum) | 15 | Dormant, stale goals, no Eve engagement |
| edge cases | 10 | New members, ghost members, power users, re-engaged |

### 5. DataAdapter Interface & Implementations (`src/data/adapters/`)

- `DataAdapter.interface.ts` — contract: `getMemberData`, `getBatchMemberData`, `getFtuGoalData`, `healthCheck`
- `MockDataAdapter.ts` — serves fixtures from `mock-members.ts` (default for dev/test)
- `RealDataAdapter.ts` — stub with documented TODOs for B1 and B3 real API integration

### 6. ContextAdapter Interface & Implementations (`src/context/ContextAdapter.interface.ts`)

- `ContextAdapter` interface — `serialize(profile): SerializedContext`
- `JsonContextAdapter` — produces compact JSON payload for Eve AI
- `FreeTextContextAdapter` — produces natural-language system-prompt string

### 7. Adapter Configuration (`src/config/adapter-config.ts`)

- `createDataAdapter()` — factory that returns MockDataAdapter or RealDataAdapter based on env
- `createContextAdapter()` — factory that returns JSON or free-text adapter based on env
- `BLOCKER_STATUS` — structured record of B1/B2/B3 status and resolution steps
- Environment variable driven: `DATA_ADAPTER`, `LEARNER_PROFILE_API_URL`, `LEARNER_PROFILE_API_KEY`, `EVE_CONTEXT_FORMAT`

### 8. Entry Point (`src/index.ts`)

Runs batch test and prints state distribution summary.

---

## Blocker Resolution

### B1 — Learner Profile API (Owner: Surya)

**Status:** Workaround active  
**Workaround:** `MockDataAdapter` serves 100 pre-generated fixtures. The `DataAdapter` interface cleanly separates all consumer code from the real API. When B1 is resolved, only `RealDataAdapter` needs to be implemented and `DATA_ADAPTER=real` set in env.  
**Resolution steps:**
1. Confirm API base URL and auth mechanism
2. Confirm `GET /members/{id}/learner-profile` contract
3. Confirm data freshness SLA (realtime vs hourly)
4. Implement `RealDataAdapter.getMemberData()` and `getBatchMemberData()`
5. Set `DATA_ADAPTER=real`, `LEARNER_PROFILE_API_URL`, `LEARNER_PROFILE_API_KEY` in environment

### B2 — Eve AI Context Injection Interface (Owner: Eve AI Platform)

**Status:** Workaround active  
**Workaround:** Both `JsonContextAdapter` and `FreeTextContextAdapter` are fully implemented. Defaulting to JSON. Switch by setting `EVE_CONTEXT_FORMAT=free_text` in env — zero code changes required.  
**Resolution steps:**
1. Eve AI Platform team confirms preferred format (JSON or free text)
2. Set `EVE_CONTEXT_FORMAT=json` or `EVE_CONTEXT_FORMAT=free_text` in environment

### B3 — FTU Goal Data Accessibility (Owner: Platform/Onboarding)

**Status:** Workaround active  
**Workaround:** `MockDataAdapter.getFtuGoalData()` synthesises FTU data from the member's `intent.goal_declarations` where `source === "ftu"`. The `ftu_goal_from_mock` flag on `IntentDomain` signals when mock data is in use.  
**Resolution steps:**
1. Platform/Onboarding team exposes `GET /members/{id}/onboarding/goals`
2. Implement `RealDataAdapter.getFtuGoalData()` with real API call
3. Remove `ftu_goal_from_mock` flag from `LearnerProfileService`

---

## Algorithm Test Results (100 Members)

```
DataAdapter:  MockDataAdapter (100 members)
Algorithm:    Intent Confidence Score v1

Avg intent confidence:  51.0%
Avg momentum score:     33.6%
Avg state confidence:   50.1%
High intent members:    56
Low intent members:     44
Fallback rule applied:  17 members

State Distribution:
  State 1 (High Intent / High Momentum): 27 members
  State 2 (High Intent / Low Momentum):  29 members
  State 3 (Low Intent  / High Momentum): 23 members
  State 4 (Low Intent  / Low Momentum):  21 members
```

Distribution is well-spread across all four states with meaningful edge-case coverage (17 members hit the fallback rule, matching edge cases with sparse signals).

---

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| D-S0-01 | Intent confidence threshold = 0.5 | Symmetric split; can be tuned once real-data baselines are available |
| D-S0-02 | Momentum threshold = 0.4 (lower than intent) | Members with moderate activity should still be considered "high momentum" to reduce false State 4 churn classification |
| D-S0-03 | Goal recency half-life = 90 days | Goals are strategic and stay relevant longer than engagement signals |
| D-S0-04 | Eve context format defaults to JSON | More machine-parseable; free-text variant fully built as fallback |
| D-S0-05 | Fallback cap at 0.5 (not 0.0) | We have some signal, just not enough to be confident. Capping prevents under-classifying new members as State 4 |
| D-S0-06 | Streak saturation at 30 days | Beyond 30 days, marginal streak benefit is low for engagement prediction |
| D-S0-07 | 100 fixtures split 25/25/25/15/10 | More edge cases than pure State 4 because State 4 + edge cases both stress the fallback path |

---

## Known Limitations

1. **Mock data freshness:** All 100 fixtures use `data_freshness: "daily"`. Real-time data integration requires B1 resolution.
2. **Session frequency not in RawMemberData:** `IntentSignals.session_frequency_weekly` is passed from `EngagementDomain` in `LearnerProfileService`. The field exists but is not surfaced in `LearnerProfile.intent` (by design — it belongs to engagement).
3. **No persistence layer:** Profiles are built on demand. Caching (Redis/in-memory) is out of scope for Sprint 0 and will be addressed in Sprint 1.
4. **Algorithm not calibrated on real data:** The weights (30/20/20/15/15) are based on product intuition. Should be validated against real member behaviour data once B1 is resolved. Recommend A/B testing the threshold in Sprint 2.
5. **No API endpoint yet:** The `LearnerProfileService` is the core logic. The REST endpoint (`GET /members/{id}/learner-profile`) is Sprint 1's deliverable.
6. **FTU goal source heuristic:** The B3 workaround infers FTU source from goal age (<7 days = "ftu"). This is a simplification; real FTU data will have an explicit source flag.

---

## File Manifest

```
src/
  types/
    index.ts                              — All C1 Lite TypeScript interfaces
  data/
    mock-members.ts                       — 100 deterministic member fixtures
    adapters/
      DataAdapter.interface.ts            — B1/B3 adapter contract
      MockDataAdapter.ts                  — Development/test adapter
      RealDataAdapter.ts                  — Production stub (TODOs for B1/B3)
  services/
    intent-confidence.ts                  — Intent Confidence Score algorithm v1
    learner-profile.ts                    — LearnerProfile builder + state classifier
  config/
    adapter-config.ts                     — B1/B2/B3 adapter wiring + blocker status
  context/
    ContextAdapter.interface.ts           — B2 context injection (JSON + free-text)
  index.ts                               — Entry point / batch test runner
tsconfig.json                            — TypeScript compiler configuration
contracts/
  sprint-0-done.md                       — This file
```
