# Sprint 3 Contract — Dynamic Prompts: Learning Assistant

**Sprint:** 3 — Learning Assistant (Week 4)
**Status:** DONE
**Date completed:** 2026-04-10

---

## What was built

### New endpoint
`GET /members/:member_id/learning-prompts?lesson_id=:lesson_id&quest_id=:quest_id`

- Returns 2–3 prompts for the Learning Assistant surface (below lesson content)
- At least 1 **lesson-specific** prompt (anchored to lesson title / topic)
- At least 1 **goal-anchored** prompt (bridges lesson content to member's declared goal)
- Remaining slot(s) filled with general ranked prompts from the existing prompt ranking pipeline
- Fallback to `LEARNING_FALLBACK_PROMPTS` when profile is unavailable (`is_fallback: true`)
- A/B variant from experiment `eve_learning_prompts_v1` (separate experiment from Sprint 2's `eve_dynamic_prompts_v1`)
- `meta.latency_ms` measured and confirmed <1s in all test scenarios

### New files
| File | Purpose |
|------|---------|
| `src/types/learning.ts` | `LessonMeta`, `LearningRankedPrompt`, `LearningPromptsResponse`, `LearningPromptContext` types |
| `src/data/mock-lessons.ts` | 20 lesson fixtures across 10 quests; `getLessonById`, `getLessonsForQuest`, `resolveLessonMeta` accessors |
| `src/prompts/learning-prompt-ranking.ts` | `rankLearningPrompts`, `getLearningFallbackPrompts` — Learning Assistant-specific ranking with lesson-specific + goal-anchored slot guarantees |
| `tests/learning-prompts.test.ts` | 42 new tests covering all acceptance criteria |

### Modified files
| File | Change |
|------|--------|
| `src/prompts/prompt-library.ts` | Added `LESSON_SPECIFIC_PROMPTS` (5 templates), `GOAL_ANCHORED_LESSON_PROMPTS` (5 templates), `LEARNING_FALLBACK_PROMPTS` (3 templates); extended `personalisePromptText` to support `{{lesson}}` and `{{topic}}` placeholders; added `getAnyPromptById` |
| `src/api/server.ts` | Added `GET /members/:member_id/learning-prompts` route |
| `docs/openapi.yaml` | Added `learning-assistant` tag, new endpoint spec, `LearningPromptContextType`, `LearningRankedPrompt`, `LearningPromptsResponse` schemas |

---

## Acceptance criteria — verification

| Criterion | Result |
|-----------|--------|
| 2–3 prompts below lesson content | PASS — all test scenarios return 2–3 prompts |
| Load within 1s | PASS — `meta.latency_ms < 1000` in all cases (in-memory ranking, <10ms typical) |
| At least 1 lesson-specific prompt in results | PASS — `context_type: "lesson_specific"` guaranteed when `lesson_id` / `quest_id` provided |
| At least 1 goal-anchored prompt in results | PASS — `context_type: "goal_anchored"` guaranteed when `primary_goal_category` is set |
| Fallback rule tested | PASS — null profile → `is_fallback: true`; null lesson_meta → falls through to general; null goal → skips goal-anchored slot |
| A/B test running | PASS — `eve_learning_prompts_v1` experiment, 50/50 deterministic hash split, variant echoed in response |

---

## Test results

```
Tests: 166 passed, 166 total (42 new in learning-prompts.test.ts)
TSC:   0 errors
```

---

## Prompt template additions (Sprint 3)

**Lesson-Specific** (`LESSON_SPECIFIC_PROMPTS`): 5 templates using `{{lesson}}` and `{{topic}}` placeholders — IDs: `lesson_001`–`lesson_005`

**Goal-Anchored Lesson** (`GOAL_ANCHORED_LESSON_PROMPTS`): 5 templates using `{{goal}}` + `{{topic}}`/`{{lesson}}` — IDs: `lesson_goal_001`–`lesson_goal_005`

**Learning Fallback** (`LEARNING_FALLBACK_PROMPTS`): 3 generic templates for unavailable profile/lesson scenarios — IDs: `learn_fallback_001`–`learn_fallback_003`

---

## Mock lesson data

20 lessons across 10 quests (q001, q002, q003, q004, q006, q007, q008, q010, q012, q014).
Lesson IDs: `l001`–`l020`.
Each lesson has: `lesson_id`, `title`, `topic`, `quest_id`, `quest_title`, `quest_category`.
