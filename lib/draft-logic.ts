// Pure draft math — mirrors the SQL in team_on_clock()/make_pick() exactly.
// Keep this file free of I/O so it stays unit-testable.

import type { DraftFormat, DraftPick, PlayerPosition } from "./draft-types";

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

/**
 * Picks remaining until the team at `teamOrder` (1-indexed draft_order) is
 * next on the clock, counting from `currentPick` (0 if that team is on the
 * clock right now). Returns null once the draft has no picks left at or
 * after `currentPick`.
 */
export function picksUntilTurn(
  currentPick: number,
  teamOrder: number,
  teamCount: number,
  format: DraftFormat,
  totalRounds: number,
): number | null {
  const lastPick = totalRounds * teamCount;
  if (currentPick > lastPick) return null;
  for (let pick = currentPick; pick <= lastPick; pick++) {
    if (draftOrderOnClock(pick, teamCount, format) === teamOrder) {
      return pick - currentPick;
    }
  }
  return null;
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

// --- Goalie awareness (no hard block — league rule unknown, UI hints only) ---

/** How many of a team's picks are a given position, given a player-id -> position lookup. */
export function countPositionForTeam(
  picks: Pick<DraftPick, "team_id" | "player_id">[],
  teamId: string,
  positionById: Map<string, PlayerPosition | null>,
  position: PlayerPosition,
): number {
  let count = 0;
  for (const pick of picks) {
    if (pick.team_id === teamId && positionById.get(pick.player_id) === position) count++;
  }
  return count;
}

/** Map of teamId -> goalie ("G") count, for every team that has picked at least one. */
export function goalieCountsByTeam(
  picks: Pick<DraftPick, "team_id" | "player_id">[],
  positionById: Map<string, PlayerPosition | null>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const pick of picks) {
    if (positionById.get(pick.player_id) !== "G") continue;
    counts.set(pick.team_id, (counts.get(pick.team_id) ?? 0) + 1);
  }
  return counts;
}
