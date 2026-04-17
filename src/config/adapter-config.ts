/**
 * adapter-config.ts — B1 / B2 / B3 Adapter Configuration
 *
 * Central configuration file that wires up the correct adapters based on
 * environment and blocker resolution status.
 *
 * HOW TO SWAP TO PRODUCTION:
 *
 *   B1 (Learner Profile API):
 *     1. Set DATA_ADAPTER=real in environment
 *     2. Set LEARNER_PROFILE_API_URL=<real URL>
 *     3. Set LEARNER_PROFILE_API_KEY=<real key>
 *
 *   B2 (Eve AI context format):
 *     1. Set EVE_CONTEXT_FORMAT=json or EVE_CONTEXT_FORMAT=free_text
 *
 *   B3 (FTU goal data):
 *     Resolved automatically when B1 RealDataAdapter is active,
 *     since getFtuGoalData() is part of the DataAdapter interface.
 */

import { MockDataAdapter } from "../data/adapters/MockDataAdapter";
import { RealDataAdapter } from "../data/adapters/RealDataAdapter";
import { JsonContextAdapter, FreeTextContextAdapter } from "../context/ContextAdapter.interface";
import type { DataAdapter } from "../data/adapters/DataAdapter.interface";
import type { ContextAdapter } from "../context/ContextAdapter.interface";

// ─── Environment helpers ──────────────────────────────────────────────────────

function env(key: string, fallback: string): string {
  return (typeof process !== "undefined" && process.env[key]) || fallback;
}

// ─── B1 Data Adapter Configuration ───────────────────────────────────────────

export interface DataAdapterConfig {
  type: "mock" | "real";
  /** Only used when type === "real" */
  real?: {
    baseUrl: string;
    apiKey: string;
    timeoutMs: number;
    dataFreshness: "realtime" | "hourly" | "daily";
  };
}

const dataAdapterConfig: DataAdapterConfig = {
  // B1 WORKAROUND: Defaulting to "mock" until real API is confirmed.
  // Change to "real" once B1 is resolved.
  type: (env("DATA_ADAPTER", "mock") as "mock" | "real"),
  real: {
    baseUrl: env("LEARNER_PROFILE_API_URL", "https://api.mindvalley.com/v1"),
    apiKey: env("LEARNER_PROFILE_API_KEY", ""),
    timeoutMs: parseInt(env("LEARNER_PROFILE_API_TIMEOUT_MS", "2000"), 10),
    dataFreshness: (env("DATA_FRESHNESS", "hourly") as "realtime" | "hourly" | "daily"),
  },
};

// ─── B2 Context Adapter Configuration ────────────────────────────────────────

export interface ContextAdapterConfig {
  // B2 WORKAROUND: Defaulting to "json" as the more structured and
  // machine-parseable format. Change to "free_text" if Eve AI Platform
  // confirms they consume context as a system-prompt string.
  format: "json" | "free_text";
}

const contextAdapterConfig: ContextAdapterConfig = {
  format: (env("EVE_CONTEXT_FORMAT", "json") as "json" | "free_text"),
};

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Build and return the active DataAdapter based on configuration.
 * B1/B3 workaround: returns MockDataAdapter unless DATA_ADAPTER=real.
 */
export function createDataAdapter(): DataAdapter {
  if (dataAdapterConfig.type === "real" && dataAdapterConfig.real) {
    const cfg = dataAdapterConfig.real;
    if (!cfg.apiKey) {
      console.warn(
        "[adapter-config] LEARNER_PROFILE_API_KEY not set — falling back to MockDataAdapter"
      );
      return new MockDataAdapter();
    }
    return new RealDataAdapter(cfg);
  }
  return new MockDataAdapter();
}

/**
 * Build and return the active ContextAdapter based on configuration.
 * B2 workaround: defaults to JSON format.
 */
export function createContextAdapter(): ContextAdapter {
  if (contextAdapterConfig.format === "free_text") {
    return new FreeTextContextAdapter();
  }
  return new JsonContextAdapter();
}

// ─── Blocker Status Documentation ────────────────────────────────────────────

export interface BlockerStatus {
  id: string;
  description: string;
  owner: string;
  status: "open" | "workaround_active" | "resolved";
  workaround: string;
  resolution_steps: string[];
}

export const BLOCKER_STATUS: BlockerStatus[] = [
  {
    id: "B1",
    description: "Current Learner Profile API state and data freshness cadence",
    owner: "Surya",
    status: "workaround_active",
    workaround:
      "MockDataAdapter serves pre-generated fixtures from mock-members.ts. " +
      "DataAdapter interface decouples all code from the real API.",
    resolution_steps: [
      "Confirm API base URL and auth mechanism",
      "Confirm GET /members/{id}/learner-profile contract",
      "Confirm data freshness SLA (realtime vs hourly cached)",
      "Set DATA_ADAPTER=real, LEARNER_PROFILE_API_URL, LEARNER_PROFILE_API_KEY in env",
    ],
  },
  {
    id: "B2",
    description: "Eve AI context injection interface — JSON or free-text",
    owner: "Eve AI Platform",
    status: "workaround_active",
    workaround:
      "Both JsonContextAdapter and FreeTextContextAdapter are implemented. " +
      "Defaulting to JSON. Switch via EVE_CONTEXT_FORMAT=free_text env var.",
    resolution_steps: [
      "Eve AI Platform team confirms preferred context injection format",
      "Set EVE_CONTEXT_FORMAT=json or EVE_CONTEXT_FORMAT=free_text in env",
      "No code changes required — adapter is swapped automatically",
    ],
  },
  {
    id: "B3",
    description: "FTU goal data accessibility from Platform/Onboarding",
    owner: "Platform/Onboarding",
    status: "workaround_active",
    workaround:
      "MockDataAdapter.getFtuGoalData() synthesises FTU data from the member's " +
      "goal_declarations where source === 'ftu'. The ftu_goal_from_mock flag is " +
      "set on the intent domain to signal this workaround is active.",
    resolution_steps: [
      "Platform/Onboarding team exposes GET /members/{id}/onboarding/goals",
      "Implement RealDataAdapter.getFtuGoalData() with the real API call",
      "Remove ftu_goal_from_mock flag logic from LearnerProfileService",
    ],
  },
];
