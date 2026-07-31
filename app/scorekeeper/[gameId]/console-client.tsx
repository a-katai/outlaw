"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getTeamColors } from "@/lib/league-data";

const POLL_MS = 10000;

type RosterPlayer = { id: string; name: string; dressed: boolean };
type PoolPlayer = { id: string; name: string };

type GoalEvent = {
  id: string;
  teamId: string;
  scorerId: string | null;
  scorerName: string | null;
  assistId: string | null;
  assistName: string | null;
  createdAt: string;
};

type ConsoleGame = {
  id: string;
  date: string;
  time: string | null;
  status: "scheduled" | "live" | "final";
  gameType: "regular" | "playoff";
  note: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
};

type ConsoleData = {
  game: ConsoleGame;
  roster: { home: RosterPlayer[]; away: RosterPlayer[] };
  playerPool: PoolPlayer[];
  goalEvents: GoalEvent[];
};

async function postAction(gameId: string, body: unknown) {
  const res = await fetch(`/api/scorekeeper/game/${gameId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok: boolean; error?: string };
}

function TeamPill({ name }: { name: string }) {
  const colors = getTeamColors(name);
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-semibold"
      style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
    >
      {name}
    </span>
  );
}

export function ConsoleClient({ gameId }: { gameId: string }) {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerTeam, setPickerTeam] = useState<"home" | "away" | null>(null);
  const [scorerId, setScorerId] = useState("");
  const [assistId, setAssistId] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/scorekeeper/game/${gameId}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Couldn't load this game");
        return;
      }
      setData(json);
      setError(null);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    // Mount + 10s poll data fetch — same shape as useLiveDraft's fetchAll.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const runAction = async (body: unknown) => {
    setBusy(true);
    setActionError(null);
    const result = await postAction(gameId, body);
    setBusy(false);
    if (!result.ok) {
      setActionError(result.error ?? "That didn't work");
      return false;
    }
    await load();
    return true;
  };

  const startGame = () => runAction({ action: "start" });

  const openPicker = (team: "home" | "away") => {
    setPickerTeam(team);
    setScorerId("");
    setAssistId("");
    setActionError(null);
  };

  const closePicker = () => {
    setPickerTeam(null);
    setScorerId("");
    setAssistId("");
  };

  const confirmGoal = async () => {
    if (!pickerTeam || !data) return;
    const teamId = pickerTeam === "home" ? data.game.homeTeamId : data.game.awayTeamId;
    const ok = await runAction({ action: "add-goal", teamId, scorerId: scorerId || null, assistId: assistId || null });
    if (ok) closePicker();
  };

  const removeGoal = (eventId: string) => runAction({ action: "remove-goal", eventId });

  const endGame = async () => {
    const ok = await runAction({ action: "end" });
    if (ok) setConfirmEnd(false);
  };

  const reopenGame = () => runAction({ action: "reopen" });

  if (loading) {
    return <div className="glass-card rounded-3xl p-10 text-center text-sm text-neutral-500">Loading…</div>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <div className="glass-card rounded-3xl p-10 text-center text-sm font-medium text-rose-600">
          {error ?? "Game not found."}
        </div>
        <Link href="/scorekeeper" className="text-sm font-medium text-neutral-600 underline underline-offset-4 hover:text-neutral-900">
          ← Back to games
        </Link>
      </div>
    );
  }

  const { game, roster, playerPool, goalEvents } = data;
  const rosterFor = (team: "home" | "away") => (team === "home" ? roster.home : roster.away);
  const dressedCount = (list: RosterPlayer[]) => list.filter((p) => p.dressed).length;
  const availablePool = playerPool.filter(
    (p) => !roster.home.some((r) => r.id === p.id) && !roster.away.some((r) => r.id === p.id),
  );

  const rosterOptions = (list: RosterPlayer[]) => {
    const dressed = list.filter((p) => p.dressed);
    const rest = list.filter((p) => !p.dressed);
    return (
      <>
        {dressed.length ? (
          <optgroup label="On the ice">
            {dressed.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        ) : null}
        {rest.length ? (
          <optgroup label="Rest of roster">
            {rest.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        ) : null}
      </>
    );
  };

  return (
    <section className="space-y-6 pb-16">
      <Link href="/scorekeeper" className="text-xs font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-900">
        ← Games
      </Link>

      <div className="glass-card rounded-3xl p-6 text-center">
        <div className="flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <TeamPill name={game.awayTeam} />
            <span className="text-[11px] font-medium text-neutral-500">{dressedCount(roster.away)} dressed</span>
          </div>
          <span className="text-neutral-400">at</span>
          <div className="flex flex-col items-center gap-1">
            <TeamPill name={game.homeTeam} />
            <span className="text-[11px] font-medium text-neutral-500">{dressedCount(roster.home)} dressed</span>
          </div>
        </div>
        <p className="mt-4 text-6xl font-semibold text-neutral-900">
          {game.awayScore ?? 0}<span className="mx-2 text-neutral-300">–</span>{game.homeScore ?? 0}
        </p>
        <span
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            game.status === "live"
              ? "bg-rose-100 text-rose-700"
              : game.status === "final"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {game.status}
        </span>
      </div>

      {actionError ? <p className="text-center text-sm font-medium text-rose-600">{actionError}</p> : null}

      {game.status === "scheduled" || game.status === "live" ? (
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Lineups</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <LineupColumn
              teamName={game.awayTeam}
              roster={roster.away}
              pool={availablePool}
              busy={busy}
              onToggle={(playerId, dressed) => runAction({ action: "toggle-player", teamId: game.awayTeamId, playerId, dressed })}
            />
            <LineupColumn
              teamName={game.homeTeam}
              roster={roster.home}
              pool={availablePool}
              busy={busy}
              onToggle={(playerId, dressed) => runAction({ action: "toggle-player", teamId: game.homeTeamId, playerId, dressed })}
            />
          </div>
        </div>
      ) : null}

      {game.status === "scheduled" ? (
        <button
          type="button"
          disabled={busy}
          onClick={startGame}
          className="w-full rounded-2xl bg-neutral-900 px-4 py-5 text-lg font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {busy ? "Starting…" : "Start game"}
        </button>
      ) : null}

      {game.status === "live" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => openPicker("away")}
              className="rounded-2xl bg-neutral-900 px-3 py-5 text-base font-semibold text-white transition hover:bg-black disabled:opacity-50"
            >
              + Goal {game.awayTeam}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => openPicker("home")}
              className="rounded-2xl bg-neutral-900 px-3 py-5 text-base font-semibold text-white transition hover:bg-black disabled:opacity-50"
            >
              + Goal {game.homeTeam}
            </button>
          </div>

          {pickerTeam ? (
            <div className="glass-card space-y-3 rounded-3xl p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Goal — {pickerTeam === "home" ? game.homeTeam : game.awayTeam}
              </p>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-neutral-700">Scorer</span>
                <select
                  value={scorerId}
                  onChange={(e) => setScorerId(e.target.value)}
                  className="rounded-xl border border-black/10 bg-white px-3 py-3 text-base outline-none ring-blue-500/30 focus:ring-4"
                >
                  <option value="">Unknown / other</option>
                  {rosterOptions(rosterFor(pickerTeam))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-neutral-700">Assist (optional)</span>
                <select
                  value={assistId}
                  onChange={(e) => setAssistId(e.target.value)}
                  className="rounded-xl border border-black/10 bg-white px-3 py-3 text-base outline-none ring-blue-500/30 focus:ring-4"
                >
                  <option value="">None</option>
                  {rosterOptions(rosterFor(pickerTeam))}
                </select>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={confirmGoal}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? "Logging…" : "Confirm goal"}
                </button>
                <button
                  type="button"
                  onClick={closePicker}
                  className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {confirmEnd ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={endGame}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm end game
              </button>
              <button
                type="button"
                onClick={() => setConfirmEnd(false)}
                className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              End game
            </button>
          )}
        </div>
      ) : null}

      {game.status === "final" ? (
        <button
          type="button"
          disabled={busy}
          onClick={reopenGame}
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
        >
          {busy ? "Reopening…" : "Reopen game"}
        </button>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Goals</h2>
        {goalEvents.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No goals logged yet.</p>
        ) : (
          <div className="glass-card mt-3 divide-y divide-black/5 overflow-hidden rounded-3xl">
            {[...goalEvents]
              .reverse()
              .map((g) => {
                const ordinal = goalEvents.findIndex((e) => e.id === g.id) + 1;
                const teamName = g.teamId === game.homeTeamId ? game.homeTeam : game.awayTeam;
                return (
                  <div key={g.id} className="flex items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        Goal #{ordinal} — {teamName}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {g.scorerName ?? "Unknown"}
                        {g.assistName ? ` (${g.assistName})` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeGoal(g.id)}
                      className="shrink-0 text-xs font-medium text-neutral-500 hover:text-rose-600 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </section>
  );
}

function LineupColumn({
  teamName,
  roster,
  pool,
  busy,
  onToggle,
}: {
  teamName: string;
  roster: RosterPlayer[];
  pool: PoolPlayer[];
  busy: boolean;
  onToggle: (playerId: string, dressed: boolean) => void;
}) {
  const [addId, setAddId] = useState("");
  const dressed = roster.filter((p) => p.dressed).length;

  return (
    <div className="glass-card rounded-3xl p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {teamName} · {dressed} dressed
      </p>
      <div className="mt-3 space-y-1.5">
        {roster.length === 0 ? (
          <p className="text-sm text-neutral-500">No roster yet.</p>
        ) : (
          roster.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={busy}
              onClick={() => onToggle(p.id, !p.dressed)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:opacity-50 ${
                p.dressed
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-black/10 bg-white text-neutral-600"
              }`}
            >
              <span>{p.name}</span>
              <span className="text-xs font-semibold">{p.dressed ? "Dressed" : "Tap to dress"}</span>
            </button>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <select
          value={addId}
          onChange={(e) => setAddId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-2 py-2 text-sm outline-none ring-blue-500/30 focus:ring-4"
        >
          <option value="">Add player…</option>
          {pool.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!addId || busy}
          onClick={() => {
            onToggle(addId, true);
            setAddId("");
          }}
          className="shrink-0 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
