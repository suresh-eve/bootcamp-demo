/**
 * MockDataAdapter — B1 & B3 Interim Workaround
 *
 * Serves pre-generated fixtures from mock-members.ts while the real
 * Learner Profile API (B1) and FTU Onboarding API (B3) are being finalised.
 *
 * This adapter is used by default in development and tests.
 * Switch to RealDataAdapter in production once blockers are resolved.
 */

import type { DataAdapter } from "./DataAdapter.interface";
import type { RawMemberData, FtuGoalData } from "../../types/index";
import { MOCK_MEMBERS } from "../mock-members";

export class MockDataAdapter implements DataAdapter {
  readonly adapterName = "MockDataAdapter";
  readonly dataFreshness = "daily" as const;

  private readonly memberIndex: Map<string, RawMemberData>;

  constructor() {
    this.memberIndex = new Map(MOCK_MEMBERS.map((m) => [m.member_id, m]));
  }

  async getMemberData(memberId: string): Promise<RawMemberData | null> {
    return this.memberIndex.get(memberId) ?? null;
  }

  async getBatchMemberData(memberIds: string[]): Promise<Map<string, RawMemberData>> {
    const result = new Map<string, RawMemberData>();
    for (const id of memberIds) {
      const member = this.memberIndex.get(id);
      if (member) {
        result.set(id, member);
      }
    }
    return result;
  }

  /**
   * B3 Workaround: FTU goal data is synthesised from the member's
   * intent.goal_declarations field. When the real Onboarding API is
   * available, RealDataAdapter.getFtuGoalData() should call it directly.
   */
  async getFtuGoalData(memberId: string): Promise<FtuGoalData | null> {
    const member = this.memberIndex.get(memberId);
    if (!member) return null;

    const ftuGoals = member.intent.goal_declarations.filter(
      (g) => g.source === "ftu"
    );

    return {
      member_id: memberId,
      goals: ftuGoals.length > 0 ? ftuGoals : member.intent.goal_declarations,
      onboarding_completed: member.intent.goal_declarations.length > 0,
      onboarding_completed_at:
        member.intent.goal_declarations.length > 0
          ? member.intent.goal_declarations[
              member.intent.goal_declarations.length - 1
            ].declared_at
          : null,
    };
  }

  async healthCheck(): Promise<boolean> {
    return this.memberIndex.size > 0;
  }

  /** Returns all member IDs in the mock dataset */
  getAllMemberIds(): string[] {
    return Array.from(this.memberIndex.keys());
  }

  /** Returns total number of mock members loaded */
  get size(): number {
    return this.memberIndex.size;
  }
}
