/**
 * Eve Trainer — Sprint 6 Types: Braze Integration
 *
 * Types for:
 * - BrazeUser: external user identity + attributes for Braze
 * - BrazePushPayload: structured push notification payload sent to Braze API
 * - BrazeApiResponse: response shape from the Braze API (mocked)
 * - BrazeSegmentExport: a Braze segment definition with its member list
 * - FatigueGuardState: per-member state tracking nudge frequency
 * - PushNotificationResult: outcome of a full push delivery attempt
 */

import type { NudgeEvent } from "./nudges";

// ─── Braze User ───────────────────────────────────────────────────────────────

/**
 * Braze user identity and attribute payload.
 *
 * Maps directly to the Braze /users/track API format.
 * external_id is the stable Mindvalley member_id used as the Braze alias.
 */
export interface BrazeUser {
  /** Stable external identifier — Mindvalley member_id */
  external_id: string;
  /** Member email address */
  email?: string;
  /** Member phone number (E.164 format) */
  phone?: string;
  /** Member's IANA timezone (e.g. "America/New_York") */
  timezone?: string;
  /** Arbitrary Braze custom attributes */
  attributes?: Record<string, string | number | boolean | null>;
}

// ─── Braze Push Payload ───────────────────────────────────────────────────────

/**
 * Push notification payload sent to the Braze /messages/send API.
 *
 * Each push corresponds to a single NudgeEvent being delivered via
 * the push channel. The payload includes the campaign, recipient,
 * message body, optional deep-link, and A/B variant metadata.
 */
export interface BrazePushPayload {
  /** Braze campaign ID for this push notification type */
  campaign_id: string;
  /** The recipient member */
  recipient: BrazeUser;
  /** Push notification message body (localised, personalised) */
  message: string;
  /** Optional deep-link URL for the push notification CTA */
  deep_link?: string;
  /**
   * A/B test variant this push belongs to.
   * Used by Braze Campaign Analytics to split push metrics by variant.
   */
  ab_variant: "treatment" | "control";
  /** ISO-8601 timestamp when this push was constructed */
  timestamp: string;
}

// ─── Braze API Response ───────────────────────────────────────────────────────

/**
 * Response returned by the (mocked) Braze API after a send attempt.
 *
 * In production this maps to the Braze /messages/send HTTP response body.
 */
export interface BrazeApiResponse {
  /** Whether the API accepted the request */
  success: boolean;
  /** Braze-assigned message ID (present on success) */
  message_id?: string;
  /** Error description (present on failure) */
  error?: string;
}

// ─── Braze Segment Export ─────────────────────────────────────────────────────

/**
 * A Braze segment with its exported member list.
 *
 * Segments are used to target cohorts of members with specific nudge campaigns.
 * For example: "members 3+ days inactive" or "members with streaks at risk".
 */
export interface BrazeSegmentExport {
  /** Braze segment identifier */
  segment_id: string;
  /** Members belonging to this segment */
  members: BrazeUser[];
}

// ─── Fatigue Guard State ──────────────────────────────────────────────────────

/**
 * Per-member fatigue guard state stored in the in-memory store.
 *
 * Tracks when the last nudge was sent and how many nudges have been
 * sent in the current 24-hour window. The guard prevents more than
 * 1 nudge per member per 24h across all channels (push + in-app).
 */
export interface FatigueGuardState {
  /** Mindvalley member ID */
  member_id: string;
  /** ISO-8601 timestamp of the most recent nudge sent to this member */
  last_nudge_at: string;
  /** Count of nudges sent in the last 24h */
  nudge_count_24h: number;
}

// ─── Push Notification Result ─────────────────────────────────────────────────

/**
 * The result of a full push delivery attempt for a single member.
 *
 * channel values:
 *   push:     Delivered successfully via Braze push
 *   in_app:   Delivered as in-app only (no push — control variant or no push token)
 *   fallback: Braze was unavailable; in-app only as fallback
 *   blocked:  Fatigue guard blocked this nudge (1 nudge per 24h already sent)
 */
export type PushChannel = "push" | "in_app" | "fallback" | "blocked";

export interface PushNotificationResult {
  /** Whether the nudge was delivered via any channel */
  delivered: boolean;
  /** The channel used to deliver the nudge */
  channel: PushChannel;
  /** The nudge event that triggered this delivery */
  nudge_event: NudgeEvent;
  /** Braze API response (present if Braze was attempted) */
  braze_response?: BrazeApiResponse;
}
