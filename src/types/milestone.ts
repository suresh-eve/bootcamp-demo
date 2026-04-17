/**
 * Eve Trainer — Sprint 8 Types: Next Chapter Flow & Goal Milestone
 *
 * Types for:
 * - GoalMilestone        — fires when a member completes 3/6/9 quests in the same category
 * - MilestoneReflection  — Eve identity-reflection prompt triggered by a milestone
 * - NewChapterFlow       — full post-quest-completion landing payload
 * - SilenceNudge         — re-entry nudge for members silent for 5+ days
 */

import type { BrazePushPayload } from "./braze";
import type { NextChapterRecommendation } from "./recommendations";

// ─── Goal Milestone ────────────────────────────────────────────────────────────

/**
 * Milestone level classification.
 *
 * Level 1 = 3 quests completed in the same category (first milestone)
 * Level 2 = 6 quests completed in the same category
 * Level 3 = 9 quests completed in the same category
 */
export type MilestoneLevel = 1 | 2 | 3;

/**
 * A milestone fires when a member reaches 3, 6, or 9 completions in a single
 * goal category.  The level maps directly: 3 → 1, 6 → 2, 9 → 3.
 */
export interface GoalMilestone {
  /** Mindvalley member ID */
  member_id: string;
  /** The goal category in which the milestone was reached */
  category: string;
  /** Total quests completed in this category at the time the milestone fired */
  quests_completed: number;
  /** Milestone level: 1 (3 quests), 2 (6 quests), 3 (9 quests) */
  milestone_level: MilestoneLevel;
  /** ISO-8601 timestamp when this milestone was triggered */
  triggered_at: string;
  /**
   * A/B test variant for the milestone reflection experiment.
   * treatment: full identity-reflection prompt is shown
   * control:   plain congratulations message only
   */
  ab_variant: "treatment" | "control";
}

// ─── Milestone Reflection ──────────────────────────────────────────────────────

/**
 * Identity-reflection prompt surfaced by Eve when a milestone is reached.
 *
 * The prompt_text is personalised to the category and milestone level
 * so Eve can address the member's evolving identity (e.g. "habit builder",
 * "mindset explorer").
 */
export interface MilestoneReflection {
  /** The milestone that triggered this reflection */
  milestone: GoalMilestone;
  /** The reflection question / statement Eve presents to the member */
  prompt_text: string;
  /** Structured context injected into the Eve AI model for this conversation */
  eve_context: string;
  /** Whether the member can swipe away without engaging with the prompt */
  dismissible: boolean;
}

// ─── New Chapter Flow ──────────────────────────────────────────────────────────

/**
 * Full post-quest-completion landing payload.
 *
 * Returned by GET /members/:member_id/new-chapter-flow.
 * Orchestrates recommendations, the Eve proactive message, and (if triggered)
 * the milestone reflection in a single API round-trip.
 */
export interface NewChapterFlow {
  /** Mindvalley member ID */
  member_id: string;
  /** The quest that was just completed */
  completed_quest: {
    quest_id: string;
    title: string;
    category: string;
  };
  /** 3 next-chapter quest recommendations (< 2s SLA) */
  recommendations: NextChapterRecommendation[];
  /** Eve's proactive follow-up message ("Great job finishing…") */
  eve_proactive_message: string;
  /** True when a goal milestone was triggered by this completion */
  is_milestone: boolean;
  /**
   * Present only when is_milestone is true.
   * Contains the full milestone reflection payload.
   */
  milestone?: MilestoneReflection;
  /** ISO-8601 timestamp when this flow was generated */
  generated_at: string;
}

// ─── Silence Nudge ─────────────────────────────────────────────────────────────

/**
 * Re-entry nudge for members who have been silent for 5+ days.
 *
 * Delivered via Braze push (treatment) or in-app (control / fallback).
 * The 5-day threshold is the trigger point; below 5 days no nudge fires.
 */
export interface SilenceNudge {
  /** Mindvalley member ID */
  member_id: string;
  /** How many days the member has been silent (>= 5 to fire) */
  days_silent: number;
  /** The delivery channel that was used (or will be used) */
  channel: "push" | "in_app" | "fallback";
  /**
   * Braze push payload, present when channel is 'push'.
   * Undefined for in-app / fallback channels.
   */
  braze_payload?: BrazePushPayload;
  /** In-app message shown as fallback when push is unavailable or skipped */
  in_app_fallback: string;
  /**
   * A/B test variant for the silence-nudge re-entry experiment.
   * treatment: push notification via Braze
   * control:   in-app nudge only
   */
  ab_variant: "treatment" | "control";
  /** ISO-8601 timestamp when this nudge was built */
  created_at: string;
}
