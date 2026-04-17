---
scope: product
title: Eve Trainer — Master PRD
slug: eve-trainer
version: 1.0
status: discovery
resolution: 8/8
created: 2026-04-10
author: Suresh Sakadivan
---

# Eve Trainer — Master PRD
**Project:** Eve Trainer / Project Pulse
**Product Owner:** Suresh Sakadivan
**Version:** 1.0 — THINK Phase Output
**Status:** Draft for Engineering, DS & Design Review
**Date:** April 2026

---

# PART 1 — PRODUCT FOUNDATION

## 1.1 Problem Statement

Mindvalley members invest in transformation, not content. But today the platform treats them like content consumers — it has no persistent memory of who they are, where they are in their journey, or what they actually need next.

The scale of the gap is significant: 70% of subscribed members are not active on the platform weekly. 80% do not renew beyond 12 months. The platform cannot tell whether those members left having transformed — or left because they never did. That ambiguity is not acceptable for a company whose mission is human transformation.

Eve AI exists but operates without context. Members either don't know how to use it or use it only transactionally — 42% who open Eve never start a conversation, and 22% type but never send. The members who do go deeper with Eve become significantly more engaged, completing 2x more lessons than those who don't. But reaching that depth requires the member to take the first step — and most never do.

The data to fix this now exists — behavioral signals, conversation data, quiz completions, lesson history, wellness intent, identity shift moments from Eve conversations — but it is not yet composed into a system that makes Eve proactive. Eve Trainer is the initiative that composes these signals into a lifetime intelligence layer, so Eve can reach the right member, at the right moment, with the right prompt — turning passive consumers into active transformers, and making the member's lifetime journey the product itself.

## 1.2 Strategic Thesis

**Eve is not a feature. Eve is the measurement instrument for transformation.**

Content consumption tells you what someone watched. Eve conversations tell you who someone is becoming. Without Eve in the journey, Mindvalley is flying blind on whether its core promise — transformation — is actually happening.

The 3-conversation threshold is the single most critical leading indicator in this system. Members who have 3+ cross-touchpoint Eve conversations are on a fundamentally different trajectory — they complete 2x more lessons, return more frequently, and begin to form a companion relationship with Eve. Everything downstream — deeper personalisation, proactive nudges, identity shift detection — only becomes possible once that trust bridge is crossed.

**Eve Trainer's north star job:** Engineer the conditions for every member to reach their first 3 meaningful Eve conversations as quickly as possible — because beyond that threshold, Eve becomes their transformation mirror and the data compound effect begins.

## 1.3 The Flywheel

```
Goal AI onboards with trust
        ↓
Personalised catalogue builds first engagement
        ↓
Learning Assistant makes Eve feel natural and useful
        ↓
Quiz / Summarise features lower the barrier to interaction
        ↓
Members build trust through successful micro-interactions
        ↓
Trust opens the door to deeper conversations
        ↓
Deeper conversations generate richer signals
        ↓
Richer signals power better personalisation
        ↓
Better personalisation deepens the lifetime journey
```

Eve Trainer is the intelligence layer that closes this loop. Without it, each touchpoint works in isolation. With it, every interaction feeds the next one.

## 1.4 Design Principles

1. **Additive only. Never break anything.** — Every initiative must add value to the existing member experience. No ripping out existing flows. No big-bang migrations. No blocking dependencies on other squads.

2. **The Learner Profile API is a platform-wide intelligence service.** — Built for Eve first. Designed for the entire Mindvalley ecosystem from day one — CRM, platform recommendations, other squads, future initiatives. Any Mindvalley system that needs member intelligence should be able to consume it.

3. **Intent before behaviour.** — The most important thing to know about any member beyond their profile is their intent. Even a lightweight intent signal powers meaningful personalisation. The system always acts on the best available signal — never waits for perfect data.

4. **One nudge per day maximum.** — Maximum 1 proactive nudge per 24-hour window per member across all channels combined. Members who feel harassed disengage permanently.

5. **Every AI touchpoint has a rules-based fallback.** — If Eve AI is unavailable or has insufficient context, a rules-based fallback fires. The member experience never breaks.

