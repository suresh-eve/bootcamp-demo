# Sprint 7 — Predictive Path Continuity: Quest Completion

**Sprint goal:** Detect quest completions, proactively surface the next chapter anchored to the member's declared goal.

**Status:** DONE
**Date completed:** 2026-04-10

---

## What was built

### 1. `src/data/mock-quests.ts` — Quest catalogue (new file)

- 20 quests across 5 goal categories: `habit_builder`, `mindset`, `health`, `relationships`, `career`
- 4 quests per category, each with `id`, `title`, `category`, `lesson_count`, `description`, `relevance_weight`
- `getQuestsByCategory(category)` — returns quests filtered by category, sorted by `relevance_weight` descending
- `getRecommendedQuests(completedQuestIds, goalCategory, limit)` — excludes completed quests, returns top N
- `SOFIA_FIXTURE` — demo member fixture: `habit_builder` goal, completed `hb_q001` + `hb_q002`, currently 82% through `hb_q003`

### 2. `src/types/recommendations.ts` — New types (new file)

- `QuestMeta` — `{ id, title, category, lesson_count }`
- `QuestCompletionEvent` — `{ member_id, quest_id, completed_at, completion_percentage }`
- `NextChapterRecommendation` — `{ quest_id, title, category, relevance_score, reason }`
- `RecommendationResponse` — `{ member_id, recommendations[], generated_at, is_fallback }`

### 3. `src/services/recommendation-engine.ts` — Recommendation engine (new file)

- `buildQuestCompletionEvent(memberId, questId, completionPct)` — builds a `QuestCompletionEvent`; clamps `completion_percentage` to [0, 100]
- `getNextChapterRecommendations(member, completedQuestIds, limit?)` — returns 3 quests (default) anchored to member's goal category; excludes completed; falls back to intent-based if no goal or category exhausted; latency <2s (all in-memory)
- `getAlmostTherePrompt(member, questId, completionPct)` — returns personalised message when `completionPct >= 80`; returns `{ eligible: false }` below threshold; copy variant changes at >= 95%
- `buildIntentFallback(member, completedQuestIds, limit?)` — cross-category fallback sorted by `relevance_weight`; `is_fallback: true`; goal-category alias mapping handles legacy categories (`performance` → `mindset`, `wealth` → `career`, etc.)

### 4. `src/api/server.ts` — Three new endpoints

- `POST /members/:member_id/quest-complete` — validates body (`quest_id` required), builds completion event, derives completed quest IDs from member data, returns `{ event, ...RecommendationResponse }`; safe fallback for unknown members
- `GET /members/:member_id/almost-there?quest_id=&completion_pct=` — validates both query params, returns prompt or `{ eligible: false }`; safe fallback for unknown members
- `GET /members/:member_id/next-chapter` — returns `RecommendationResponse` with 3–5 goal-anchored recommendations; safe fallback for unknown members

### 5. `tests/recommendations.test.ts` — 50 tests (all passing)

- Quest completion event: correct fields, clamping, ISO-8601 timestamp
- Recommendation exclusion: completed quests never appear in results
- Goal anchoring: all returned quests match the member's category
- Count + latency: 3 recommendations returned in <2s
- Almost-there trigger: fires at pct=80, does not fire at pct=79
- Sofia persona: `habit_builder` quests, not `mindset`; completed quests excluded; 82% triggers prompt
- Fallback: `is_fallback: true`, cross-category results, excludes completed
- API: all three endpoints — 200 with correct shapes, 400 for invalid inputs, safe responses for unknown members

### 6. `docs/openapi.yaml` — Updated

- Added `recommendations` tag
- Three new paths: `POST /members/{member_id}/quest-complete`, `GET /members/{member_id}/almost-there`, `GET /members/{member_id}/next-chapter`
- Five new schemas: `QuestCompleteRequest`, `QuestCompletionEvent`, `NextChapterRecommendation`, `RecommendationResponse`, `QuestCompleteResponse`, `AlmostThereResponse`

---

## Acceptance criteria — all met

| Criterion | Status |
|-----------|--------|
| Quest completion event fires in real-time | PASS — event produced synchronously in `POST /quest-complete` |
| Recommendations exclude completed quests | PASS — Set-based exclusion; tested in unit + API tests |
| Anchored to declared goal category | PASS — all returned quests match `primary_goal_category` |
| 3 recommendations in <2s | PASS — in-memory; <5ms observed; latency test asserts <2000ms |
| 80% trigger fires (almost-there) | PASS — fires at 80, does not fire at 79 |
| Tested on Sofia (habit_builder persona) | PASS — `SOFIA_FIXTURE` tests confirm habit_builder quests, excluded completed IDs, 82% prompt |
| Fallback: intent-based when engine unavailable | PASS — `buildIntentFallback` returns cross-category results with `is_fallback: true` |

---

## Key design decisions

- **Goal alias mapping** bridges the existing `mock-members.ts` goal categories (`performance`, `wealth`, `mindfulness`, etc.) to the new Sprint 7 categories (`mindset`, `career`, `habit_builder`) so the engine works with both old and new member data.
- **In-memory catalogue** keeps latency well under 2s without any I/O.
- **Safe fallbacks everywhere** — unknown members always get a 200 response with either empty recommendations or an `is_fallback` result, never a 4xx or 5xx.
- **Types separated from data** — `src/types/recommendations.ts` has no import from `src/data/mock-quests.ts`, keeping the type layer clean and testable in isolation.
