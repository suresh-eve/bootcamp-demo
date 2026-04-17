# Sprint 4 Review
**Verdict**: PASS
**Attempt**: 1

---

## Acceptance Criteria

### AC1: Reflection prompt surfaces 2s post-completion (API delivers it; timing is client-side)
**PASS**

The `POST /members/:member_id/lesson-complete` endpoint is implemented in `src/api/server.ts` (line 411). It returns the `LessonCompleteResponse` immediately (server-side) with the reflection prompt. The 2-second delay is explicitly documented as client-side in both `src/types/nudges.ts` (line 104: "Fires 2 seconds after lesson completion (timing is client-side)") and the API JSDoc comments. The API integration test confirms 200 responses with prompt structure containing `prompt_id`, `text`, `lesson_id`, `quest_id`, and `dismissible: true`.

### AC2: Prompt uses member state context (different output per state)
**PASS**

`buildReflectionText` in `src/services/streak-nudge.ts` (lines 103–146) implements a `switch` on state 1–4 with distinct text templates and `context_signal` values per state:
- State 1 → `context_signal: "goal"` (deep goal-anchored question)
- State 2 → `context_signal: "goal"` (reconnect with "why")
- State 3 → `context_signal: "streak"` or `"lesson"` depending on streak length
- State 4 → `context_signal: "re_entry"` (gentle, low-friction)

Test evidence: "generates different text for State 1 vs State 4 members" PASS; "State 1 prompt uses goal-oriented context signal" PASS; "State 4 prompt uses re_entry context signal" PASS. All 7 reflection prompt personalisation tests passed.

### AC3: Decision D1 implemented (dismissible: true on all nudges/prompts)
**PASS**

- `buildStreakSaveNudge` in `src/services/streak-nudge.ts` (line 178): `dismissible: true` hardcoded in the returned `StreakNudge` object.
- `buildReflectionPrompt` in `src/services/streak-nudge.ts` (line 253): `dismissible: true` hardcoded in the returned `ReflectionPrompt`.
- The `ReflectionPrompt` type in `src/types/nudges.ts` (line 125) enforces `dismissible: true` at the type level (literal type, not just `boolean`).

Test evidence: "always sets dismissible: true (Decision D1)" PASS in both `buildStreakSaveNudge` and `Reflection Prompt` suites. API integration test also asserts `rp.dismissible === true` (line 499).

### AC4: Streak nudge fires by 8pm before break (and does NOT fire after 8pm)
**PASS**

`shouldFireStreakSave` in `src/services/dormancy-diagnosis.ts` (lines 105–112) takes an injected `currentHour` parameter and returns false when `currentHour >= 20` (the `STREAK_SAVE_CUTOFF_HOUR` constant is 20). The server endpoint `GET /members/:member_id/streak-nudge` (line 569) checks `currentHour >= 20` and returns `{ eligible: false, reason: "after_8pm" }`.

Test evidence — all 7 `shouldFireStreakSave` tests passed:
- "fires for an at-risk member before 8pm (hour=14)" PASS
- "fires for an at-risk member at 7:59pm (hour=19)" PASS
- "does NOT fire after 8pm (hour=20)" PASS
- "does NOT fire at 9pm (hour=21)" PASS
- "does NOT fire when member was already active today" PASS
- "does NOT fire when member has no active streak" PASS

### AC5: Deep-links work (generate valid deep-link URLs in eve:// format)
**PASS**

`generateDeepLink` in `src/services/dormancy-diagnosis.ts` (line 129) produces:
```
eve://lessons/${lessonId}?member=${memberId}&source=${source}
```
This matches the specified format `eve://lessons/{lessonId}?member={memberId}&source={source}`. The `DeepLink` type in `src/types/nudges.ts` captures `url`, `lesson_id`, `member_id`, and `source`. All four `DeepLinkSource` values are supported: `"streak_nudge" | "reflection_prompt" | "re_entry" | "dashboard"`.

Test evidence — all 5 `generateDeepLink` tests passed:
- "generates a correctly structured deep-link URL" PASS (exact URL match: `eve://lessons/l005?member=member_001&source=streak_nudge`)
- "includes correct lesson_id, member_id, and source fields" PASS
- "handles different sources correctly" PASS (all 4 source values)
- "URL contains the lesson ID in the path" PASS
- "URL contains the member ID in the query string" PASS

### AC6: Dormancy signal validated on 500+ members (all dormancy states covered)
**PASS**

`src/data/mock-members.ts` generates exactly 500 members (lines 342–357) distributed as: 125 s1 + 125 s2 + 125 s3 + 75 s4 + 50 edge = 500. All four dormancy levels (active, drifting, at_risk, churned) are covered by varying `lastActiveDaysAgo` across quadrants. The contract states `drifting` as the level name — the implementation uses the same label.

Test evidence — all 4 dormancy distribution tests passed:
- "processes all 500 members without error" PASS (500/500 valid signals)
- "includes all four dormancy states in the 500-member dataset" PASS
- "has a meaningful number of at-risk and churned members (distribution sanity)" PASS (each level >10 members)
- "streak-save eligibility is consistent with dormancy levels" PASS

---

## Test Results

```
Test Suites: 4 passed, 4 total
Tests:       212 passed, 212 total  (nudges.test.ts alone: 46 passed, 46 total)
Snapshots:   0 total
Time:        ~1.0s
```

TypeScript: `npx tsc --noEmit` → exit code 0 (no errors)

---

## Quality Scores
- Functionality: 5/5
- Robustness: 5/5
- Integration: 5/5