6. **Prototype before build. Eval what you ship.** — Every use case has a working prototype before engineering begins. Evals are built progressively to measure what was shipped. Sprint rhythm: 1 week per use case.

7. **The member's story is the moat.** — Members don't stay because of streaks. They stay because Eve holds a mirror to who they're becoming — and they don't want to break that narrative. The product moat is the member's own transformation story, reflected back to them.

## 1.5 Journey Phases

Eve Trainer is organised around three member journey phases — not lifecycle stages. These phases describe the job Eve needs to do, not the time a member has been on the platform.

| Phase | Eve's Job | Risk if Eve Fails |
|---|---|---|
| **Phase 1: Start & Stay Engaged** | Remove blank-slate friction. Build first habit. Engineer the path to 3 Eve conversations. | Member drifts in week 2–3. Silent churn. Never discovers Eve's real value. |
| **Phase 2: Deepen Progress & Transformation** | Reflect progress back. Detect plateaus. Guide from consumption to real-world application. Co-create the next chapter before momentum breaks. | Member finishes content but feels no change. Doesn't renew at 12 months. |
| **Phase 3: Lifetime Value** | Become a companion across life chapters. Know who they're becoming, not just what they've done. Surface identity shifts. Anchor the renewal decision in proven transformation. | Member outgrows the platform. Leaves at renewal with no proof of change. |

## 1.6 Success Metrics

### Phase 1 Targets
| Metric | Baseline | Target |
|---|---|---|
| Eve Adoption | 10% | 30% |
| Weekly Returning Eve Users | 20% | 40% |
| AI-Influenced Consumption | 10% baseline | +20% |
| Eve Conversation Start Rate | 49.8% | 60% (+20%) |
| Average Conversation Depth | 2.5 | 3.2 (+25%) |
| Weekly Habituation (WAU/MAU) | 63% | 69% (+10%) |
| Positive Feedback Rate | 80% | 88% (+10%) |

### Phase 2 Targets
| Metric | Baseline | Target |
|---|---|---|
| Returning AI Users | Baseline | +15% |
| Progress Engagement | Baseline | Measurable |
| Goal Alignment Score | Baseline | 4.2 / 5.0 |
| Passive Member Reactivation | Current | +10% |

### Phase 3 Targets
| Metric | Baseline | Target |
|---|---|---|
| Renewal / Retention | Baseline | LTV lift |
| AI-Influenced Consumption | 10% | 30% |
| Multi-year Engagement | Baseline | Tracked |

---

# PART 2 — SYSTEM ARCHITECTURE

## 2.1 Three-Layer Model

The Pulse Intelligence Engine sits between existing data and existing product surfaces. It is not a new product — it is the intelligence layer that connects what already exists.

| Layer | Name | What It Does |
|---|---|---|
| **A: Data Foundation** | 12 Data Domains (D1–D12) | Raw BigQuery signal domains. Each domain captures a distinct dimension of member behaviour. Unlock progressively as member generates data. |
| **B: Signal Combination** | 9 Pulse Signals | Reusable combinations of domain data that detect member states. These are the composable intelligence components. |
| **C: Pulse Intelligence Engine** | 4-Step Reasoning Loop | Understand member state → Choose next-best intervention → Personalise timing, tone & surface → Route to right product/channel. |
| **D: Experience Activation** | 6 Product Surfaces | Eve AI · Goal AI · Learning Assistant · Push/CRM/Re-engagement · Progress Insights/Dashboard · Content Recommendations |

## 2.2 Signal Reference — Phase 1 Active Signals

Phase 1 uses four signals powered by six data domains (D1, D9, D2, D5, D3, D10).

