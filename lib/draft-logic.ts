// Pure draft math — mirrors the SQL in team_on_clock()/make_pick() exactly.
// Keep this file free of I/O so it stays unit-testable.

import type { DraftFormat } from "./draft-types";

export type RoundSlot = { round: number; slot: number };

/** Rank asc (nulls last), then name asc — the standard ordering for any player pool/available list. */
export function sortByRankThenName<T extends { rank: number | null; name: string }>(players: T[]): T[] {
  return [...players].sort((a, b) => {
    if (a.rank === null && b.rank === null) return a.name.localeCompare(b.name);
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank || a.name.localeCompare(b.name);
  });
}

/** 1-indexed pick number -> { round, slot } within that round, both 1-indexed. */
export function roundAndSlot(pickNumber: number, teamCount: number): RoundSlot {
  if (teamCount <= 0) throw new Error("teamCount must be positive");
  if (pickNumber < 1) throw new Error("pickNumber must be >= 1");
  const zeroBased = pickNumber - 1;
  return {
    round: Math.floor(zeroBased / teamCount) + 1,
    slot: (zeroBased % teamCount) + 1,
  };
}

/** draft_order (1-indexed) of the team on the clock for a given pick number. */
export function draftOrderOnClock(pickNumber: number, teamCount: number, format: DraftFormat): number {
  const { round, slot } = roundAndSlot(pickNumber, teamCount);
  if (format === "snake" && round % 2 === 0) {
    return teamCount - slot + 1;
  }
  return slot;
}

export function isDraftComplete(currentPick: number, totalRounds: number, teamCount: number): boolean {
  return currentPick > totalRounds * teamCount;
}

export type GridCell = { round: number; pickNumber: number; draftOrder: number };

/** Full round x team grid for board rendering: one cell per (round, slot). */
export function buildDraftGrid(totalRounds: number, teamCount: number, format: DraftFormat): GridCell[] {
  const grid: GridCell[] = [];
  for (let round = 1; round <= totalRounds; round++) {
    for (let slot = 1; slot <= teamCount; slot++) {
      const pickNumber = (round - 1) * teamCount + slot;
      const draftOrder = format === "snake" && round % 2 === 0 ? teamCount - slot + 1 : slot;
      grid.push({ round, pickNumber, draftOrder });
    }
  }
  return grid;
}
