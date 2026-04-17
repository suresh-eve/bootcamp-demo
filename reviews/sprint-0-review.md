# Sprint 0 Review
**Verdict**: PASS
**Attempt**: 1

---

## Acceptance Criteria

### AC1: B1/B2/B3 resolved or workarounds confirmed
**PASS** — All three blockers have active, code-backed workarounds verified in `src/config/adapter-config.ts` and `src/data/adapters/`.

- **B1**: `MockDataAdapter` (`src/data/adapters/MockDataAdapter.ts`) serves all 100 fixtures via the `DataAdapter` interface. `RealDataAdapter` stub is present with explicit TODOs and env-variable swap path (`DATA_ADAPTER=real`). Verified: running `node dist/index.js` prints `[B1] WORKAROUND_ACTIVE`.
- **B2**: `JsonContextAdapter` and `FreeTextContextAdapter` are both fully implemented in `src/context/ContextAdapter.interface.ts`. Tested both adapters live on member_001 — JSON payload and free-text system-prompt both produce correct, well-formed output. Env-variable swap (`EVE_CONTEXT_FORMAT=free_text`) requires zero code changes. Verified: `[B2] WORKAROUND_ACTIVE` logged at startup.
- **B3**: `MockDataAdapter.getFtuGoalData()` synthesises FTU goals from `goal_declarations` where `source === "ftu"`. The `ftu_goal_from_mock` flag is set on every profile built by `LearnerProfileService` when `MockDataAdapter` is active. Verified: flag visible in `IntentDomain` type and set in `buildProfileFromRaw()`. Logged: `[B3] WORKAROUND_ACTIVE`.

---

### AC2: C1 Lite schema locked
**PASS** — `src/types/index.ts` is present and fully covers all five required domains.

| Domain | Interface | Status |
|--------|-----------|--------|
| intent | `IntentDomain` | Present — goal_declarations, primary_goal_category, eve_conversation_frequency_30d, prompt_ctr, ftu_goal_from_mock |
| engagement | `EngagementDomain` | Present — streak_days, last_active_at, session_frequency_weekly, total_active_days |
| learning | `LearningDomain` | Present — lessons_completed_total, lessons_completed_30d, quests_completed_total, current_quest, recent_lessons, quests |
| pulse_signals | `PulseSignalsDomain` | Present — dormancy_diagnosis (4 levels), momentum_score, days_since_last_active, streak_break_risk, days_inactive_streak |
| member_state | `MemberStateDomain` | Present — state (1–4), label, confidence_score, used_fallback, computed_at |

Top-level `LearnerProfile` assembles all five domains with `schema_version: "1.0"`. Supporting types (`GoalDeclaration`, `LessonRecord`, `QuestRecord`, `IntentSignals`, `IntentConfidenceResult`, `RawMemberData`, `EveContextPayload`, `FtuGoalData`, `AlgorithmTestResult`, `BatchTestSummary`, `MEMBER_STATE_LABELS`) are all present. TypeScript compiler (`npx tsc --noEmit`) returned no errors.

---

### AC3: Intent confidence score tested on 100 members
**PASS** — Algorithm ran live and produced results matching the documented expected output.

**Verified by running `node dist/index.js`:**

```
Total members tested: 100
Avg intent confidence: 51.0%
Avg momentum score:    33.6%
Avg state confidence:  50.1%
High intent members:   56
Low intent members:    44
Fallback rule applied: 17 members

State Distribution:
  State 1 (High/High): 27 members
  State 2 (High/Low):  29 members
  State 3 (Low/High):  23 members
  State 4 (Low/Low):   21 members
```

Output matches the contract exactly (51.0%, 33.6%, 50.1%, 56/44, 17 fallback, 27/29/23/21 distribution).

**Algorithm correctness verified:**
- All signals maxed → score = 1.0, `intent_level: "high"`, `signal_count: 5`, `used_fallback: false` (correct)
- Zero signals (ghost member) → score = 0.0, `intent_level: "low"`, `used_fallback: true` (correct)
- 2 signals → `used_fallback: true`, score capped at 0.5 (correct)
- 3 signals → `used_fallback: false`, full score applies (boundary correct)
- Weight sum: 0.30 + 0.20 + 0.20 + 0.15 + 0.15 = 1.0 (verified from ALGORITHM_METADATA)

**Mock fixture distribution (confirmed from source):**
- 25 s1 (high intent / high momentum)
- 25 s2 (high intent / low momentum)
- 25 s3 (low intent / high momentum)
- 15 s4 (low intent / low momentum)
- 10 edge cases (new member, ghost, power user, curious browser, re-engaged)

**Edge case results verified live:**
- member_092 (ghost, no goal, churned): State 4, `used_fallback: true`, `dormancy: churned` (correct)
- member_091 (new member, 1 day old): State 2, `dormancy: active` (correct — low momentum due to sparse engagement history)
- member_093 (power user, all maxed): State 1, momentum_score = 1.0, confidence = 0.9955 (correct)
- member_999 (non-existent): returns `null` (correct null-safe behaviour)

---

### AC4: Blockers documented in contracts/sprint-0-done.md
**PASS** — Read `contracts/sprint-0-done.md` directly. Contains:

- Structured blocker table (B1/B2/B3 with status)
- Per-blocker sections with: status, workaround description, numbered resolution steps
- Algorithm test results (100-member run output)
- Decisions log (7 decisions: D-S0-01 through D-S0-07)
- Known limitations (6 items with honest scope acknowledgements)
- File manifest listing all 8 deliverables

No acceptance criterion is listed as "TODO" or "pending" — all four criteria are marked DONE.

---

## Quality Scores

### Functionality: 5/5
All five C1 Lite schema domains are present and correctly typed. The algorithm produces sensible, bounded output across the full 0.0–1.0 range. State classification (1–4) from the intent × momentum quadrant is clean and correct. Both context adapters (JSON and free-text) produce well-formed output. The entry point produces live, reproducible results that exactly match the contract's reported figures.

### Robustness: 4/5
Edge cases are deliberately seeded (new member, ghost, power user, curious browser, re-engaged). Null-safe handling is confirmed: missing member returns `null`, zero-signal ghost is correctly classified State 4 with `used_fallback`. CTR input is clamped to [0, 1] to guard against bad data. Score is clamped to [0, 1] for float safety. Minor deduction: `RealDataAdapter` throws hard errors rather than returning `null` — if wired accidentally in production before B1 is resolved, it will crash rather than degrade gracefully.

### Integration: 5/5
The `DataAdapter` interface cleanly separates all consumer code from the real API. Swapping from mock to real requires only an env-var change — no consumer code changes. The `ContextAdapter` interface follows the same pattern for B2. `LearnerProfileService` is fully decoupled: it accepts any `DataAdapter` via constructor injection. Types flow clearly from `RawMemberData` → `LearnerProfile` → `EveContextPayload`, providing well-defined interfaces for Sprint 1 to build the REST endpoint on.

---

## Notes
No feedback for generator — all acceptance criteria met. The one minor robustness note (hard throw in `RealDataAdapter`) is appropriate since it is an intentional stub that should never be reached in the current sprint; it is well-documented and does not affect Sprint 0 deliverables.
