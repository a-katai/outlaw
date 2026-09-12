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

type RosterEntry = { id: string; name: string; position: string | null; jersey: number | null };
type SubEntry = { key: string; name: string; paid: boolean; gamesCovered: number };

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
  roster: fullRoster,
  subs,
}: {
  teamId: string;
  teamName: string;
  teamCode: string;
  games: UpcomingGame[];
  roster: RosterEntry[];
  subs: SubEntry[];
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Manager</p>
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

      <div className="grid gap-6 pt-4 md:grid-cols-2">
        <RosterCard teamName={teamName} roster={fullRoster} />
        <SubsCard subs={subs} />
      </div>
    </section>
  );
}

/** The drafted roster — goalie last, then by jersey, then A–Z. */
function RosterCard({ teamName, roster }: { teamName: string; roster: RosterEntry[] }) {
  const sorted = [...roster].sort((a, b) => {
    const ag = a.position === "G" ? 1 : 0;
    const bg = b.position === "G" ? 1 : 0;
    if (ag !== bg) return ag - bg;
    if (a.jersey != null && b.jersey != null) return a.jersey - b.jersey;
    if (a.jersey != null) return -1;
    if (b.jersey != null) return 1;
    return a.name.localeCompare(b.name);
  });
  return (
    <div className="glass-card rounded-3xl p-6 md:p-8">
      <h2 className="text-xl font-semibold text-neutral-900">Roster</h2>
      <p className="mt-1 text-sm text-neutral-500">
        {teamName} · {roster.length} {roster.length === 1 ? "player" : "players"}
      </p>
      <ul className="mt-5 divide-y divide-black/[0.07]">
        {sorted.map((p) => (
          <li key={p.id} className="flex items-baseline justify-between gap-4 py-2.5">
            <span className="flex items-baseline gap-3">
              <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-neutral-400">{p.jersey != null ? `#${p.jersey}` : ""}</span>
              <span className="font-medium text-neutral-900">{p.name}</span>
            </span>
            {p.position ? <span className="shrink-0 text-xs font-semibold text-neutral-400">{p.position}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The sub line — paid subs first, in the order they paid. Call from the top. */
function SubsCard({ subs }: { subs: SubEntry[] }) {
  const paid = subs.filter((s) => s.paid);
  const waiting = subs.filter((s) => !s.paid);
  return (
    <div className="glass-card rounded-3xl p-6 md:p-8">
      <h2 className="text-xl font-semibold text-neutral-900">Subs</h2>
      <p className="mt-1 text-sm text-neutral-500">Paid subs get the first call. Work down the list.</p>
      {subs.length === 0 ? (
        <p className="mt-5 text-sm text-neutral-500">No subs yet.</p>
      ) : (
        <ol className="mt-5 divide-y divide-black/[0.07]">
          {paid.map((s, i) => (
            <li key={s.key} className="flex items-baseline justify-between gap-4 py-2.5">
              <span className="flex items-baseline gap-3">
                <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-neutral-400">{i + 1}</span>
                <span className="font-medium text-neutral-900">{s.name}</span>
              </span>
              <span className="shrink-0 text-xs font-medium text-emerald-700">
                Paid · {s.gamesCovered} {s.gamesCovered === 1 ? "game" : "games"}
              </span>
            </li>
          ))}
          {waiting.map((s) => (
            <li key={s.key} className="flex items-baseline justify-between gap-4 py-2.5">
              <span className="flex items-baseline gap-3">
                <span className="w-7 shrink-0 text-xs text-neutral-300">·</span>
                <span className="text-neutral-600">{s.name}</span>
              </span>
              <span className="shrink-0 text-xs text-neutral-400">Unpaid</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