| Signal Name | DS Domain Mapping | Key Columns | What It Detects | Phase |
|---|---|---|---|---|
| **Intent Readiness** | D1 + D9 | completed_ftu, ftu_growth_areas, wellness_intent_persona, intent_signal_breadth | Has the member declared intent? How rich is the intent signal? Cold-start quality. | P1 |
| **Momentum Strength** | D2 + D5 + D10 | active_7d, active_30d, learning_consistency_rate, last_any_activity_at, quest_completion_rate | Habit forming vs breaking. Streak health. Return frequency. | P1 |
| **Completion Discipline** | D3 + D5 + D11 | asset_completion_rate_pct, avg_pages_per_active_day, lessons_in_progress, task_engagement_rate | Browser vs finisher pattern. Learning velocity. Follow-through rate. | P1 |
| **Dormancy Diagnosis** | D2 + D3 + D5 | days_since_last_quest_interaction, lifecycle_stage, last_any_activity_at, learning_velocity_persona | Drift type — passive, stuck, or gone. Urgency of re-engagement. | P1 |

### Phase 2 & 3 Signals (defined, not yet active)
| Signal Name | Phase |
|---|---|
| AI Trust & Coachability | P2 |
| Discovery Dependence | P2 |
| Transformation Readiness | P2 |
| Progress Visibility State | P2 |
| Lifetime Need Prediction | P3 |

## 2.3 Member Intelligence Layer — Incremental Unlock Plan (C1)

The Learner Profile API is built incrementally. Each unlock tier adds signal depth as member behaviour generates new data. The system always uses the richest available signal — never waits for all domains to be present.

| Unlock Tier | Signals Available | Data Domains | Powers |
|---|---|---|---|
| **C1 Lite** | Intent Readiness + Momentum Strength + Completion Discipline + Dormancy Diagnosis | D1, D9, D2, D5, D3, D10 | I2 Dynamic Entry Points + I3 Momentum Nudges |
| **C1 Mid** | + AI Trust & Coachability + Discovery Dependence + Progress Visibility | + D4, D8, D11 | I4 Predictive Path Continuity |
| **C1 Rich** | + Transformation Readiness + Lifetime Need Prediction | + D6, D7, D12 | I5 Transformation Signal Detection |

**Cold-start rule:** If a member has fewer than 3 active signal patterns, fall back to Intent Readiness (D1+D9) only. Never surface empty or low-confidence personalisation.

## 2.4 Four Member States — Phase 1

The Pulse Engine classifies every Phase 1 member into one of four states. State determines intervention type.

| State | Who | Signal Pattern | Eve's Job |
|---|---|---|---|
| **State 1: No Intent** | New member, no FTU completed. Jordan. | Intent Readiness score = 0 | Probe intent conversationally. Offer 2–3 starter recommendations to spark first declaration. |
| **State 2: Intent Declared, Not Yet Habituated** | Has goal, started content, fewer than 3 Eve conversations. Ryan / Dena. | Intent Readiness > 0, Momentum Strength low, Eve conversations < 3 | Lower barrier to next Eve interaction. Hyper-relevant proactive prompt anchored to last action. |
| **State 3: Habituating** | 3+ Eve conversations, consistent weekly activity, streak forming. Sofia. | Momentum Strength high, Completion Discipline forming | Deepen reflection, not just consumption. Move from finishing lessons to applying learning. |
| **State 4: Drifting** | Was active, gone quiet 3+ days. Dena specifically. | Dormancy Diagnosis active, last_any_activity_at > 3 days | Re-enter with specific contextual hook. Not generic — anchored to exactly where they stopped. |

---

# PART 3 — INITIATIVES

## Initiative 1 — Member Intelligence Layer (C1 Incremental)

**Purpose:** Build and progressively enrich a unified Learner Profile API that gives Eve and every Mindvalley system a structured, real-time view of each member. This is the backbone of Eve Trainer — it is never "done", always enriching. All other initiatives depend on this. Built for Eve first, designed for the full Mindvalley ecosystem from day one.

**Current Status:** WIP. Surya's DS team has reduced 1,200 BigQuery tables to ~200 relevant tables, built 12 core data dimensions, and is adding 9 new dimensions — 5 from Eve AI (conversational overview, intent classification, intent breakdown, memory profile, content recommendation) and 4 from Learning Assistant (conversational overview, program/course engagement, inquiry signals, content quality). Swaraj is building the intent confidence score calculation. Dimension validation is the current active work.

