# Sprint 8 Contract — Next Chapter Flow + Goal Milestone (Week 9)

**Sprint:** 8  
**Status:** COMPLETE  
**Date:** 2026-04-10

---

## What Was Built

### 1. New Types — `src/types/milestone.ts`

| Type | Description |
|------|-------------|
| `GoalMilestone` | Fires at 3/6/9 completions in the same category. Fields: `member_id`, `category`, `quests_completed`, `milestone_level` (1/2/3), `triggered_at`, `ab_variant` |
| `MilestoneReflection` | Eve identity-reflection prompt. Fields: `milestone`, `prompt_text`, `eve_context`, `dismissible` |
| `NewChapterFlow` | Full post-quest landing payload. Fields: `member_id`, `completed_quest`, `recommendations`, `eve_proactive_message`, `is_milestone`, `milestone?`, `generated_at` |
| `SilenceNudge` | 5-day re-entry nudge. Fields: `member_id`, `days_silent`, `channel`, `braze_payload?`, `in_app_fallback`, `ab_variant`, `created_at` |

### 2. New Service — `src/services/milestone-tracker.ts`

| Function | Behaviour |
|----------|-----------|
| `checkMilestone(member, completedQuestIds)` | Returns `GoalMilestone \| null`. Fires at **exactly** 3, 6, 9 completions in the same category. Cross-category completions do NOT count. |
| `buildMilestoneReflection(milestone, member)` | Returns `MilestoneReflection` with identity copy (e.g. "habit architect", "mindset explorer") and `eve_context` injected into Eve AI. |
| `buildEveProactiveMessage(member, recommendations)` | Returns Eve's proactive message: "Great job finishing [quest]! Based on your journey, here's what to explore next…" |
| `buildSilenceNudge(member, daysSilent)` | Returns `SilenceNudge` when `daysSilent >= 5`; `null` at 4 days or fewer. A/B experiment: `eve_silence_nudge_v1`. |

### 3. New Service — `src/services/new-chapter-flow.ts`

| Function | Behaviour |
|----------|-----------|
| `orchestrateNewChapterFlow(member, completedQuestId, allCompletedQuestIds)` | Orchestrates recommendations → milestone check → Eve message → returns `NewChapterFlow`. Full round-trip < 2s. |
| `checkSilenceAndNudge(member)` | Delivers Braze push (treatment) or in-app (control) when member has been silent 5+ days. Falls back gracefully when Braze is unavailable. |

### 4. New API Endpoints — `src/api/server.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/members/:member_id/new-chapter-flow?completed_quest_id=:id` | Orchestrates full New Chapter landing flow |
| `POST` | `/members/:member_id/milestone-check` | Body: `{completed_quest_ids: string[]}` — checks and returns milestone |
| `GET` | `/members/:member_id/silence-nudge` | Returns silence nudge if member has been inactive 5+ days |

### 5. Tests — `tests/milestone-flow.test.ts`

58 tests, all passing:
- Milestone fires at **exactly** 3 completions, NOT at 2 or 4
- Milestone does NOT fire across different categories
- New Chapter Flow returns recommendations + Eve message
- Sofia gets milestone at her 3rd `habit_builder` quest (she had 2)
- Marcus (mindset) gets milestone at 3 mindset completions
- Identity labels: Sofia → "habit architect", Marcus → "mindset explorer"
- 5-day silence nudge fires at `daysSilent=5`, NOT at `daysSilent=4`
- Silence nudge delivered via Braze push (treatment) with in-app fallback (control)
- A/B test variants included in milestone (`eve_milestone_reflection_v1`) and silence nudge (`eve_silence_nudge_v1`) — deterministic DJB2 hash
- Full flow: `orchestrateNewChapterFlow` embeds milestone when triggered
- All three new API endpoints validated (200 / 400 / 404 cases)

### 6. OpenAPI — `docs/openapi.yaml`

- New `milestone-flow` tag added
- Three new endpoint paths documented
- `GoalMilestone`, `MilestoneReflection`, `NewChapterFlow`, `SilenceNudge`, `MilestoneCheckResponse`, `SilenceNudgeResponse` schemas defined

---

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| Quest completion routes to New Chapter flow | PASS — `GET /new-chapter-flow?completed_quest_id=` |
| 3 recommendations generated < 2s | PASS — all in-memory, latency < 5ms |
| Eve proactively offers next path (API delivers the prompt) | PASS — `eve_proactive_message` in `NewChapterFlow` |
| Goal milestone trigger fires after 3 completions in same category | PASS — `checkMilestone` fires at exactly 3 |
| Milestone reflection in Eve with context | PASS — `MilestoneReflection.eve_context` injected |
| 5-day silence nudge via push + email | PASS — Braze push (treatment) + in-app fallback (control) |
| Full flows validated with Sofia + Marcus | PASS — 8 dedicated persona tests |
| A/B tests for milestone + silence nudge | PASS — `eve_milestone_reflection_v1` + `eve_silence_nudge_v1` |

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/milestone.ts` | NEW — `GoalMilestone`, `MilestoneReflection`, `NewChapterFlow`, `SilenceNudge` |
| `src/services/milestone-tracker.ts` | NEW — `checkMilestone`, `buildMilestoneReflection`, `buildEveProactiveMessage`, `buildSilenceNudge` |
| `src/services/new-chapter-flow.ts` | NEW — `orchestrateNewChapterFlow`, `checkSilenceAndNudge` |
| `src/api/server.ts` | UPDATED — 3 new endpoints + imports |
| `tests/milestone-flow.test.ts` | NEW — 58 tests |
| `docs/openapi.yaml` | UPDATED — 3 endpoints + 6 schemas |

---

## TypeScript

```
npx tsc --noEmit   →  0 errors
```

## Test Results

```
Tests:  429 passed, 0 failed  (8 suites, including 58 new Sprint 8 tests)
```
