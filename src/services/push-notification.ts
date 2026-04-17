/**
 * Eve Trainer — Push Notification Service (Sprint 6)
 *
 * Orchestrates the full nudge delivery pipeline:
 *   1. Check fatigue guard — block if member already received a nudge in the last 24h
 *   2. If Braze is available — send push notification via BrazeClient
 *   3. If Braze is down — fall back to in-app only
 *   4. Record delivery in the fatigue guard (regardless of channel)
 *   5. Fire Amplitude `push_delivered` event
 *
 * Provides:
 * 1. deliverNudge(member, nudgeEvent)          — full delivery pipeline
 * 2. buildPushPayload(member, nudgeEvent)       — construct BrazePushPayload
 *
 * A/B test: push notifications run under the `eve_push_nudge_v1` experiment.
 *   treatment: receives push notification via Braze
 *   control:   receives in-app nudge only (no push)
 */

import type { RawMemberData } from "../types/index";
import type { NudgeEvent } from "../types/nudges";
import type { BrazePushPayload, PushNotificationResult } from "../types/braze";
import { brazeClient, mapToBrazeUser } from "./braze-client";
import { fatigueGuard } from "./fatigue-guard";
import { assignABVariant, sendAmplitudeEvent } from "./ab-test";
import type { AmplitudeEvent } from "../types/prompts";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Experiment ID for the push notification A/B test */
const PUSH_EXPERIMENT_ID = "eve_push_nudge_v1";

/**
 * Campaign IDs mapped to nudge types.
 * In production these correspond to Braze Campaign objects.
 */
const CAMPAIGN_IDS: Record<string, string> = {
  streak_save: "braze_campaign_streak_save_v1",
  day3: "braze_campaign_day3_lapse_v1",
  day7: "braze_campaign_day7_lapse_v1",
  re_entry: "braze_campaign_re_entry_v1",
  reflection: "braze_campaign_reflection_v1",
  coaching: "braze_campaign_coaching_v1",
};

// ─── Amplitude Event Builder ─────────────────────────────────────────────────

/**
 * Build an Amplitude `push_delivered` event.
 *
 * Fires when a push notification is successfully delivered via any channel.
 * Includes the A/B variant for push experiment analysis.
 */
function buildPushDeliveredEvent(
  memberId: string,
  nudgeType: string,
  channel: string,
  abVariant: "treatment" | "control"
): AmplitudeEvent {
  const timestamp = new Date().toISOString();

  return {
    event_type: "push_delivered",
    user_id: memberId,
    time: timestamp,
    event_properties: {
      nudge_type: nudgeType,
      channel,
      ab_variant: abVariant,
    },
    user_properties: {
      ab_variant_push: abVariant,
    },
    insert_id: `push_delivered:${memberId}:${timestamp.slice(0, 16)}`,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a BrazePushPayload from a member and nudge event.
 *
 * Selects the correct campaign ID for the nudge type, maps the member
 * to BrazeUser format, and includes the A/B variant in the payload.
 *
 * @param member     - Raw member data
 * @param nudgeEvent - The nudge event to deliver
 * @returns BrazePushPayload ready to send
 */
export function buildPushPayload(
  member: RawMemberData,
  nudgeEvent: NudgeEvent
): BrazePushPayload {
  const abAssignment = assignABVariant(member.member_id, PUSH_EXPERIMENT_ID);
  const campaignId = CAMPAIGN_IDS[nudgeEvent.nudge_type] ?? CAMPAIGN_IDS["re_entry"]!;
  const brazeUser = mapToBrazeUser(member);

  return {
    campaign_id: campaignId,
    recipient: brazeUser,
    message: nudgeEvent.message,
    deep_link: nudgeEvent.deep_link?.url,
    ab_variant: abAssignment.variant,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Deliver a nudge to a member through the full push pipeline.
 *
 * Pipeline steps:
 *   1. Check fatigue guard → if blocked, return {delivered: false, channel: 'blocked'}
 *   2. Assign A/B variant (push experiment)
 *   3. If Braze is available AND variant is 'treatment':
 *        - Build push payload and send via BrazeClient
 *        - If Braze succeeds: channel = 'push'
 *        - If Braze fails: channel = 'in_app' (soft fallback within treatment)
 *   4. If Braze is NOT available:
 *        - channel = 'fallback' (in-app only, Braze was down)
 *   5. If variant is 'control':
 *        - channel = 'in_app' (no push for control group)
 *   6. Record nudge in fatigue guard
 *   7. Fire Amplitude push_delivered event (fire-and-forget)
 *   8. Return PushNotificationResult
 *
 * @param member     - Raw member data
 * @param nudgeEvent - The nudge event to deliver
 * @returns PushNotificationResult describing the delivery outcome
 */
export async function deliverNudge(
  member: RawMemberData,
  nudgeEvent: NudgeEvent
): Promise<PushNotificationResult> {
  const memberId = member.member_id;

  // Step 1: Fatigue guard check
  if (!fatigueGuard.canSendNudge(memberId)) {
    return {
      delivered: false,
      channel: "blocked",
      nudge_event: nudgeEvent,
    };
  }

  // Step 2: A/B variant assignment
  const abAssignment = assignABVariant(memberId, PUSH_EXPERIMENT_ID);
  const variant = abAssignment.variant;

  let result: PushNotificationResult;

  // Step 3-5: Delivery decision
  if (!brazeClient.isAvailable()) {
    // Braze is down — fall back to in-app
    result = {
      delivered: true,
      channel: "fallback",
      nudge_event: nudgeEvent,
    };
  } else if (variant === "control") {
    // Control group — in-app only, no push
    result = {
      delivered: true,
      channel: "in_app",
      nudge_event: nudgeEvent,
    };
  } else {
    // Treatment group — send via Braze push
    const payload = buildPushPayload(member, nudgeEvent);
    const brazeResponse = await brazeClient.sendPush(payload);

    if (brazeResponse.success) {
      result = {
        delivered: true,
        channel: "push",
        nudge_event: nudgeEvent,
        braze_response: brazeResponse,
      };
    } else {
      // Braze returned an error — soft fallback to in-app
      result = {
        delivered: true,
        channel: "in_app",
        nudge_event: nudgeEvent,
        braze_response: brazeResponse,
      };
    }
  }

  // Step 6: Record in fatigue guard (regardless of channel)
  fatigueGuard.recordNudge(memberId);

  // Step 7: Fire Amplitude push_delivered event (fire-and-forget)
  if (result.delivered) {
    const amplitudeEvent = buildPushDeliveredEvent(
      memberId,
      nudgeEvent.nudge_type,
      result.channel,
      variant
    );
    void sendAmplitudeEvent(amplitudeEvent);
  }

  return result;
}