### Learner Profile Object — C1 Lite Schema
```json
{
  "member_id": "auth0|123",
  "identity": {
    "timezone": "Asia/Kuala_Lumpur",
    "language": "en",
    "lifecycle_stage": "active | at_risk | lapsing | dormant"
  },
  "intent": {
    "completed_ftu": true,
    "primary_goal": "confidence",
    "growth_areas": ["mindfulness", "relationships"],
    "intent_signal_breadth": 2,
    "wellness_intent_persona": "high_intent | seeker | partial"
  },
  "engagement": {
    "active_7d": true,
    "active_30d": true,
    "last_any_activity_at": "2026-04-06T14:23:00Z",
    "engagement_tier": "omni_learner | quest_focused | meditation_only",
    "uses_eve_ai": true,
    "eve_sessions_count": 2
  },
  "learning": {
    "active_quest_name": "Silva Ultramind",
    "last_lesson_completed": "Lesson 12",
    "quest_completion_rate_pct": 0.62,
    "learning_velocity_persona": "steady_learner | velocity_sprinter",
    "days_since_last_quest_interaction": 1
  },
  "pulse_signals": {
    "intent_readiness": 0.75,
    "momentum_strength": 0.60,
    "completion_discipline": 0.55,
    "dormancy_diagnosis": "active"
  },
  "member_state": "habituating"
}
```

### API Requirements
- Given a member_id, returns structured Learner Profile object
- Response latency: under 2 seconds for in-app surfaces
- Async generation acceptable for push and email channels
- Degrades gracefully when a domain has no data — returns null slot, never fails
- Versioned schema with backward compatibility for 2 major versions
- Consumed by: Eve AI conversation layer, CRM/Braze, content recommendation engine, platform squad, any future consumer

### Data Refresh Cadence
| Signal | Cadence |
|---|---|
| Intent Readiness | On FTU completion event (real-time) |
| Momentum Strength | Daily batch + real-time activity event |
| Completion Discipline | Daily batch |
| Dormancy Diagnosis | Daily batch |

### Sprint Breakdown
| Sprint | Task | Owner |
|---|---|---|
| Week 1 | Audit and confirm D1 + D9 data completeness and query accessibility | DS — Surya |
| Week 1 | Define and validate C1 Lite Learner Profile schema | DS — Swaraj + Engineering |
| Week 1 | Build intent confidence score calculation and validate on sample users | DS — Swaraj |
| Week 2 | Build Learner Profile API endpoint — C1 Lite | Engineering — Amr |
| Week 2 | Integrate D2 + D5 + D3 + D10 into profile object | DS — Surya |
| Week 2 | Internal API testing on 300 sample members | DS + Engineering |
| Week 3 | API available for I2 and I3 consumption | Engineering |

### Acceptance Criteria
- [ ] API returns valid Learner Profile object for any active member_id within 2 seconds
- [ ] Profile contains all C1 Lite fields as specified in schema above
- [ ] Null domain slots return gracefully — no API failure on missing data
- [ ] Intent confidence score is calculated and attached to profile
- [ ] Member state classification (State 1–4) is computed and returned
- [ ] API is documented and accessible to Eve AI platform team, CRM team, and platform squad

### Open Questions
- **B1 (Blocker):** What is the exact current state of the Learner Profile API — which fields are queryable today, what is the data freshness cadence, and what is missing before C1 Lite is production-ready? Owner: Surya. Resolve by: Week 1, Day 2.
- **B2:** Does Eve AI's current context injection interface support structured Learner Profile objects, or does it expect free-text prompts? Owner: Eve AI Platform team. Resolve by: Week 1.
- **B3:** Is the FTU goal data (D9) API-accessible or locked in the onboarding product? Owner: Platform/Onboarding squad. Resolve by: Week 1.

## Initiative 2 — Proactive Entry Points (Dynamic Prompts)

**Purpose:** Eliminate the blank-page problem at every Eve surface by generating dynamic, personalised starter prompts anchored to what the Pulse Engine already knows about this member. The direct attack on the 42% Eve drop-off rate and 22% type-but-never-send rate. This is the primary mechanism to engineer the first 3 Eve conversations for every member.

### Member Experience Moment
A member opens Eve after completing Lesson 12 of Silva Ultramind. Instead of a blank cursor, they see three prompts waiting for them:

