/**
 * DataAdapter interface — B1 Interim Workaround
 *
 * B1 Blocker: The current Learner Profile API state and data freshness cadence
 * are owned by Surya and not yet confirmed. This adapter interface decouples
 * all downstream code from the concrete API implementation so that once B1 is
 * resolved, only the RealDataAdapter needs to change.
 *
 * Swap strategy: Replace `MockDataAdapter` with `RealDataAdapter` in
 * `adapter-config.ts` once the real API contract is confirmed.
 */

import type { RawMemberData, FtuGoalData } from "../../types/index";

export interface DataAdapter {
  /**
   * Fetch raw member data for a single member.
   * Returns null if the member is not found.
   */
  getMemberData(memberId: string): Promise<RawMemberData | null>;

  /**
   * Fetch raw member data for a batch of members.
   * Returns a map of member_id → RawMemberData (missing members are omitted).
   */
  getBatchMemberData(memberIds: string[]): Promise<Map<string, RawMemberData>>;

  /**
   * Fetch FTU goal data for a member (B3 surface).
   * Returns null if onboarding data is unavailable.
   */
  getFtuGoalData(memberId: string): Promise<FtuGoalData | null>;

  /**
   * Health-check: returns true if the underlying data source is reachable.
   */
  healthCheck(): Promise<boolean>;

  /**
   * Identifier for this adapter (used in logging / metrics).
   */
  readonly adapterName: string;

  /**
   * Data freshness cadence for this adapter.
   * - "realtime": live API call
   * - "hourly": cached, refreshed every hour
   * - "daily": cached, refreshed once per day
   */
  readonly dataFreshness: "realtime" | "hourly" | "daily";
}
