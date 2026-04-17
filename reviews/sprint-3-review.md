# Sprint 3 Review
**Verdict**: PASS
**Attempt**: 1

---

## Acceptance Criteria

### 1. 2–3 prompts below lesson content
**PASS**

`rankLearningPrompts` enforces `PROMPT_COUNT_MIN = 2` and `PROMPT_COUNT_MAX = 3` via `Math.min(Math.max(count, 2), 3)`. The API route calls `rankLearningPrompts(profile, learningContext)` with no count override (defaults to 3), and the ranking function always caps the slice to `clampedCount`.

Test evidence:
- `learning-prompts.test.ts` line 415–417: `body.prompts.length >= 2 && <= 3`
- `learning-prompts.test.ts` line 211–218: All 4 member states return 2–3 prompts
- All 166 tests passed

---

### 2. Load within 1s (meta.latency_ms < 1000)
**PASS**

Latency is measured from `res.locals["startTime"]` (set in middleware at request entry) to `Date.now()` at route completion. All ranking is in-memory — no async I/O on the hot path; only `buildProfile` can be async (and the mock adapter is synchronous).

Test evidence:
- `learning-prompts.test.ts` line 588–603: Two dedicated latency tests — known member and fallback (unknown member) — both assert `meta.latency_ms < 1000`
- Actual test run time: 0.906s for the full suite (all in-memory)

---

### 3. At least 1 lesson-specific prompt in results
**PASS**

`pickLessonSpecificPrompt` guarantees a `context_type: "lesson_specific"` prompt as slot 1 when `lesson_meta` is non-null. `resolveLessonMeta` resolves by `lesson_id` first, then falls back to first lesson of the quest.

Templates (`LESSON_SPECIFIC_PROMPTS`) — 5 entries with IDs `lesson_001`–`lesson_005`, all containing `{{lesson}}` or `{{topic}}` (verified in prompt-library.ts lines 232–268).

Test evidence:
- `learning-prompts.test.ts` line 221–228: Unit test asserts `context_type === "lesson_specific"` count >= 1
- `learning-prompts.test.ts` line 419–429: API integration test confirms same for `member_001` with `lesson_id=l001&quest_id=q001`

---

### 4. At least 1 goal-anchored prompt in results
**PASS**

`pickGoalAnchoredPrompt` inserts a `context_type: "goal_anchored"` prompt as slot 2 when `primary_goal` is non-null. It pulls from `GOAL_ANCHORED_LESSON_PROMPTS` (5 templates, IDs `lesson_goal_001`–`lesson_goal_005`, all containing `{{goal}}`).

Test evidence:
- `learning-prompts.test.ts` line 230–245: Unit test iterates MOCK_MEMBERS to find a member with a goal, then asserts `context_type === "goal_anchored"` count >= 1
- `learning-prompts.test.ts` line 431–450: API integration test finds first MOCK_MEMBER with a goal and hits the endpoint — asserts same

---

### 5. Fallback rule tested (profile unavailable → static prompts returned gracefully)
**PASS**

Fallback path in `rankLearningPrompts` (line 157–159): when `profile === null`, `getLearningFallbackPrompts()` is returned immediately with `isFallback: true`. The API route wraps `service.buildProfile(member_id)` in a try/catch, setting `profile = null` on any error. Unknown members throw in the mock adapter, triggering the fallback.

Three fallback templates exist (`learn_fallback_001`–`learn_fallback_003`) with no placeholders — they always render as-is.

Test evidence (unit level):
- `learning-prompts.test.ts` line 301–305: `rankLearningPrompts(null, ctx)` → `isFallback === true`
- `learning-prompts.test.ts` line 307–314: Fallback prompts contain no unresolved `{{` / `}}`
- `learning-prompts.test.ts` line 316–329: `lesson_meta: null` with valid profile still returns 2–3 prompts
- `learning-prompts.test.ts` line 331–338: `primary_goal: null` still returns 2–3 prompts

Test evidence (API level):
- `learning-prompts.test.ts` line 501–509: `unknown_xyz_99999` → HTTP 200 with `is_fallback: true` and `prompts.length >= 2`
- `learning-prompts.test.ts` line 597–603: Same unknown member latency test confirms fallback path is <1000ms

---

### 6. A/B test running (variant included in response)
**PASS**

The learning-prompts route explicitly calls `assignABVariant(member_id, "eve_learning_prompts_v1")` (server.ts line 361) — a distinct experiment ID from Sprint 2's `eve_dynamic_prompts_v1` (the default). The `ab_variant` field is echoed in `LearningPromptsResponse`.

`assignABVariant` uses a deterministic `djb2Hash` on the key `"eve_learning_prompts_v1:<member_id>"`, giving a stable 50/50 split with no randomness.

Test evidence:
- `learning-prompts.test.ts` line 452–459: Response contains `ab_variant` in `["treatment", "control"]`
- `learning-prompts.test.ts` line 461–474: Both `/eve-prompts` and `/learning-prompts` return valid variants (different experiment namespaces can produce different assignments for the same member)
- `learning-prompts.test.ts` line 476–485: Two calls with same `member_042` + `lesson_id=l005` → same `ab_variant` (deterministic)

---

## Quality Scores
- Functionality: 5/5
- Robustness: 5/5
- Integration: 5/5