*"How can I apply today's lesson on mental clarity to my work stress?"*
*"Continue your reflection from yesterday — you were exploring self-doubt."*
*"You're 62% through Silva Ultramind. Want to talk about what's shifted for you?"*

The member doesn't need to think. They tap. The conversation begins.

### Signals Used
- Intent Readiness → determines prompt category (goal-anchored vs content-anchored vs reflection-anchored)
- Momentum Strength → determines prompt urgency (continue momentum vs reignite)
- Completion Discipline → determines prompt depth (surface-level vs deep reflection)
- Member State → determines prompt tone and context

### Sprint Breakdown (3 use cases across Weeks 3–5)

| Sprint | Task | Owner |
|---|---|---|
| Week 3 | Design prompt template library (goal, content, reflection, re-entry categories) | DS — Swaraj |
| Week 3 | Build prompt ranking model v1 — rule-based scoring by member state | DS — Surya |
| Week 3 | UI component — dynamic prompt strip (3 prompts, tappable) | Design — Ofla |
| Week 4 | Integrate C1 Lite API into Eve AI new chat prompt generation | Engineering |
| Week 4 | A/B test: personalised prompts vs static prompts — Eve AI new chat (UC-01) | Analytics — Sarah |
| Week 5 | Integrate dynamic prompts into Learning Assistant (UC-02) | Engineering |
| Week 5 | Post-consumption reflection prompt — lesson completion trigger (UC-03) | Engineering |
| Week 5 | Eval: prompt click-through rate, conversation depth post-prompt | DS + Analytics |

### Success Metrics
| Metric | Baseline | Target |
|---|---|---|
| Eve conversation start rate | 49.8% | 60% |
| Prompt click-through rate | 0% (new) | 35%+ |
| Average conversation depth post-prompt | 2.5 turns | 3.2 turns |

## Initiative 3 — Momentum Nudges & Drift Prevention

**Purpose:** Detect when a member's momentum is breaking — before they go fully silent — and reach out proactively with a specific, contextual intervention anchored to where they stopped. The goal is not to remind members that Mindvalley exists. The goal is to show members that Mindvalley remembers them specifically.

### Nudge Logic
| Trigger | Condition | Nudge Type | Channel |
|---|---|---|---|
| Streak save | active_24h = false by 8pm local time AND streak ≥ 3 days | "You're 1 lesson from keeping your streak. [Lesson] — 8 mins." | Push / In-app |
| Day 3 lapse | days_since_last_activity = 3 AND lifecycle_stage = active | Re-entry hook anchored to last lesson + declared goal | In-app |
| Day 7 lapse | days_since_last_activity = 7 AND lifecycle_stage = at_risk | Stronger re-entry + progress reminder ("You're X% through [Quest]") | Push + In-app |
| Stuck point | Same lesson in lessons_in_progress for 7+ days | Unstuck offer: Skip / Eve explanation / Related content | In-app coaching card |
| Quest completion gap | Quest completed, no new quest started in 5+ days | Next chapter prompt — predictive path (feeds I4) | In-app |

### Sprint Breakdown
| Sprint | Task | Owner |
|---|---|---|
| Week 4 | Define nudge trigger rules and threshold logic for all 5 nudge types | DS — Swaraj + Suresh |
| Week 4 | Build Dormancy Diagnosis signal — validate on sample members | DS — Surya |
| Week 5 | Build streak save nudge — in-app, rules-based (no AI yet) | Engineering |
| Week 5 | Deep-link infrastructure — every nudge routes to exact lesson, not homepage | Engineering |
| Week 6 | Day 3 and Day 7 lapse nudges — in-app | Engineering |
| Week 6 | Braze integration — personalisation API contract defined and connected | Engineering + CRM |
| Week 6 | Stuck-point detection and in-app coaching card | Engineering + Design — Ofla |
| Week 7 | Push notification nudges via Braze — streak save + Day 7 lapse | Engineering + CRM |
| Week 7 | Notification fatigue guard — 1 nudge per 24h per member enforced | Engineering |
| Week 7 | Eval: nudge open rate, lesson completion rate post-nudge | Analytics — Sarah |

