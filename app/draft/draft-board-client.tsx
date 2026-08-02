"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildDraftGrid, draftOrderOnClock, goalieCountsByTeam, roundAndSlot, sortByRankThenName } from "@/lib/draft-logic";
import type { Team } from "@/lib/draft-types";
import { FormatBadge, PausedBadge, PollingPill, PositionBadge, RankBadge, ReconnectingPill, StatusBadge, TeamRosterCard } from "./draft-ui";
import { useLiveDraft } from "./use-live-draft";

const STALE_CONNECTION_MS = 20000;

export function DraftBoardClient() {
  const { draft, teams, players, picks, loading, error, stale, connected, lastUpdated } = useLiveDraft();

  // Ticks every 5s so the "last event/poll > 20s old" connection check
  // recomputes even when nothing else re-renders the component.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const connectionStale = !connected || (lastUpdated !== null && now - lastUpdated > STALE_CONNECTION_MS);

  const orderedTeams = useMemo(
    () => teams.filter((t) => t.draft_order !== null).sort((a, b) => (a.draft_order ?? 0) - (b.draft_order ?? 0)),
    [teams],
  );

  const teamCount = orderedTeams.length;

  const playerNameById = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);
  const positionById = useMemo(() => new Map(players.map((p) => [p.id, p.position])), [players]);
  const goalieCounts = useMemo(() => goalieCountsByTeam(picks, positionById), [picks, positionById]);
  const pickByNumber = useMemo(() => new Map(picks.map((p) => [p.pick_number, p])), [picks]);
  const teamByDraftOrder = useMemo(() => new Map(orderedTeams.map((t) => [t.draft_order as number, t])), [orderedTeams]);
  const draftedPlayerIds = useMemo(() => new Set(picks.map((p) => p.player_id)), [picks]);

  const availablePlayers = useMemo(
    () => sortByRankThenName(players.filter((p) => !draftedPlayerIds.has(p.id))),
    [players, draftedPlayerIds],
  );

  const grid = useMemo(() => {
    if (!draft || teamCount === 0) return [];
    return buildDraftGrid(draft.total_rounds, teamCount, draft.format);
  }, [draft, teamCount]);

  const rounds = useMemo(() => {
    if (grid.length === 0) return [];
    const count = grid[grid.length - 1].round;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [grid]);

  if (loading) {
    return (
      <div className="glass-card rounded-3xl p-10 text-center text-sm text-neutral-500">Loading draft…</div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-3xl p-10 text-center text-sm font-medium text-rose-600">{error}</div>
    );
  }

  if (!draft || draft.status === "setup") {
    return (
      <div className="glass-card rounded-3xl px-8 py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Draft night</p>
        <h1 className="mt-3 text-3xl font-semibold text-neutral-900">Wednesday, August 26 · 8 PM</h1>
        <p className="mt-3 text-sm text-neutral-500">Mr. Joe&apos;s, Southfield — free beer and pizza.</p>
        <p className="mt-2 text-xs text-neutral-400">5 teams · 12 rounds · rosters of 11 skaters plus a goalie</p>
      </div>
    );
  }

  if (draft.status === "complete") {
    return (
      <section className="space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Live Draft</p>
          <h1 className="mt-2 text-4xl font-semibold text-neutral-900">{draft.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusBadge status={draft.status} />
            <FormatBadge format={draft.format} />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Final rosters</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orderedTeams.map((team) => (
              <TeamRosterCard
                key={team.id}
                team={team}
                picks={picks}
                playerNameById={playerNameById}
                goalieCount={goalieCounts.get(team.id) ?? 0}
                pastRound8={true}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // live or paused
  const { round: currentRound } = teamCount > 0 ? roundAndSlot(draft.current_pick, teamCount) : { round: 1 };
  const onClockOrder = teamCount > 0 ? draftOrderOnClock(draft.current_pick, teamCount, draft.format) : null;
  const onClockTeam: Team | undefined = onClockOrder ? teamByDraftOrder.get(onClockOrder) : undefined;
  const pastRound8 = currentRound > 8;

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Live Draft</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-semibold text-neutral-900">{draft.name}</h1>
          {draft.status === "paused" ? <PausedBadge /> : null}
        </div>
        {stale ? (
          <div className="mt-3">
            <ReconnectingPill />
          </div>
        ) : connectionStale ? (
          <div className="mt-3">
            <PollingPill />
          </div>
        ) : null}
      </div>

      <div className="glass-card rounded-3xl p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={draft.status} />
          <FormatBadge format={draft.format} />
          <span className="text-xs text-neutral-500">
            Round {currentRound} of {draft.total_rounds} · Pick #{draft.current_pick}
          </span>
        </div>
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            {draft.status === "paused" ? "On the clock (paused)" : "On the clock"}
          </p>
          <p className="mt-1 text-3xl font-semibold text-neutral-900">{onClockTeam?.name ?? "—"}</p>
        </div>
      </div>

      {/* Mobile: chronological pick list */}
      <div className="glass-card overflow-hidden rounded-3xl md:hidden">
        <div className="border-b border-black/5 bg-neutral-50/90 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Picks
        </div>
        <div className="divide-y divide-black/5">
          {picks.length === 0 ? (
            <p className="px-4 py-4 text-sm text-neutral-500">No picks yet.</p>
          ) : (
            [...picks]
              .sort((a, b) => b.pick_number - a.pick_number)
              .map((pick) => {
                const team = teams.find((t) => t.id === pick.team_id);
                return (
                  <div key={pick.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <Link
                        href={`/players/${pick.player_id}`}
                        className="block truncate font-medium text-neutral-900 transition hover:underline hover:underline-offset-4"
                      >
                        {playerNameById.get(pick.player_id) ?? "—"}
                      </Link>
                      <p className="text-xs text-neutral-500">{team?.name ?? "—"}</p>
                    </div>
                    <p className="shrink-0 text-xs text-neutral-400">R{pick.round} · #{pick.pick_number}</p>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Desktop: round x team grid */}
      <div className="glass-card hidden overflow-x-auto rounded-3xl md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Round</th>
              {orderedTeams.map((team) => (
                <th key={team.id} className="px-4 py-3">
                  {team.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((round) => (
              <tr key={round} className="border-t border-black/5 text-neutral-700">
                <td className="px-4 py-3 font-semibold text-neutral-900">{round}</td>
                {orderedTeams.map((team) => {
                  const cell = grid.find((c) => c.round === round && c.draftOrder === team.draft_order);
                  const pick = cell ? pickByNumber.get(cell.pickNumber) : undefined;
                  const isOnClock =
                    cell?.pickNumber === draft.current_pick &&
                    (draft.status === "live" || draft.status === "paused");
                  return (
                    <td
                      key={team.id}
                      className={`px-4 py-3 ${isOnClock ? "bg-blue-50 font-semibold text-blue-900" : ""}`}
                    >
                      {pick ? (
                        <Link
                          href={`/players/${pick.player_id}`}
                          className="transition hover:underline hover:underline-offset-4"
                        >
                          {playerNameById.get(pick.player_id) ?? "—"}
                        </Link>
                      ) : isOnClock ? (
                        "On the clock"
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Available players</h2>
          <div className="glass-card mt-4 max-h-[480px] overflow-y-auto rounded-3xl p-4">
            {availablePlayers.length === 0 ? (
              <p className="text-sm text-neutral-500">All players drafted.</p>
            ) : (
              <ul className="space-y-1.5">
                {availablePlayers.map((player) => (
                  <li key={player.id} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm text-neutral-700">
                    <Link
                      href={`/players/${player.id}`}
                      className="truncate transition hover:text-neutral-900 hover:underline hover:underline-offset-4"
                    >
                      {player.name}
                    </Link>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <RankBadge rank={player.rank} />
                      <PositionBadge position={player.position} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Rosters</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {orderedTeams.map((team) => (
              <TeamRosterCard
                key={team.id}
                team={team}
                picks={picks}
                playerNameById={playerNameById}
                goalieCount={goalieCounts.get(team.id) ?? 0}
                pastRound8={pastRound8}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
