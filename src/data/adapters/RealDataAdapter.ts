/**
 * RealDataAdapter — B1 Production Integration Stub
 *
 * TODO (B1 — Owner: Surya): Replace stub implementations with real HTTP calls
 * to the Mindvalley Learner Profile API once the following are confirmed:
 *
 *   1. API base URL and auth mechanism (API key / OAuth token)
 *   2. Endpoint contract: GET /members/{id}/learner-profile
 *   3. Data freshness SLA: realtime (<2s) vs hourly cached
 *   4. Rate limits and pagination strategy for batch calls
 *   5. Null-domain handling guarantees from the API
 *
 * TODO (B3 — Owner: Platform/Onboarding): Replace getFtuGoalData() stub with
 * a real call to the FTU/Onboarding API once accessible:
 *
 *   1. Endpoint contract: GET /members/{id}/onboarding/goals
 *   2. Confirm whether goals are scoped per-product or global
 *   3. Confirm whether multiple goal categories are supported
 *
 * Until these TODOs are resolved, the system will fall back to MockDataAdapter.
 */

import type { DataAdapter } from "./DataAdapter.interface";
import type { RawMemberData, FtuGoalData } from "../../types/index";

/**
 * Configuration required for the real API integration.
 * Populated from environment variables or adapter-config.ts.
 */
export interface RealDataAdapterConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  dataFreshness: "realtime" | "hourly" | "daily";
}

export class RealDataAdapter implements DataAdapter {
  readonly adapterName = "RealDataAdapter";
  readonly dataFreshness: "realtime" | "hourly" | "daily";

  private readonly config: RealDataAdapterConfig;

  constructor(config: RealDataAdapterConfig) {
    this.config = config;
    this.dataFreshness = config.dataFreshness;
  }

  // ─── B1: Learner Profile API ───────────────────────────────────────────────

  async getMemberData(memberId: string): Promise<RawMemberData | null> {
    // TODO (B1): Implement real API call.
    // Example:
    //   const res = await fetch(`${this.config.baseUrl}/members/${memberId}/learner-profile`, {
    //     headers: { Authorization: `Bearer ${this.config.apiKey}` },
    //     signal: AbortSignal.timeout(this.config.timeoutMs),
    //   });
    //   if (res.status === 404) return null;
    //   if (!res.ok) throw new Error(`API error ${res.status}`);
    //   return res.json() as Promise<RawMemberData>;
    throw new Error(
      `RealDataAdapter.getMemberData() is not yet implemented. ` +
        `B1 blocker (owner: Surya) must be resolved first. ` +
        `Use MockDataAdapter in the meantime.`
    );
  }

  async getBatchMemberData(memberIds: string[]): Promise<Map<string, RawMemberData>> {
    // TODO (B1): Implement batch endpoint or parallel individual calls with rate limiting.
    // Suggested approach: POST /members/batch with body { ids: memberIds }
    throw new Error(
      `RealDataAdapter.getBatchMemberData() is not yet implemented. ` +
        `B1 blocker (owner: Surya) must be resolved first. Requested ${memberIds.length} members.`
    );
  }

  // ─── B3: FTU / Onboarding Goal Data ──────────────────────────────────────

  async getFtuGoalData(memberId: string): Promise<FtuGoalData | null> {
    // TODO (B3): Implement real onboarding API call.
    // Example:
    //   const res = await fetch(`${this.config.baseUrl}/members/${memberId}/onboarding/goals`, {
    //     headers: { Authorization: `Bearer ${this.config.apiKey}` },
    //     signal: AbortSignal.timeout(this.config.timeoutMs),
    //   });
    //   if (res.status === 404) return null;
    //   if (!res.ok) throw new Error(`Onboarding API error ${res.status}`);
    //   return res.json() as Promise<FtuGoalData>;
    throw new Error(
      `RealDataAdapter.getFtuGoalData() is not yet implemented. ` +
        `B3 blocker (owner: Platform/Onboarding) must be resolved first. ` +
        `Member: ${memberId}`
    );
  }

  // ─── Health Check ──────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    // TODO (B1): Implement a lightweight ping to the API health endpoint.
    // Example:
    //   try {
    //     const res = await fetch(`${this.config.baseUrl}/health`, {
    //       headers: { Authorization: `Bearer ${this.config.apiKey}` },
    //       signal: AbortSignal.timeout(3000),
    //     });
    //     return res.ok;
    //   } catch {
    //     return false;
    //   }
    return false; // Always fails until implemented
  }
}
