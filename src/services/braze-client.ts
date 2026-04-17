/**
 * Eve Trainer — Braze Client Service (Sprint 6)
 *
 * Mock implementation of the Braze API client.
 *
 * Provides:
 * 1. BrazeClient class — mock Braze integration (no real HTTP calls)
 * 2. sendPush(payload) — simulates 95% success rate using deterministic seeding
 * 3. exportSegment(segmentId, members) — maps RawMemberData to BrazeUser format
 * 4. isAvailable() — env-controlled flag (BRAZE_ENABLED=true|false)
 *
 * Design decisions:
 * - No real HTTP calls — all responses are deterministic simulations
 * - Success rate is 95%, seeded by campaign_id + external_id (not Math.random())
 * - isAvailable() checks the BRAZE_ENABLED environment variable (default: true)
 * - A singleton export is provided so the service state is shared across callers
 */

import type { RawMemberData } from "../types/index";
import type {
  BrazeUser,
  BrazePushPayload,
  BrazeApiResponse,
  BrazeSegmentExport,
} from "../types/braze";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Simulated push delivery success rate (95%) */
const PUSH_SUCCESS_RATE = 0.95;

// ─── Deterministic Hash (DJB2) ────────────────────────────────────────────────

/**
 * DJB2 hash — identical algorithm to ab-test.ts for consistency.
 *
 * Returns a stable [0, 99] bucket for any input string.
 * Used to simulate the 95% success rate deterministically.
 */
function djb2Hash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

// ─── BrazeClient ─────────────────────────────────────────────────────────────

export class BrazeClient {
  /**
   * Check if the Braze integration is enabled via environment variable.
   *
   * Reads BRAZE_ENABLED from process.env.
   * Default: true (enabled) if the variable is not set.
   * Set BRAZE_ENABLED=false to simulate a Braze outage / disable the integration.
   */
  isAvailable(): boolean {
    const envValue = process.env["BRAZE_ENABLED"];
    if (envValue === undefined || envValue === null) return true;
    return envValue.toLowerCase() !== "false" && envValue !== "0";
  }

  /**
   * Send a push notification via Braze.
   *
   * This is a mock implementation. In production it would POST to:
   *   https://rest.iad-01.braze.com/messages/send
   * with the campaign_id, recipient, and message body.
   *
   * Success/failure is simulated deterministically using a DJB2 hash of
   * `campaign_id:external_id` — the same member/campaign pair will always
   * produce the same outcome (95% success rate).
   *
   * @param payload - The push notification payload
   * @returns BrazeApiResponse — success with message_id, or failure with error
   */
  async sendPush(payload: BrazePushPayload): Promise<BrazeApiResponse> {
    // Deterministic success simulation — seeded by campaign + recipient identity
    const seed = `${payload.campaign_id}:${payload.recipient.external_id}`;
    const bucket = djb2Hash(seed);
    const successThreshold = Math.floor(PUSH_SUCCESS_RATE * 100); // 95

    if (bucket < successThreshold) {
      // Simulate a successful Braze API response
      const messageId = `braze_msg_${djb2Hash(seed + payload.timestamp).toString(16)}_${Date.now().toString(36)}`;
      return {
        success: true,
        message_id: messageId,
      };
    } else {
      // Simulate a Braze API failure (5% of cases)
      return {
        success: false,
        error: "Braze simulated failure: delivery failed for recipient",
      };
    }
  }

  /**
   * Export a segment of members to Braze format.
   *
   * Maps an array of RawMemberData to the BrazeUser shape expected by
   * the Braze /users/track API. Attributes include key engagement signals
   * so Braze campaigns can personalise copy server-side.
   *
   * @param segmentId - Braze segment identifier
   * @param members   - Raw member data from the Eve platform
   * @returns BrazeSegmentExport — segment ID + mapped BrazeUser list
   */
  async exportSegment(
    segmentId: string,
    members: RawMemberData[]
  ): Promise<BrazeSegmentExport> {
    const brazeUsers: BrazeUser[] = members.map((m) => mapToBrazeUser(m));

    return {
      segment_id: segmentId,
      members: brazeUsers,
    };
  }
}

// ─── Mapping Helper ───────────────────────────────────────────────────────────

/**
 * Map a RawMemberData record to the BrazeUser format.
 *
 * Extracts key engagement attributes so Braze can use them in
 * message personalisation (streak_days, primary_goal, dormancy, etc.)
 */
export function mapToBrazeUser(member: RawMemberData): BrazeUser {
  const daysSinceActive = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(member.engagement.last_active_at).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  return {
    external_id: member.member_id,
    email: member.email,
    attributes: {
      streak_days: member.engagement.streak_days,
      primary_goal: member.intent.primary_goal_category ?? null,
      days_since_active: daysSinceActive,
      lessons_completed_30d: member.learning.lessons_completed_30d,
      current_quest_title: member.learning.current_quest?.title ?? null,
      session_frequency_weekly: member.engagement.session_frequency_weekly,
    },
  };
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * Singleton BrazeClient instance.
 *
 * Import this instance directly — no need to instantiate.
 */
export const brazeClient = new BrazeClient();
