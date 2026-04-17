# Sprint 6 — Braze Integration + Push Nudges + Fatigue Guard

**Sprint:** 6 (Week 7)
**Status:** DONE
**Date:** 2026-04-10

## What Was Built

### 1. Types — `src/types/braze.ts`

Six new TypeScript interfaces/types for the Braze integration layer:

| Type | Purpose |
|------|---------|
| `BrazeUser` | External Braze user identity + engagement attributes |
| `BrazePushPayload` | Push notification payload sent to Braze `/messages/send` |
| `BrazeApiResponse` | Mock Braze API response (success/failure + message_id) |
| `BrazeSegmentExport` | Braze segment with its exported BrazeUser member list |
| `FatigueGuardState` | Per-member last_nudge_at + nudge_count_24h record |
| `PushNotificationResult` | Full delivery outcome: channel + delivered + braze_response |

### 2. Service — `src/services/braze-client.ts`

`BrazeClient` class (mock, no real HTTP calls):
- `sendPush(payload)` — deterministic 95% success rate via DJB2 hash of `campaign_id:external_id`
- `exportSegment(segmentId, members)` — maps `RawMemberData[]` to `BrazeUser[]` with engagement attributes
- `isAvailable()` — reads `BRAZE_ENABLED` env var (default: true; set false to simulate outage)
- `mapToBrazeUser(member)` — helper exported for standalone use
- Singleton `brazeClient` exported for use across services

### 3. Service — `src/services/fatigue-guard.ts`

`FatigueGuard` class (in-memory Map store):
- `canSendNudge(memberId)` — true if no nudge in the last 24h
- `recordNudge(memberId)` — records timestamp; increments counter within 24h window
- `resetGuard(memberId)` — removes member record (test cleanup / manual override)
- `clearAll()` — wipes entire store (test isolation)
- `getState(memberId)` — read current FatigueGuardState (testing/inspection)
- Singleton `fatigueGuard` exported for shared use across services and API

### 4. Service — `src/services/push-notification.ts`

`deliverNudge(member, nudgeEvent)` — full delivery pipeline:
1. Fatigue guard check → returns `{delivered: false, channel: 'blocked'}` if blocked
2. A/B variant assigned via `eve_push_nudge_v1` experiment
3. Delivery routing:
   - Braze available + treatment → send via Braze push (`channel: 'push'`)
   - Braze error → soft fallback (`channel: 'in_app'`)
   - Braze unavailable → fallback (`channel: 'fallback'`)
   - Control variant → in-app only (`channel: 'in_app'`)
4. Fatigue guard records the nudge after any delivery
5. Fires Amplitude `push_delivered` event (fire-and-forget) with `ab_variant`

`buildPushPayload(member, nudgeEvent)` — constructs `BrazePushPayload` with campaign mapping and A/B variant.

### 5. API Endpoint — `POST /members/:member_id/send-nudge`

Added to `src/api/server.ts`:
- Body: `{ nudge_type: 'streak_save' | 'day3' | 'day7' | 'coaching' }`
- Builds the appropriate `NudgeEvent` for the requested type
- Runs the full delivery pipeline (fatigue guard → Braze → fallback)
- Returns `PushNotificationResult` with delivery outcome
- Error handling: 400 for invalid member_id/nudge_type, 404 for unknown member

### 6. Tests — `tests/braze-push.test.ts`

**48 tests, all passing:**

| Group | Tests |
|-------|-------|
| BrazeClient.sendPush success simulation | 3 |
| BrazeClient.sendPush failure simulation | 1 |
| BrazeClient.isAvailable env control | 5 |
| BrazeClient.exportSegment BrazeUser format | 5 |
| FatigueGuard canSendNudge / recordNudge | 8 |
| deliverNudge push pipeline | 5 |
| buildPushPayload structure | 4 |
| BrazeSegmentExport validity | 3 |
| POST /send-nudge API | 11 |
| mapToBrazeUser helper | 3 |

### 7. OpenAPI — `docs/openapi.yaml`

- New tag: `braze`
- New path: `POST /members/{member_id}/send-nudge` with full request/response schemas
- New schemas: `BrazeUser`, `BrazePushPayload`, `BrazeApiResponse`, `BrazeSegmentExport`, `FatigueGuardState`, `PushChannel`, `PushNotificationResult`, `SendNudgeRequest`

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Braze API contract defined & implemented | DONE — `BrazePushPayload`, `BrazeApiResponse` in `src/types/braze.ts`; `BrazeClient` in `src/services/braze-client.ts` |
| Push notifications deliver via Braze (mocked) | DONE — `BrazeClient.sendPush()` with deterministic 95% success rate |
| Fatigue guard: 1 nudge per member per 24h | DONE — `FatigueGuard.canSendNudge()` + `recordNudge()` enforces 24h window |
| Fatigue guard tested (multiple triggers → only 1 fires) | DONE — "multiple nudge type triggers → only 1 can be delivered" test |
| A/B test running for push | DONE — `eve_push_nudge_v1` experiment; variant included in `BrazePushPayload` and `push_delivered` Amplitude event |
| Fallback confirmed (in-app only if Braze down) | DONE — `deliverNudge()` returns `channel: 'fallback'` when `BRAZE_ENABLED=false` |

## Decision

**D3 resolved:** Using new Braze contract (not existing). `BrazePushPayload` is designed from scratch to match the Braze `/messages/send` API shape, with `campaign_id`, `recipient`, `message`, `deep_link`, and `ab_variant` fields.

## Key Design Decisions

- **No Math.random()** — success rate is deterministic via DJB2 hash of `campaign_id:external_id`. Same member + campaign always produces the same outcome.
- **Singleton exports** — both `brazeClient` and `fatigueGuard` are module-level singletons shared across the API server and services, eliminating per-request instantiation.
- **Channel-agnostic fatigue guard** — push, in-app, and fallback deliveries all count toward the 24h limit. Only `blocked` does not consume a slot.
- **Soft Braze failure fallback** — if Braze returns a non-success response, the channel degrades to `in_app` rather than failing the delivery entirely.
- **Test isolation** — `FatigueGuard.clearAll()` is called in `beforeEach`/`afterEach` blocks to prevent cross-test contamination in the singleton store.

## Full Test Suite Health

All 321 tests pass (6 test suites: braze-push + momentum-nudges + eve-prompts + learner-profile-api + nudges + learning-prompts).
`npx tsc --noEmit` — zero TypeScript errors.
