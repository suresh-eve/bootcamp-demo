/**
 * Eve Trainer — Sprint 2 Types: Dynamic Prompts & A/B Testing
 *
 * Types for:
 * - Prompt template library (4 categories)
 * - Ranked prompt response
 * - Prompt CTR click event
 * - A/B test assignment and Amplitude event interface
 */

import type { MemberStateValue } from "./index";

// ─── Prompt Categories ────────────────────────────────────────────────────────

/**
 * The 4 prompt categories aligned to member journey moments.
 *
 * - goal:       Connect current activity to declared goal
 * - content:    Recommend specific quests / lessons
 * - reflection: Encourage journaling, self-assessment
 * - re_entry:   Low-friction re-engagement for dormant members
 */
export type PromptCategory = "goal" | "content" | "reflection" | "re_entry";

// ─── Prompt Template ──────────────────────────────────────────────────────────

/** A single prompt template stored in the library */
export interface PromptTemplate {
  /** Unique stable identifier for this template */
  prompt_id: string;
  /** Prompt category */
  category: PromptCategory;
  /** The text shown to the member in Eve chat */
  text: string;
  /**
   * Target member states this prompt is designed for (1–4).
   * A template may target multiple states.
   */
  target_states: MemberStateValue[];
  /**
   * Optional goal category filter — only surface when the member's
   * primary_goal_category matches one of these values.
   * Empty array / omitted means "any goal category".
   */
  goal_categories?: string[];
  /**
   * Base priority weight (0.0–1.0) for ranking within the category.
   * Higher = prefer this template when other signals are equal.
   */
  base_weight: number;
}

// ─── Ranked Prompt ────────────────────────────────────────────────────────────

/** A prompt after ranking — includes the computed score and debug signals */
export interface RankedPrompt {
  prompt_id: string;
  category: PromptCategory;
  text: string;
  /** Final ranking score (0.0–1.0) used to order prompts */
  ranking_score: number;
  /** Human-readable explanation of why this prompt was surfaced */
  reason: string;
}

// ─── API Response: Eve Prompts ────────────────────────────────────────────────

/** Response shape for GET /members/:member_id/eve-prompts */
export interface EvePromptsResponse {
  /** 2–3 ranked prompts to surface in Eve chat */
  prompts: RankedPrompt[];
  /** A/B test variant this member is assigned to */
  ab_variant: ABVariant;
  /** Whether these are static fallback prompts (API/profile unavailable) */
  is_fallback: boolean;
  meta: {
    request_id: string;
    latency_ms: number;
    member_state: MemberStateValue | null;
    adapter: string;
  };
}

// ─── API Request: Prompt CTR ──────────────────────────────────────────────────

/** Request body for POST /members/:member_id/prompt-ctr */
export interface PromptCtrRequest {
  prompt_id: string;
  ab_variant: ABVariant;
  /** ISO-8601 timestamp of the click (client-supplied; server will validate) */
  clicked_at?: string;
  /** Optional: the member state at time of click (for downstream analytics) */
  member_state?: MemberStateValue;
}

/** Response shape for POST /members/:member_id/prompt-ctr */
export interface PromptCtrResponse {
  recorded: boolean;
  event_id: string;
  amplitude_event: AmplitudeEvent;
}

// ─── A/B Test ─────────────────────────────────────────────────────────────────

/** A/B test variant identifiers */
export type ABVariant = "control" | "treatment";

/** A/B test assignment result */
export interface ABTestAssignment {
  member_id: string;
  experiment_id: string;
  variant: ABVariant;
  /** Deterministic hash bucket [0, 99] that determined the variant */
  bucket: number;
}

// ─── Amplitude Event Interface ────────────────────────────────────────────────

/**
 * Structured Amplitude event interface.
 * This mirrors the Amplitude HTTP API v2 event shape so that the
 * event can be forwarded to Amplitude without transformation.
 *
 * Note: actual HTTP transport to Amplitude is outside Sprint 2 scope.
 *       This interface provides the contract; transport is a stub.
 */
export interface AmplitudeEvent {
  /** Amplitude event type (e.g. "prompt_surfaced", "prompt_clicked") */
  event_type: string;
  /** Mindvalley member ID */
  user_id: string;
  /** ISO-8601 timestamp */
  time: string;
  /** Event-specific properties */
  event_properties: Record<string, string | number | boolean | null>;
  /** User-level properties to set/update on the Amplitude user object */
  user_properties: Record<string, string | number | boolean | null>;
  /** Insert ID for deduplication (idempotency key) */
  insert_id: string;
}

/**
 * Prompt surfaced event — fired when 2–3 prompts are returned from the API
 */
export interface PromptSurfacedEventProperties {
  prompt_ids: string;         // comma-separated list of prompt IDs shown
  prompt_count: number;
  ab_variant: ABVariant;
  member_state: number | null;
  is_fallback: boolean;
  category_mix: string;       // e.g. "goal,content,reflection"
}

/**
 * Prompt clicked event — fired when the member taps a prompt
 */
export interface PromptClickedEventProperties {
  prompt_id: string;
  prompt_category: PromptCategory;
  ab_variant: ABVariant;
  member_state: number | null;
  ranking_position: number;   // 1-indexed position of the clicked prompt
}
