"use client";

import { useCallback, useEffect, useState } from "react";
import { LineupColumn, authHeaders, type PoolPlayer, type RosterPlayer } from "@/app/scorekeeper/lineup-column";

type UpcomingGame = {
  id: string;
  date: string;
  time: string | null;
  opponent: string;
  home: boolean;
  status: "scheduled" | "live" | "final";
};

type SheetData = {
  game: { homeTeamId: string; awayTeamId: string };
  roster: { home: RosterPlayer[]; away: RosterPlayer[] };
  playerPool: PoolPlayer[];
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function LineupManager({
  teamId,
  teamName,
  teamCode,
  games,
}: {
  teamId: string;
  teamName: string;
  teamCode: string;
  games: UpcomingGame[];
}) {
  const [gameId, setGameId] = useState(games[0]?.id ?? null);
  const [data, setData] = useState<SheetData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gameId) return;
    try {
      const res = await fetch(`/api/scorekeeper/game/${gameId}`, { cache: "no-store", headers: authHeaders(null, teamCode) });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Couldn't load the sheet");
        return;
      }
      setData(json);
      setError(null);
    } catch {
      setError("Couldn't reach the server.");
    }
  }, [gameId, teamCode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    load();
  }, [load]);

  const act = async (body: unknown) => {
    if (!gameId) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scorekeeper/game/${gameId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(null, teamCode) },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "That didn't work");
        return false;
      }
      await load();
      return true;
    } catch {
      setError("Couldn't reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const side = data ? (data.game.homeTeamId === teamId ? "home" : "away") : null;
  const roster = data && side ? data.roster[side] : [];
  const pool = data
    ? data.playerPool.filter((p) => !data.roster.home.some((r) => r.id === p.id) && !data.roster.away.some((r) => r.id === p.id))
    : [];
  const current = games.find((g) => g.id === gameId) ?? null;

  return (
    <section className="space-y-6 pb-16">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Lineup</p>
        <h1 className="mt-2 text-3xl font-semibold text-neutral-900">{teamName}</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Tap who&rsquo;s playing before puck drop. The scorekeeper starts from this sheet and can still change it at the rink.
        </p>
      </div>

      {games.length === 0 ? (
        <div className="glass-card rounded-3xl p-8 text-center text-sm text-neutral-500">No upcoming games.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {games.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGameId(g.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                g.id === gameId
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-black/10 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {formatDate(g.date)} · {g.home ? "vs" : "at"} {g.opponent}
              {g.status === "live" ? " · Live" : ""}
            </button>
          ))}
        </div>
      )}

      {current ? (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          {formatDate(current.date)}
          {current.time ? ` · ${current.time}` : ""}
        </p>
      ) : null}

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

      {gameId && !data && !error ? (
        <div className="glass-card rounded-3xl p-10 text-center text-sm text-neutral-500">Loading…</div>
      ) : null}

      {data && side ? (
        <LineupColumn
          teamName={teamName}
          roster={roster}
          pool={pool}
          busy={busy}
          onToggle={(playerId, dressed) => act({ action: "toggle-player", teamId, playerId, dressed })}
          onAddNew={(name) => act({ action: "add-new-player", teamId, name })}
        />
      ) : null}
    </section>
  );
}
