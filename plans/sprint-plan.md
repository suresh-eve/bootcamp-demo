---
title: Sprint Plan — Eve Trainer Phase 1
created: 2026-04-10
---

# Sprint Plan: Eve Trainer Phase 1 (9 weeks)

## Overview
- **Project:** Eve Trainer / Project Pulse
- **Phase:** 1 — Start & Stay Engaged
- **Duration:** 9 weeks (April–June 2026)
- **North Star:** Engineer every member to 3+ meaningful Eve conversations
- **Total Sprints:** 9 (Sprint 0–8)

## Sprint 0: Foundation & Blocker Resolution (Week 1)

**Goal:** Resolve critical blockers (B1–B3). Establish C1 Lite signal foundation.

**Blockers to Resolve:**
- **B1:** Current Learner Profile API state, data freshness cadence (Owner: Surya)
- **B2:** Eve AI context injection interface — JSON or free-text? (Owner: Eve AI Platform)
- **B3:** FTU goal data accessibility (Owner: Platform/Onboarding)

**Acceptance Criteria:**
- [ ] B1, B2, B3 resolved or interim workarounds confirmed
- [ ] C1 Lite schema locked and approved
- [ ] Intent confidence score algorithm v1 tested on 100 members
- [ ] All blockers documented in contracts/sprint-0-done.md

**Risk:** Blockers take >2 days → Pre-build 2 API versions (lite + full) in parallel

---

## Sprint 1: C1 Lite Learner Profile API (Weeks 1–2)

**Goal:** Build, test, ship the Learner Profile API endpoint. This is the backbone for I2–I4.

**Deliverables:**
- `GET /members/{member_id}/learner-profile` endpoint
- Schema: intent, engagement, learning, pulse_signals, member_state (from PRD Part 2.3)
- Latency: <2s for in-app surfaces
- Graceful null handling (no failures on missing domains)
- Fallback rule: If <3 signals, return Intent Readiness only

**Acceptance Criteria:**
- [ ] API returns valid LearnerProfile for any member_id
- [ ] Response latency <2s
- [ ] All C1 Lite fields present
- [ ] Null domain slots return gracefully
- [ ] Intent confidence score calculated
- [ ] Member state classification (State 1–4) working
- [ ] Fallback rule tested
- [ ] API documented (OpenAPI spec)
- [ ] 300 sample members tested
- [ ] Suresh review passed

---

## Sprint 2: Dynamic Prompts - Eve AI New Chat (Week 3)

**Goal:** Remove blank-page friction. Surface 2–3 personalized prompts on Eve open.

**Deliverables:**
- Prompt template library (4 categories: goal, content, reflection, re-entry)
- Prompt ranking model v1 (rule-based)
- Dynamic Prompt Strip UI component
- C1 Lite API integration into Eve chat
- A/B test instrumentation (Amplitude)

**Acceptance Criteria:**
- [ ] 2–3 prompts surface within 2s of Eve open
- [ ] Prompts differ across member states (4 states validated)
- [ ] Prompt ranking: Intent + Momentum + context
- [ ] Fallback: Static prompts if API unavailable
- [ ] A/B test running (treatment vs control)
- [ ] Prompt CTR ≥30%

---

## Sprint 3: Dynamic Prompts - Learning Assistant (Week 4)

**Goal:** Lesson context prompts. Lower barrier to Eve interaction during learning.

**Deliverables:**
- C1 Lite integration into Learning Assistant
- Lesson-specific + goal-anchored prompts
- Latency <1s (must not degrade lesson page)
- Prompt component design & implementation

**Acceptance Criteria:**
- [ ] 2–3 prompts below lesson content
- [ ] Load within 1s
- [ ] At least 1 lesson-specific + 1 goal-anchored
- [ ] Fallback rule tested
- [ ] A/B test running

**Blocker Decision:** D5 — Max acceptable latency SLA (resolve by Week 3 EOW)

---

## Sprint 4: Dynamic Prompts (UC-03) + Streak-Save Nudge (Week 5)

**Goal (I2 UC-03):** Reflection prompt on lesson completion.
**Goal (I3):** Streak-save nudge — detect streak breaks, re-enter by 8pm local time.

**Deliverables (I2):**
- Post-consumption reflection prompt (2s after lesson completion)
- Dismissible or mandatory-view (per Decision D1)

**Deliverables (I3):**
- Dormancy Diagnosis signal
- Streak-save in-app nudge
- Deep-link infrastructure (to exact lesson, not homepage)
- A/B test (nudge vs control)

**Acceptance Criteria:**
- [ ] Reflection prompt surfaces 2s post-completion
- [ ] Prompt uses member state context
- [ ] Decision D1 implemented
- [ ] Streak nudge fires by 8pm before break
- [ ] Deep-links work
- [ ] Dormancy signal validated on 500+ members

**Blocker Decision:** D1 — UC-03 UX approach (resolve by Week 4 EOW)

---

