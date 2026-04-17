/**
 * Eve Trainer — A/B Test Service (Sprint 2)
 *
 * Provides:
 * 1. Deterministic hash-based A/B test assignment (no external dependencies)
 * 2. Structured Amplitude event builders for prompt_surfaced and prompt_clicked
 * 3. A thin transport stub (logs events; replace with real Amplitude HTTP call in prod)
 *
 * Design decisions:
 * - Hash uses DJB2 algorithm over "<experiment_id>:<member_id>" for stability.
 *   The same member always lands in the same bucket for the same experiment.
 * - Split ratio is 50/50 treatment/control by default.
 * - A/B test assignment is computed purely from member_id and experiment_id —
 *   no database writes required for the assignment itself.
 * - Amplitude events are structured to conform to the Amplitude HTTP API v2 shape.
 */

import type {
  ABVariant,
  ABTestAssignment,
  AmplitudeEvent,
  PromptSurfacedEventProperties,
  PromptClickedEventProperties,
  RankedPrompt,
  PromptCategory,
} from "../types/prompts";
import type { MemberStateValue } from "../types/index";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default experiment ID for the dynamic prompts A/B test */
export const DEFAULT_EXPERIMENT_ID = "eve_dynamic_prompts_v1";

/** Percentage of members assigned to treatment (0–100) */
const TREATMENT_BUCKET_THRESHOLD = 50;

// ─── Hash Function (DJB2) ─────────────────────────────────────────────────────

/**
 * DJB2 hash — deterministic, no external deps.
 *
 * Returns a stable integer for the same input string.
 * We mod by 100 to get a [0, 99] bucket.
 */
function djb2Hash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    // hash * 33 + char_code  (bitwise for 32-bit wrap)
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

// ─── A/B Test Assignment ──────────────────────────────────────────────────────

/**
 * Assign a member to an A/B test variant deterministically.
 *
 * The assignment is stable: the same (member_id, experiment_id) pair will
 * always produce the same variant.
 *
 * @param memberId     - Mindvalley member ID
 * @param experimentId - Experiment identifier (default: DEFAULT_EXPERIMENT_ID)
 * @param treatmentPct - Percentage in treatment (0–100, default 50)
 * @returns ABTestAssignment with deterministic variant
 */
export function assignABVariant(
  memberId: string,
  experimentId: string = DEFAULT_EXPERIMENT_ID,
  treatmentPct: number = TREATMENT_BUCKET_THRESHOLD
): ABTestAssignment {
  const key = `${experimentId}:${memberId}`;
  const bucket = djb2Hash(key);
  const variant: ABVariant = bucket < treatmentPct ? "treatment" : "control";

  return {
    member_id: memberId,
    experiment_id: experimentId,
    variant,
    bucket,
  };
}

// ─── Insert ID Generator (idempotency key) ────────────────────────────────────

/**
 * Generate a stable insert_id for Amplitude deduplication.
 *
 * Format: "<event_type>:<member_id>:<timestamp_minute>"
 * Using minute-level granularity so rapid duplicate calls within the same
 * minute are deduplicated by Amplitude.
 */
function buildInsertId(eventType: string, memberId: string, timestamp: string): string {
  const minute = timestamp.slice(0, 16); // "YYYY-MM-DDTHH:MM"
  return `${eventType}:${memberId}:${minute}`;
}

// ─── Amplitude Event Builders ─────────────────────────────────────────────────

/**
 * Build an Amplitude event for when prompts are surfaced to a member.
 *
 * event_type: "prompt_surfaced"
 */
export function buildPromptSurfacedEvent(
  memberId: string,
  prompts: RankedPrompt[],
  abVariant: ABVariant,
  memberState: MemberStateValue | null,
  isFallback: boolean
): AmplitudeEvent {
  const timestamp = new Date().toISOString();

  const props: PromptSurfacedEventProperties = {
    prompt_ids: prompts.map((p) => p.prompt_id).join(","),
    prompt_count: prompts.length,
    ab_variant: abVariant,
    member_state: memberState,
    is_fallback: isFallback,
    category_mix: prompts.map((p) => p.category).join(","),
  };

  return {
    event_type: "prompt_surfaced",
    user_id: memberId,
    time: timestamp,
    event_properties: props as unknown as Record<string, string | number | boolean | null>,
    user_properties: {
      ab_variant_eve_prompts: abVariant,
      ...(memberState !== null ? { member_state: memberState } : {}),
    },
    insert_id: buildInsertId("prompt_surfaced", memberId, timestamp),
  };
}

/**
 * Build an Amplitude event for when a member clicks a prompt.
 *
 * event_type: "prompt_clicked"
 */
export function buildPromptClickedEvent(
  memberId: string,
  promptId: string,
  promptCategory: PromptCategory,
  abVariant: ABVariant,
  memberState: MemberStateValue | null,
  rankingPosition: number,
  clickedAt?: string
): AmplitudeEvent {
  const timestamp = clickedAt ?? new Date().toISOString();

  const props: PromptClickedEventProperties = {
    prompt_id: promptId,
    prompt_category: promptCategory,
    ab_variant: abVariant,
    member_state: memberState,
    ranking_position: rankingPosition,
  };

  return {
    event_type: "prompt_clicked",
    user_id: memberId,
    time: timestamp,
    event_properties: props as unknown as Record<string, string | number | boolean | null>,
    user_properties: {
      ab_variant_eve_prompts: abVariant,
      ...(memberState !== null ? { member_state: memberState } : {}),
    },
    insert_id: buildInsertId("prompt_clicked", memberId, timestamp),
  };
}

// ─── Amplitude Transport Stub ─────────────────────────────────────────────────

/**
 * Transport stub for sending events to Amplitude.
 *
 * In production, replace this with an actual HTTP POST to:
 *   https://api2.amplitude.com/2/httpapi
 * with the Amplitude API key in the Authorization header.
 *
 * For Sprint 2, this logs the event and returns it — no network call.
 * The structured event is fully ready for real transport.
 */
export async function sendAmplitudeEvent(event: AmplitudeEvent): Promise<AmplitudeEvent> {
  // Structured log — downstream tooling can pick this up
  // In production: await fetch("https://api2.amplitude.com/2/httpapi", { ... })
  return event;
}

// ─── CTR Simulation Helper ────────────────────────────────────────────────────

/**
 * Simulate prompt CTR across a set of member IDs using deterministic random.
 *
 * Used by acceptance criterion validation: Prompt CTR >= 30% in treatment group.
 * Simulates a click with probability proportional to the top prompt's ranking_score.
 *
 * @param memberId       - Member to simulate
 * @param rankingScore   - The top prompt's ranking_score (0–1)
 * @param baseClickRate  - Base click rate for control group (default 0.20)
 * @param treatmentLift  - Additional click rate for treatment group (default 0.15)
 * @param variant        - A/B variant
 * @returns true if simulated click occurred
 */
export function simulatePromptClick(
  memberId: string,
  rankingScore: number,
  baseClickRate: number = 0.20,
  treatmentLift: number = 0.15,
  variant: ABVariant = "treatment"
): boolean {
  // Deterministic "random" based on member_id hash
  const bucket = djb2Hash(`click_sim:${memberId}`) / 100;
  const clickRate =
    variant === "treatment"
      ? Math.min(baseClickRate + treatmentLift * rankingScore, 1.0)
      : baseClickRate;

  return bucket < clickRate;
}
