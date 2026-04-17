# Sprint 5 Review
**Verdict**: PASS
**Attempt**: 1

---

## Acceptance Criteria

### AC1: Day 3 nudge fires on same day for eligible members (3 days inactive, not churned)

**PASS**

`detectDayLapse` (momentum-nudges.ts, lines 149–164) checks `daysInactive >= 3 && daysInactive < 7` for day3. The day7 check runs first (lines 152–155), so members with 7+ days are correctly routed to day7. There is no explicit dormancy-level field guard — the logic depends entirely on `days_since(last_active_at)`, meaning a member inactive for exactly 3–6 days always gets day3, regardless of their stored `dormancy_level`.

Churned members (>30 days inactive) have `daysInactive >= 7`, which trips the day7 branch first, so day3 never fires for them. Confirmed by:
- Test `"a churned member (>30 days) never gets day3 — they get day7"` (line 196–201, PASS)
- Test `"fires day3 for a member exactly 3 days inactive"` (line 122–127, PASS)
- Test `"fires day3 for a member 6 days inactive (last day of drifting window)"` (line 136–140, PASS)

### AC2: Day 7 nudge fires for at_risk/dormant members (7+ days inactive)

**PASS**

`detectDayLapse` returns `{ type: "day7" }` for any member where `daysInactive >= 7` (line 153–155). This covers at_risk (7–30 days), churned (>30 days), and dormant members. There is no filtering by dormancy_level string — the time-based arithmetic is the sole gate.

Confirmed by:
- Test `"fires day7 for a member 7 days inactive"` (line 159–164, PASS)
- Test `"fires day7 for a member 31+ days inactive (churned — day7 still fires)"` (line 171–177, PASS)
- Test `"day7 nudge fires for at_risk members (7+ days inactive)"` in API suite (line 512–525, PASS)

Day7 does NOT fire for members inactive less than 7 days — confirmed by `"does NOT fire day7 for a member only 3 days inactive (drifting → day3)"` (line 179–184, PASS) and `"does NOT fire day7 for a member active today"` (line 186–190, PASS).

### AC3: Stuck-point detects 7+ day stalls correctly

**PASS**

`detectStuckPoint` (momentum-nudges.ts, lines 176–196) reads `member.days_on_current_lesson ?? 0` and returns `{ stuck: true }` when value is `>= STUCK_LESSON_THRESHOLD` (7). At exactly 6 days it returns `stuck: false`.

Confirmed by:
- Test `"detects stuck when days_on_current_lesson >= 7"` — exact boundary at 7 days (line 214–220, PASS)
- Test `"does NOT detect stuck when days_on_current_lesson = 6"` (line 230–235, PASS)
- Test `"does NOT detect stuck when days_on_current_lesson = 0"` (line 237–241, PASS)

### AC4: Coaching card surfaces with exactly 3 actions (skip, explain, related), each with deep-links

**PASS**

`buildCoachingCard` (momentum-nudges.ts, lines 247–296) hardcodes a typed tuple of exactly 3 `CoachingAction` items (line 268: `[CoachingAction, CoachingAction, CoachingAction]`):
- `skip`: deep-links to `eve://lessons/{lesson_id}?member=...&source=coaching_skip&action=skip`
- `explain`: deep-links to `eve://lessons/{lesson_id}?member=...&source=coaching_explain&action=explain`
- `related`: deep-links to `eve://quests/{quest_id}?member=...&source=coaching_related&action=related`

The `CoachingCard` type itself enforces a 3-tuple (`actions: [CoachingAction, CoachingAction, CoachingAction]` — nudges.ts line 255).

Confirmed by:
- Test `"has exactly 3 actions"` (line 337–339, PASS)
- Test `"has all three required action types: skip, explain, related"` (line 341–346, PASS)
- Test `"each action has a deep_link URL string"` (line 351–356, PASS)
- Test `"skip action deep_link references the lesson"` (line 358–362, PASS)
- Test `"explain action deep_link references the lesson"` (line 364–368, PASS)
- Test `"related action deep_link references the quest"` (line 370–373, PASS)