### Success Metrics
| Metric | Baseline | Target |
|---|---|---|
| Streak save rate | Baseline | 35% of streak-break days recovered |
| Stuck-point resolution | Baseline | 50% progress past stuck lesson within 48hrs |
| Passive member reactivation | Current | +10% |
| Weekly returning Eve users | 20% | 40% |

## Initiative 4 — Predictive Path Continuity

**Purpose:** Detect natural journey transitions before momentum breaks — quest completion, habit formation milestones, goal achievement signals — and proactively co-create the next chapter with the member. Eve doesn't wait for drift. Eve anticipates the gap and fills it with purpose. This is the difference between a platform and a mentor.

### Member Experience Moment
Sofia just completed Conscious Parenting — her third quest in 4 months. Before she wonders what to do next, Eve reaches out:

*"You just finished Conscious Parenting. Based on your journey, I think you're ready for something deeper. You've been building emotional intelligence — here are 3 paths that continue that arc. Want to explore them together?"*

### Sprint Breakdown
| Sprint | Task | Owner |
|---|---|---|
| Week 7 | Define quest completion event pipeline — confirm real-time event availability | Engineering + DS |
| Week 7 | Build next-chapter recommendation logic — goal-category matching + completion history | DS — Surya |
| Week 8 | Build "almost there" prompt — 80% completion trigger | Engineering |
| Week 8 | Build next chapter Eve conversation flow — proactive outreach post-completion | Engineering + DS |
| Week 8 | Design: "New Chapter" flow UX — Ofla | Design — Ofla |
| Week 9 | Goal milestone identity reflection prompt | DS — Swaraj + Engineering |
| Week 9 | 5-day silence re-entry nudge via Braze | Engineering + CRM |
| Week 9 | Eval: next chapter acceptance rate, time-to-next-quest | Analytics — Sarah |

### Success Metrics
| Metric | Baseline | Target |
|---|---|---|
| Time to next quest after completion | Baseline | Reduce by 30% |
| Next chapter prompt acceptance rate | 0% (new) | 40%+ |
| Multi-quest completion rate | Baseline | +20% |

## Initiative 5 — Transformation Signal Detection (Phase 2)

**Purpose:** Move beyond content consumption metrics. Detect reflection depth, emotional shifts, identity shift moments, and real-world application signals from Eve conversations. This is what makes Phase 2 and Phase 3 metrics measurable — and what makes the lifetime journey defensible as a product moat. A member who can see their own transformation is a member who renews.

**Note on Readiness:** This initiative requires meaningful Eve conversation volume before signals become statistically reliable. The minimum conversation dataset threshold for reliable transformation signal detection is currently undefined — this is the responsibility of the DS team to define as conversation data accumulates. Initiative 5 is planned but does not have a committed ship date in Phase 1. It activates when C1 Rich signals are available and DS team confirms data volume is sufficient.

### Transformation Signals to Detect
| Signal Type | How Detected | Data Source |
|---|---|---|
| Reflection depth | Turn count per conversation + question complexity vs declarative statement ratio | D8 Eve AI Interaction |
| Emotional shift | Tone analysis across conversation history — tracks valence change over time | D8 Eve AI Interaction |
| Identity shift moment | Member uses identity language: "I am now", "I've become", "I realised I'm" | D8 Eve AI Interaction |
| Real-world application | Member reports applying content: "I tried this and...", "I used what I learned..." | D8 Eve AI Interaction |
| Habituated practice | Meditation targets set + consistent completion + wellness targets | D6 + D12 + D9 |

---

# PART 4 — EXECUTION PLAN

## 4.1 Sprint Delivery Rhythm

One use case. One focused sprint. Prototype before build. Eval what you ship.

