/**
 * Eve Trainer — Notification Fatigue Guard (Sprint 6)
 *
 * Enforces the "1 nudge per member per 24h" rule across all channels
 * (push, in-app, fallback). Once a nudge is recorded for a member, all
 * subsequent delivery attempts within a 24-hour window are blocked.
 *
 * Provides:
 * 1. canSendNudge(memberId)  — true if no nudge was sent in the last 24h
 * 2. recordNudge(memberId)   — records a nudge timestamp for a member
 * 3. resetGuard(memberId)    — removes a member's guard state (for test cleanup)
 * 4. clearAll()              — clears the entire store (for test isolation)
 *
 * Design decisions:
 * - In-memory Map store — no database required
 * - Singleton export ensures the same store is shared across all callers
 * - 24h window is measured from the last_nudge_at timestamp
 * - The guard is channel-agnostic: push + in-app + fallback all count
 */

import type { FatigueGuardState } from "../types/braze";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum gap between nudges in milliseconds (24 hours) */
const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ─── FatigueGuard ─────────────────────────────────────────────────────────────

export class FatigueGuard {
  /** In-memory store: member_id → FatigueGuardState */
  private store: Map<string, FatigueGuardState> = new Map();

  /**
   * Check whether a nudge can be sent to a member right now.
   *
   * Returns true if:
   *   - The member has never received a nudge, OR
   *   - The last nudge was sent more than 24 hours ago
   *
   * Returns false if a nudge was already sent within the last 24 hours.
   *
   * @param memberId - Mindvalley member ID
   */
  canSendNudge(memberId: string): boolean {
    const state = this.store.get(memberId);
    if (!state) return true;

    const elapsed = Date.now() - new Date(state.last_nudge_at).getTime();
    return elapsed >= NUDGE_COOLDOWN_MS;
  }

  /**
   * Record that a nudge was sent to a member right now.
   *
   * Updates the member's last_nudge_at to the current timestamp and
   * increments nudge_count_24h. If no record exists, creates one.
   *
   * @param memberId - Mindvalley member ID
   */
  recordNudge(memberId: string): void {
    const existing = this.store.get(memberId);
    const now = new Date().toISOString();

    if (!existing) {
      this.store.set(memberId, {
        member_id: memberId,
        last_nudge_at: now,
        nudge_count_24h: 1,
      });
      return;
    }

    // Check if we're still within the 24h window to increment the counter
    const elapsed = Date.now() - new Date(existing.last_nudge_at).getTime();
    const nudge_count_24h = elapsed < NUDGE_COOLDOWN_MS ? existing.nudge_count_24h + 1 : 1;

    this.store.set(memberId, {
      member_id: memberId,
      last_nudge_at: now,
      nudge_count_24h,
    });
  }

  /**
   * Reset the fatigue guard state for a specific member.
   *
   * Removes the member's record entirely from the store.
   * Used for test cleanup and for manually clearing a member's block.
   *
   * @param memberId - Mindvalley member ID
   */
  resetGuard(memberId: string): void {
    this.store.delete(memberId);
  }

  /**
   * Clear all fatigue guard state.
   *
   * Wipes the entire in-memory store.
   * Used for test isolation — call this in beforeEach/afterEach.
   */
  clearAll(): void {
    this.store.clear();
  }

  /**
   * Get the current guard state for a member (for inspection/testing).
   *
   * Returns undefined if no record exists for the member.
   *
   * @param memberId - Mindvalley member ID
   */
  getState(memberId: string): FatigueGuardState | undefined {
    return this.store.get(memberId);
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * Singleton FatigueGuard instance.
 *
 * Import this instance directly — shared across all services.
 * Call clearAll() in tests for isolation.
 */
export const fatigueGuard = new FatigueGuard();