### AC5: All nudges deep-link to correct trigger point

**PASS**

Lapse nudges (day3/day7): `buildLapseNudge` calls `generateDeepLink(member_id, lessonId, "re_entry")` and passes the result as `deep_link` on the `NudgeEvent`. The server (server.ts, lines 663–668) resolves the member's current quest lesson first. Deep-link URL format is `eve://lessons/{lessonId}?member={memberId}&source=re_entry`.

Coaching card: skip and explain actions deep-link to `eve://lessons/{lesson_id}?...`; related action targets `eve://quests/{quest_id}?...`.

Confirmed by:
- Test `"has a deep_link"` on lapse nudge (line 277–281, PASS)
- Test `"deep-links in coaching card actions all deep-link to correct trigger points"` — verifies `^eve:\/\/` prefix and member_id presence on all 3 actions (lines 604–622, PASS)

### AC6: Fallback rule tested (unknown/missing member → safe response)

**PASS**

Both endpoints return safe non-error responses for unknown members:
- `/momentum-nudge`: `getMockMemberById` returns `undefined` → server returns `{ eligible: false }` with HTTP 200 (server.ts, lines 641–645)
- `/coaching-card`: same guard → returns `{ stuck: false }` with HTTP 200 (server.ts, lines 704–709)

Invalid `member_id` format (regex `^[\w-]{1,64}$`) returns HTTP 400 with structured `INVALID_MEMBER_ID` error.

Confirmed by:
- Test `"unknown member returns safe {eligible: false} on momentum-nudge"` (line 627–630, PASS)
- Test `"unknown member returns safe {stuck: false} on coaching-card"` (line 632–635, PASS)
- Test `"returns 400 for invalid member_id format"` on both endpoints (lines 450–454, 537–540, PASS)

### AC7: A/B tests running (variant in nudge response)

**PASS**

Three separate experiments are defined as constants in momentum-nudges.ts (lines 52–54):
- `eve_day3_nudge_v1` — used in `buildLapseNudge` for day3
- `eve_day7_nudge_v1` — used in `buildLapseNudge` for day7
- `eve_coaching_card_v1` — used in `buildCoachingCard`

Each calls `assignABVariant(member.member_id, experimentId)` (ab-test.ts), which uses deterministic djb2 hash-based bucketing. The `ab_variant` field (`"treatment"` or `"control"`) is present on both `NudgeEvent` and `CoachingCard` responses.

Confirmed by:
- Test `"lapse nudge includes ab_variant from correct experiment"` (line 392–397, PASS)
- Test `"coaching card includes ab_variant from correct experiment"` (line 399–403, PASS)
- Test `"different members get deterministic (stable) A/B assignments"` (line 405–412, PASS)
- API test `"eligible nudge has correct structure when returned"` checks `["treatment","control"].toContain(nudge.ab_variant)` (line 492, PASS)

---

## Quality Scores

- **Functionality**: 5/5
- **Robustness**: 5/5
- **Integration**: 5/5

---

## Test Run Results

```
Test Suites: 1 passed, 1 total (momentum-nudges.test.ts)
Tests:       61 passed, 61 total
Time:        0.698 s
```

Full suite across all 5 test files:
```
Test Suites: 5 passed, 5 total
Tests:       273 passed, 273 total
```

TypeScript: `npx tsc --noEmit` — zero errors.

---

## Notes

- The contract comment states "day3: exactly 3 days" but the implementation correctly fires for 3–6 days (inclusive), which matches the PRD's "same day for eligible members in the drifting window" intent. This is not a defect.
- The churned-member boundary is handled cleanly by ordering: day7 check precedes day3 check, so any member with 7+ days of inactivity (including churned at 30+) is always routed to day7 and never to day3.
- The 3-action tuple is TypeScript-enforced at both the type level (`[CoachingAction, CoachingAction, CoachingAction]`) and runtime (hardcoded array literal with exactly 3 elements). There is no way to return a card with fewer or more actions.
