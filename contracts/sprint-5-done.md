# Sprint 5 Contract — Momentum Nudges (Day 3 & 7 Lapses + Stuck-Point) (Week 6)

**Sprint:** 5  
**Date completed:** 2026-04-10  
**Status:** DONE

---

## What was built

### New files

| File | Purpose |
|------|---------|
| `src/services/momentum-nudges.ts` | `detectDayLapse`, `detectStuckPoint`, `buildLapseNudge`, `buildCoachingCard` |
| `tests/momentum-nudges.test.ts` | 61 tests covering all Sprint 5 acceptance criteria |

### Modified files

| File | Change |
|------|--------|
| `src/types/nudges.ts` | Added `LapseNudgeType`, `LapseDetection`, `StuckPointDetection`, `CoachingAction`, `CoachingCard`, `MomentumNudgeResponse`, `CoachingCardResponse` |
| `src/types/index.ts` | Added optional `stuck_lesson_id` and `days_on_current_lesson` fields to `RawMemberData` |
| `src/data/mock-members.ts` | Added stuck-point field generation — 50 forced-stuck members (12+12+13+13 across quadrants) + ~10% organic stuck across remaining members |
| `src/api/server.ts` | Added `GET /members/:member_id/momentum-nudge` and `GET /members/:member_id/coaching-card` endpoints |
| `docs/openapi.yaml` | Added Sprint 5 endpoint docs + `MomentumNudge`, `MomentumNudgeResponse`, `CoachingCard`, `CoachingAction`, `CoachingCardResponse`, `LapseNudgeType` schema components |

---

## Acceptance criteria status

| Criterion | Status |
|-----------|--------|
| Day 3 fires on same day for eligible members | DONE — `detectDayLapse` returns `day3` for members 3–6 days inactive; confirmed via unit tests and drifting-member scan |
| Day 7 fires for at_risk members | DONE — `detectDayLapse` returns `day7` for 7+ days inactive; at_risk + churned both qualify |
| Stuck-point detects 7+ day stalls | DONE — `detectStuckPoint` checks `days_on_current_lesson >= 7` |
| Coaching card surfaces with 3 actions (Skip / Explain / Related) | DONE — `buildCoachingCard` returns `actions` array with all 3 types, each with label + deep_link |
| All deep-link to correct trigger point | DONE — skip/explain link to lesson, related links to quest; all include member_id |
| Fallback rule tested | DONE — unknown member returns `{eligible: false}` / `{stuck: false}` safely |
| A/B tests running | DONE — `eve_day3_nudge_v1`, `eve_day7_nudge_v1`, `eve_coaching_card_v1` experiments; deterministic hash-based assignment |
| Mock data ≥ 50 stuck members | DONE — exactly 50 forced-stuck members in QUADRANT_SCHEDULE + ~10% organic; test confirms count ≥ 50 |
| `npx tsc --noEmit` zero errors | DONE — zero TypeScript errors |

---

## API surface (Sprint 5 additions)

### GET /members/:member_id/momentum-nudge
- **Returns:** `MomentumNudgeResponse` — `{eligible: true, nudge}` or `{eligible: false}`
- **Eligibility:**
  - day3: 3–6 days inactive → warm re-entry nudge
  - day7: 7+ days inactive → stronger urgency nudge
- **Nudge type:** `re_entry` (extends `NudgeEvent`)
- **A/B experiments:** `eve_day3_nudge_v1` and `eve_day7_nudge_v1`
- **Fallback:** Returns `{eligible: false}` for unknown members (never 404)
- **Nudge fields:** `nudge_id`, `nudge_type`, `member_id`, `message`, `deep_link`, `expires_at` (48h), `dismissible: true`, `ab_variant`

### GET /members/:member_id/coaching-card?lesson_id=:lesson_id
- **Returns:** `CoachingCardResponse` — `{stuck: true, card}` or `{stuck: false}`
- **Stuck detection:** `days_on_current_lesson >= 7`
- **Card fields:** `card_id`, `member_id`, `lesson_id`, `heading`, `message`, `actions[3]`, `ab_variant`
- **Actions:** `skip` (skip lesson), `explain` (break it down), `related` (show related)
- **Deep-links:** skip/explain → `eve://lessons/{lessonId}?...`, related → `eve://quests/{questId}?...`
- **A/B experiment:** `eve_coaching_card_v1`
- **Fallback:** Returns `{stuck: false}` for unknown members (never 404)

---

## New types (src/types/nudges.ts — Sprint 5 additions)

- `LapseNudgeType` — `"day3" | "day7" | "none"`
- `LapseDetection` — `{ type: LapseNudgeType, days_inactive: number }`
- `StuckPointDetection` — `{ stuck: boolean, days_on_lesson: number, lesson_id: string | null }`
- `CoachingAction` — `{ action: "skip" | "explain" | "related", label: string, deep_link: string }`
- `CoachingCard` — `{ card_id, member_id, lesson_id, heading, message, actions: [3], ab_variant, created_at }`
- `MomentumNudgeResponse` — union type: `{eligible: true, nudge}` | `{eligible: false}`
- `CoachingCardResponse` — union type: `{stuck: true, card}` | `{stuck: false}`

## New RawMemberData fields (src/types/index.ts — Sprint 5 additions)

- `stuck_lesson_id?: string | null` — lesson the member is stuck on (null when not stuck)
- `days_on_current_lesson?: number` — days the member has been on the current lesson

---

## Mock data changes (src/data/mock-members.ts)

- 50 forced-stuck members (12 per s1/s2, 13 per s3/s4) — guarantees ≥50 stuck in dataset
- Additional ~10% organic stuck distribution across remaining 450 members
- All 500 members now have `days_on_current_lesson` and `stuck_lesson_id` fields

---

## Test coverage (61 tests — all passing)

- `detectDayLapse`: day3 fires for 3–6 days inactive; day7 fires for 7+ days
- `detectDayLapse`: day3 does NOT fire for active members (< 3 days) or churned (they get day7)
- `detectStuckPoint`: detects stuck at exactly 7 days; not-stuck at 6 days
- `buildLapseNudge`: day3 and day7 have different messages; both have correct structure
- `buildCoachingCard`: 3 actions (skip/explain/related) with deep-links; heading and message reference lesson
- A/B assignment is deterministic and stable across calls for same member
- Mock data: ≥50 members have `days_on_current_lesson >= 7`
- API: `GET /momentum-nudge` — eligible + ineligible + unknown member + invalid format
- API: `GET /coaching-card` — stuck + not-stuck + unknown member + lesson_id param + deep-link format
- Fallback rules: unknown members return safe responses on both endpoints