| Week | Use Case | Initiative | Primary Owner |
|---|---|---|---|
| 1–2 | C1 Lite Learner Profile API | I1 | DS — Surya + Engineering — Amr |
| 3 | Post-reflection dynamic prompts — Eve AI new chat (UC-01) | I2 | DS — Swaraj + Engineering |
| 4 | Dynamic prompts — Learning Assistant (UC-02) | I2 | Engineering + Design |
| 5 | Post-consumption dynamic prompts (UC-03) | I2 | Engineering |
| 5–6 | Momentum nudges — streak save + Day 3 lapse | I3 | Engineering + DS |
| 6–7 | Stuck-point detection + Braze nudge integration | I3 | Engineering + CRM |
| 7–8 | Predictive path continuity — quest completion trigger | I4 | DS + Engineering |
| 8–9 | Next chapter flow + goal milestone prompt | I4 | Engineering + Design |
| Phase 2 | Transformation signal detection | I5 | DS — Swaraj |

## 4.2 Phase Gate Rule
No use case ships to production without:
1. A working prototype reviewed by Suresh
2. Amplitude instrumentation in place before launch
3. A/B test or control group defined
4. Rules-based fallback confirmed working
5. DS team sign-off on signal accuracy for that use case

---

# PART 5 — OPEN QUESTIONS & DEPENDENCIES

## Blockers (Must resolve before build starts)

| ID | Question | Owner | Resolve By |
|---|---|---|---|
| B1 | Current state of Learner Profile API — what's queryable today, freshness cadence, gaps to C1 Lite | Surya | Week 1, Day 2 |
| B2 | Eve AI context injection interface — does it support structured Learner Profile objects or free-text only? | Eve AI Platform | Week 1 |
| B3 | FTU goal data (D9) — is it API-accessible or locked in onboarding product? | Platform / Onboarding squad | Week 1 |

## Decisions Needed

| ID | Question | Owner | Resolve By |
|---|---|---|---|
| D1 | Post-consumption prompts (UC-03) — dismissible or mandatory-view? | Suresh | Before Ofla designs UC-03 |
| D2 | Stuck-point coaching card — confirm UI must support future Eve AI upgrade without rebuild | Engineering | Before Ofla designs card |
| D3 | Braze integration — existing personalisation API contract or build from scratch? | CRM / Growth | Week 5 |
| D4 | Minimum conversation volume threshold for I5 transformation signal reliability | DS — Swaraj | Phase 2 planning |
| D5 | Learning Assistant prompt latency SLA — maximum acceptable delay before degrading lesson page UX | Engineering | Before UC-02 sprint |

## Team Dependencies

| Team | What's Needed | For Initiative |
|---|---|---|
| DS — Surya | C1 Lite dimensions validated and queryable | I1, I2, I3 |
| DS — Swaraj | Intent confidence score + prompt ranking model | I1, I2 |
| Engineering — Amr | Learner Profile API endpoint | I1 |
| Engineering | Deep-link infrastructure | I3 |
| Engineering | Quest completion event pipeline | I4 |
| Design — Ofla | Dynamic prompt UI component, coaching card, New Chapter UX | I2, I3, I4 |
| Analytics — Sarah | Amplitude instrumentation, A/B test setup, dashboard updates | All |
| CRM / Growth | Braze personalisation API integration | I3 |
| Eve AI Platform | Context injection interface confirmation | I2 |
| Platform / Onboarding | FTU goal data API access | I1 |

---

# APPENDIX A — Signal Pattern Quick Reference
Intent Readiness (D1+D9) · Momentum Strength (D2+D5+D10) · Completion Discipline (D3+D5+D11) · Dormancy Diagnosis (D2+D3+D5) · AI Trust & Coachability (D8+D4) · Discovery Dependence (D4+D3+D7) · Transformation Readiness (D9+D8+D1) · Progress Visibility State (D2+D10+D11) · Lifetime Need Prediction (All domains)

# APPENDIX B — Data Domain Reference
D1 Identity & Lifecycle · D2 Engagement Depth · D3 Content Affinity (Quests) · D4 Discovery Pattern · D5 Learning Velocity · D6 Content Affinity (Meditation) · D7 Content Affinity (Channels) · D8 Eve AI Interaction · D9 Wellness Intent · D10 Quest History · D11 Lesson History · D12 Meditation & Sound History

# APPENDIX C — Demo Member Reference
Jordan (new, no FTU) · Ryan (overwhelmed newcomer) · Dena (starter/dropper) · Sofia (habit builder)

*— End of Master PRD v1.0 —*
