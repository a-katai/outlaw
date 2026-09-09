"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PositionBadge, RankBadge } from "@/app/draft/draft-ui";
import { getTeamColors } from "@/lib/league-data";
import type { PlayerPoolRow } from "@/lib/players";

function TeamPill({ name }: { name: string }) {
  const colors = getTeamColors(name);
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
    >
      {name}
    </span>
  );
}

export function PlayersSearch({ players }: { players: PlayerPoolRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = q ? players.filter((p) => p.name.toLowerCase().includes(q)) : players;
    return pool.filter((p) => !p.isSub);
  }, [players, search]);

  const subs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => p.isSub && (!q || p.name.toLowerCase().includes(q)));
  }, [players, search]);

  return (
    <div>
      <input
        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500/30 transition focus:ring-4 sm:w-72"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search players"
        type="search"
      />

      <div className="glass-card mt-4 divide-y divide-black/5 overflow-hidden rounded-3xl">
        {filtered.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">No players match.</p>
        ) : (
          filtered.map((player) => (
            <Link
              key={player.id}
              href={`/players/${player.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-neutral-50/80"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-neutral-900">{player.name}</span>
                <RankBadge rank={player.rank} />
                <PositionBadge position={player.position} />
              </div>
              {player.teamName ? (
                <TeamPill name={player.teamName} />
              ) : (
                <span className="shrink-0 text-xs font-medium text-neutral-400">Awaiting draft</span>
              )}
            </Link>
          ))
        )}
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        Showing {filtered.length} of {players.length - subs.length} players
      </p>

      {subs.length ? (
        <div className="mt-10">
          <h2 className="text-2xl font-semibold text-neutral-900">Subs</h2>
          <p className="mt-1 text-sm text-neutral-500">Not drafted. Dress for any team that needs a body.</p>
          <div className="glass-card mt-4 divide-y divide-black/5 overflow-hidden rounded-3xl">
            {subs.map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-neutral-50/80"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-neutral-900">{player.name}</span>
                  <PositionBadge position={player.position} />
                </div>
                <span className="shrink-0 rounded-full border border-black/10 px-2.5 py-1 text-xs font-semibold text-neutral-500">Sub</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