## Sprint 5: Momentum Nudges (Day 3 & 7 Lapses + Stuck-Point) (Week 6)

**Goal:** Detect drift early. Re-enter with context-specific hooks.

**Deliverables:**
- Day 3 lapse nudge (in-app card)
- Day 7 lapse nudge (in-app card, stronger)
- Stuck-point detector (7+ days on same lesson)
- Coaching card (Skip / Explain / Related)
- A/B tests for all 3

**Acceptance Criteria:**
- [ ] Day 3 fires on same day for eligible members
- [ ] Day 7 fires for at_risk members
- [ ] Stuck-point detects 7+ day stalls
- [ ] Coaching card surfaces with 3 actions
- [ ] All deep-link to correct trigger point
- [ ] Fallback rule tested
- [ ] A/B tests running

**Blocker Decision:** D2 — Coaching card UI supports future Eve AI upgrade? (resolve by Week 5 EOW)

---

## Sprint 6: Braze Integration + Push Nudges + Fatigue Guard (Week 7)

**Goal:** Extend nudges to push/email. Enforce 1 nudge per 24h.

**Deliverables:**
- Braze personalisation API contract
- Push notification templates (streak-save + Day 7 lapse)
- Notification fatigue guard service
- Amplitude instrumentation for push
- Braze segment export integration

**Acceptance Criteria:**
- [ ] Braze API contract defined & implemented
- [ ] Push notifications deliver via Braze
- [ ] Fatigue guard: 1 nudge per member per 24h
- [ ] Fatigue guard tested (multiple triggers → 1 fires)
- [ ] A/B test running for push
- [ ] Fallback confirmed (in-app only if Braze down)

**Blocker Decision:** D3 — Braze existing contract or new build? (resolve by Week 5 EOW)

---

## Sprint 7: Predictive Path Continuity - Quest Completion (Week 8)

**Goal:** Detect quest completions. Proactively surface next chapter.

**Deliverables:**
- Quest completion event pipeline (real-time)
- Next-chapter recommendation logic (goal-matched, 3–5 options)
- 80% completion "almost there" prompt
- Recommendation algorithm (validated on demo member Sofia)

**Acceptance Criteria:**
- [ ] Quest completion event fires in real-time
- [ ] Recommendations exclude completed quests
- [ ] Anchored to declared goal category
- [ ] 3 recommendations in <2s
- [ ] 80% trigger fires
- [ ] Tested on Sofia (habit builder)
- [ ] Fallback: Intent-based if engine unavailable

---

## Sprint 8: Next Chapter Flow + Goal Milestone (Week 9)

**Goal:** Conversational next-chapter flow. Goal milestone identity reflection.

**Deliverables:**
- New Chapter UX flow (post-quest landing)
- Eve proactive next-chapter conversation
- Goal milestone trigger (3 quests in same category)
- Milestone identity reflection prompts
- 5-day silence re-entry nudge via Braze
- A/B tests for both

**Acceptance Criteria:**
- [ ] Quest completion routes to New Chapter flow
- [ ] 3 recommendations generated <2s
- [ ] Eve proactively offers next path
- [ ] Goal milestone trigger fires after 3 completions
- [ ] Milestone reflection in Eve with context
- [ ] 5-day silence nudge via push + email
- [ ] Full flows validated with demo members

---

## Phase 1 Completion Gate

**Go/No-Go Checklist:**
- [ ] I1 API production, <2s latency, 100% uptime
- [ ] I2 prompts shipped (UC-01, 02, 03), A/B running
- [ ] I3 nudges + Braze + fatigue guard live
- [ ] I4 next chapter flow + milestone live
- [ ] Phase 1 metrics achieved:
  - Eve conversation start rate: 60%+
  - Prompt CTR: 35%+
  - Weekly returning Eve users: 40%+
  - Avg conversation depth: 3.2+ turns
- [ ] Amplitude dashboard live
- [ ] Suresh approval

---

## Team Dependencies & Blockers

### Blockers (Must resolve before build)
| ID | Question | Owner | Due |
|---|---|---|---|
| B1 | Current Learner Profile API state | Surya | Week 1, Day 2 |
| B2 | Eve AI context injection interface | Eve AI Platform | Week 1 |
| B3 | FTU goal data accessibility | Platform/Onboarding | Week 1 |

### Decisions Needed
| ID | Question | Owner | Due |
|---|---|---|---|
| D1 | UC-03 UX: dismissible or mandatory? | Suresh | Week 4 EOW |
| D2 | Coaching card UI future-proof? | Engineering/Design | Week 5 EOW |
| D3 | Braze: existing or new contract? | CRM/Growth | Week 5 EOW |
| D5 | LA latency SLA? | Engineering | Week 3 EOW |

### Team Availability Assumptions
- ✅ DS (Surya, Swaraj): Full Weeks 1–9
- ✅ Engineering (Amr + team): Full Weeks 1–9
- ✅ Design (Ofla): Full Weeks 2–9
- ✅ Analytics (Sarah): Full Weeks 2–9

