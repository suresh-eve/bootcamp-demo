/**
 * Eve Trainer — Sprint 3 Types: Learning Assistant Context
 *
 * Types for:
 * - Lesson metadata (used in Learning Assistant prompts)
 * - Learning prompts response shape (lesson-specific + goal-anchored)
 * - A/B test variant for Learning Assistant experiment
 */

import type { MemberStateValue } from "./index";
import type { RankedPrompt, ABVariant } from "./prompts";

// ─── Lesson Context ───────────────────────────────────────────────────────────

/**
 * Lesson metadata — used to generate lesson-specific prompts.
 *
 * Populated from mock-lessons.ts in Sprint 3; from a real API in production.
 */
export interface LessonMeta {
  /** Unique lesson identifier */
  lesson_id: string;
  /** Human-readable lesson title */
  title: string;
  /**
   * Topic/theme of the lesson — used in prompt personalisation.
   * e.g. "limiting beliefs", "morning routines", "goal setting"
   */
  topic: string;
  /** Quest (course) this lesson belongs to */
  quest_id: string;
  /** Quest title — denormalised for convenience */
  quest_title: string;
  /** Primary category of the quest (health, wealth, mindfulness, etc.) */
  quest_category: string;
}

// ─── Learning Prompt Types ────────────────────────────────────────────────────

/**
 * Additional context attached to a learning prompt — surfaces what drove it.
 *
 * context_type distinguishes the two required prompt types:
 * - "lesson_specific": anchored to the lesson_id / quest_id in the request
 * - "goal_anchored":   anchored to the member's declared primary goal
 * - "general":         general reflection/re-entry prompt (fallback filler)
 */
export type LearningPromptContextType = "lesson_specific" | "goal_anchored" | "general";

/** A ranked prompt enriched with Learning Assistant context signals */
export interface LearningRankedPrompt extends RankedPrompt {
  /** What drove this prompt's selection */
  context_type: LearningPromptContextType;
}

// ─── API Response: Learning Prompts ──────────────────────────────────────────

/**
 * Response shape for GET /members/:member_id/learning-prompts
 * ?lesson_id=:lesson_id&quest_id=:quest_id
 */
export interface LearningPromptsResponse {
  /** 2–3 prompts for the Learning Assistant surface */
  prompts: LearningRankedPrompt[];
  /** A/B test variant this member is assigned to */
  ab_variant: ABVariant;
  /** Whether these are static fallback prompts (profile/lesson unavailable) */
  is_fallback: boolean;
  meta: {
    request_id: string;
    /** Server-side processing time — target <1000ms */
    latency_ms: number;
    member_state: MemberStateValue | null;
    adapter: string;
    /** lesson_id from the query string (echoed back) */
    lesson_id: string | null;
    /** quest_id from the query string (echoed back) */
    quest_id: string | null;
  };
}

// ─── Internal: Learning Prompt Request Context ────────────────────────────────

/**
 * Internal context object threaded through the learning prompt ranking pipeline.
 */
export interface LearningPromptContext {
  lesson_id: string | null;
  quest_id: string | null;
  lesson_meta: LessonMeta | null;
  primary_goal: string | null;
  current_quest_title: string | null;
}
