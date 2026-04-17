/**
 * ContextAdapter interface — B2 Interim Workaround
 *
 * B2 Blocker: The Eve AI context injection interface format (JSON vs free-text)
 * is owned by the Eve AI Platform team and has not yet been confirmed.
 *
 * This interface abstracts the serialisation concern. Two implementations are
 * provided:
 *   - JsonContextAdapter: injects a structured JSON payload
 *   - FreeTextContextAdapter: injects a natural-language summary string
 *
 * Swap strategy: Once B2 is resolved, set `contextFormat` in adapter-config.ts
 * to "json" or "free_text" and the correct adapter will be used automatically.
 * No downstream code changes needed.
 */

import type { LearnerProfile, EveContextPayload } from "../types/index";

/**
 * Serialised context ready to be injected into Eve AI.
 * The `raw` field is what Eve AI will consume.
 */
export interface SerializedContext {
  format: "json" | "free_text";
  raw: string;
  member_id: string;
  built_at: string; // ISO-8601
}

/**
 * ContextAdapter — responsible for transforming a LearnerProfile into a
 * format that Eve AI can consume as session context.
 */
export interface ContextAdapter {
  /**
   * Serialise the learner profile into the Eve AI context format.
   */
  serialize(profile: LearnerProfile): SerializedContext;

  /**
   * The format this adapter produces.
   */
  readonly format: "json" | "free_text";

  /**
   * Adapter name for logging and metrics.
   */
  readonly adapterName: string;
}

// ─── JSON Context Adapter ─────────────────────────────────────────────────────

/**
 * Produces a compact JSON payload for Eve AI context injection.
 * Decision: Only the fields Eve AI needs for prompt generation are included
 * to keep the payload small (<1KB target).
 */
export class JsonContextAdapter implements ContextAdapter {
  readonly format = "json" as const;
  readonly adapterName = "JsonContextAdapter";

  serialize(profile: LearnerProfile): SerializedContext {
    const payload: EveContextPayload = {
      member_id: profile.member_id,
      member_state: profile.member_state.state,
      state_label: profile.member_state.label,
      confidence_score: profile.member_state.confidence_score,
      primary_goal: profile.intent.primary_goal_category,
      momentum_score: profile.pulse_signals.momentum_score,
      dormancy: profile.pulse_signals.dormancy_diagnosis,
      streak_days: profile.engagement.streak_days,
      current_quest_title: profile.learning.current_quest?.title ?? null,
      format: "json",
    };

    return {
      format: "json",
      raw: JSON.stringify(payload),
      member_id: profile.member_id,
      built_at: new Date().toISOString(),
    };
  }
}

// ─── Free-Text Context Adapter ────────────────────────────────────────────────

/**
 * Produces a natural-language system-prompt snippet for Eve AI context injection.
 * Useful if Eve AI consumes context as free text rather than structured JSON.
 */
export class FreeTextContextAdapter implements ContextAdapter {
  readonly format = "free_text" as const;
  readonly adapterName = "FreeTextContextAdapter";

  serialize(profile: LearnerProfile): SerializedContext {
    const { member_state, intent, engagement, learning, pulse_signals } = profile;

    const goal = intent.primary_goal_category
      ? `Their primary goal is "${intent.primary_goal_category}".`
      : "No primary goal has been declared yet.";

    const quest = learning.current_quest
      ? `They are currently working on "${learning.current_quest.title}" (${learning.current_quest.completion_percentage}% complete).`
      : "They have no active quest.";

    const dormancyText: Record<string, string> = {
      active: "actively engaged",
      drifting: "starting to drift (3–7 days inactive)",
      at_risk: "at risk of churning (7–30 days inactive)",
      churned: "churned (30+ days inactive)",
    };

    const raw = [
      `Member context for personalisation:`,
      `- Learning state: ${member_state.label} (State ${member_state.state}, confidence ${(member_state.confidence_score * 100).toFixed(0)}%)`,
      `- ${goal}`,
      `- Engagement: ${dormancyText[pulse_signals.dormancy_diagnosis]}, streak of ${engagement.streak_days} days.`,
      `- Momentum score: ${(pulse_signals.momentum_score * 100).toFixed(0)}/100.`,
      `- ${quest}`,
      `- Eve conversations (last 30d): ${intent.eve_conversation_frequency_30d}.`,
    ].join("\n");

    return {
      format: "free_text",
      raw,
      member_id: profile.member_id,
      built_at: new Date().toISOString(),
    };
  }
}
