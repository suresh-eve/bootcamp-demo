# Sprint 4 Contract — Dynamic Prompts (UC-03) + Streak-Save Nudge (Week 5)

**Sprint:** 4  
**Date completed:** 2026-04-10  
**Status:** DONE

---

## What was built

### New files

| File | Purpose |
|------|---------|
| `src/types/nudges.ts` | Types for NudgeEvent, StreakNudge, ReflectionPrompt, DormancySignal, DeepLink |
| `src/services/dormancy-diagnosis.ts` | diagnoseDormancy, shouldFireStreakSave, generateDeepLink |
| `src/services/streak-nudge.ts` | buildStreakSaveNudge, buildReflectionPrompt |
| `tests/nudges.test.ts` | 46 tests covering all Sprint 4 acceptance criteria |

### Modified files

| File | Change |
|------|--------|
| `src/api/server.ts` | Added POST /lesson-complete and GET /streak-nudge endpoints |
| `src/data/mock-members.ts` | Expanded from 300 to 500 members (5 quadrant groups × scaled up) |
| `docs/openapi.yaml` | Added Sprint 4 endpoint docs and schema components |
| `tests/learner-profile-api.test.ts` | Updated 300→500 count assertions |

---

## Acceptance criteria status

| Criterion | Status |
|-----------|--------|
| Reflection prompt surfaces 2s post-completion (API delivers it; timing is client-side) | DONE — POST /lesson-complete returns prompt immediately; client applies 2s delay |
| Prompt uses member state context | DONE — State 1–4 drives text + context_signal (goal/streak/lesson/re_entry) |
| Decision D1 implemented (dismissible approach) | DONE — `dismissible: true` on all ReflectionPrompts and StreakNudges |
| Streak nudge fires by 8pm before break (logic implemented and tested) | DONE — shouldFireStreakSave(member, hour) + tests confirm fires <20, not ≥20 |
| Deep-links work (generate valid deep-link URLs) | DONE — eve://lessons/{lessonId}?member={memberId}&source={source} |
| Dormancy signal validated on 500+ members | DONE — 500 members, all 4 dormancy states present, distribution tested |

---

## API surface (Sprint 4 additions)

### POST /members/:member_id/lesson-complete
- **Body:** `{ lesson_id: string, quest_id?: string }`
- **Returns:** `LessonCompleteResponse` — reflection prompt (null for control) + A/B variant
- **Personalisation:** State 1 gets deep goal-anchored question; State 4 gets gentle low-friction prompt
- **A/B experiment:** `eve_reflection_v1` (50/50 treatment/control)
- **Fallback:** Returns `reflection_prompt: null` gracefully when lesson or member not found

### GET /members/:member_id/streak-nudge
- **Returns:** `StreakNudgeResponse` — `{eligible: true, nudge}` or `{eligible: false, reason}`
- **Eligibility:** streak_days > 0 AND days since last active >= 1 AND current hour < 20
- **Reasons for ineligibility:** `no_active_streak | already_active_today | after_8pm | member_not_found`
- **Nudge:** includes deep-link to current lesson, expires_at 8pm today, dismissible: true
- **A/B experiment:** `eve_streak_nudge_v1` (50/50)

---

## Types added (src/types/nudges.ts)

- `DeepLinkSource` — `"streak_nudge" | "reflection_prompt" | "re_entry" | "dashboard"`
- `DeepLink` — `{ url, lesson_id, member_id, source }`
- `NudgeType` — `"streak_save" | "reflection" | "re_entry"`
- `NudgeEvent` — base nudge with message, deep_link, expires_at, dismissible, ab_variant
- `StreakNudge extends NudgeEvent` — adds streak_days, suggested_lesson_id
- `ReflectionPrompt` — post-lesson prompt with text, context_signal, member_state
- `DormancySignal` — dormancy diagnosis output with streak_at_risk, should_fire_streak_save
- `LessonCompleteResponse` — API response shape
- `StreakNudgeResponse` — union type: eligible true|false

---

## Test coverage (46 tests — all passing)

- Dormancy diagnosis: all 4 levels (active, drifting, at_risk, churned)
- shouldFireStreakSave: fires at hour 14 and 19, blocks at hour 20 and 21
- Deep-link URL format validation
- Reflection prompt personalisation: State 1 vs State 4 text differs
- State 1 context_signal = "goal"; State 4 context_signal = "re_entry"
- dismissible: true on all nudge types
- Dormancy distribution on 500 members: all 4 states present, >10 members each
- POST /lesson-complete: 200 success, 200 with null on unknown lesson, 400 on bad input
- GET /streak-nudge: eligible/ineligible cases, structural validation
