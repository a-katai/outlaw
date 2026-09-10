"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getTeamColors } from "@/lib/league-data";

const POLL_MS = 10000;

import { LineupColumn, authHeaders, type PoolPlayer, type RosterPlayer } from "../lineup-column";

type PenaltyEvent = {
  id: string;
  teamId: string;
  playerId: string | null;
  playerName: string | null;
  infraction: string;
  minutes: number;
  period: number | null;
  createdAt: string;
};

const INFRACTIONS = [
  "Tripping",
  "Hooking",
  "Holding",
  "Slashing",
  "High-sticking",
  "Interference",
  "Cross-checking",
  "Roughing",
  "Elbowing",
  "Boarding",
  "Delay of game",
  "Too many men",
  "Unsportsmanlike conduct",
  "Misconduct",
  "Other",
];
const MINUTE_OPTIONS = [2, 4, 5, 10];

type GoalEvent = {
  id: string;
  teamId: string;
  scorerId: string | null;
  scorerName: string | null;
  assistId: string | null;
  assistName: string | null;
  assist2Id: string | null;
  assist2Name: string | null;
  period: number | null;
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
  penaltyEvents: PenaltyEvent[];
};

const PERIODS: { value: number; label: string }[] = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "OT" },
];

/** "1st" / "2nd" / "3rd" / "OT" / "—" for an unset period. */
function periodLabel(period: number | null | undefined): string {
  return PERIODS.find((p) => p.value === period)?.label ?? "—";
}

/** Last word of a full name; "Unknown" for a missing name. */
function surname(name: string | null | undefined): string {
  if (!name || !name.trim()) return "Unknown";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

/** Jersey number for a player id, looked up against a team roster. */
function jerseyOf(roster: RosterPlayer[], playerId: string | null): number | null {
  if (!playerId) return null;
  return roster.find((p) => p.id === playerId)?.jersey ?? null;
}

/** "#62 Erickson" when a jersey number is on file; the bare surname otherwise. */
function playerDisplay(roster: RosterPlayer[], playerId: string | null, name: string | null): string {
  const jersey = jerseyOf(roster, playerId);
  const sn = surname(name);
  return jersey != null ? `#${jersey} ${sn}` : sn;
}

/**
 * Sequential goal-pick toggle. `picks[0]` is the scorer (may be null = Unknown),
 * `picks[1]`/`picks[2]` are the assists (never null). Tapping a selected tile
 * removes it and shifts later roles down; Unknown may only occupy index 0.
 */
function toggleGoalPick(picks: (string | null)[], id: string | null): (string | null)[] {
  if (id === null) {
    if (picks.length === 0) return [null];
    if (picks[0] === null) return picks.slice(1);
    return picks;
  }
  const idx = picks.indexOf(id);
  if (idx !== -1) {
    const next = [...picks];
    next.splice(idx, 1);
    return next;
  }
  if (picks.length >= 3) return picks;
  return [...picks, id];
}

async function postAction(gameId: string, body: unknown, code: string | null) {
  const res = await fetch(`/api/scorekeeper/game/${gameId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(code) },
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

function PeriodChips({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (period: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(p.value)}
          className={`min-h-12 rounded-xl border text-sm font-semibold transition disabled:opacity-50 ${
            value === p.value
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-black/10 bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

type TileVariant = "idle" | "scorer" | "assist" | "selected";

const TILE_STYLES: Record<TileVariant, string> = {
  idle: "border-black/10 bg-white text-neutral-900",
  scorer: "border-neutral-900 bg-neutral-900 text-white",
  assist: "border-emerald-300 bg-emerald-50 text-emerald-900",
  selected: "border-neutral-900 bg-neutral-900 text-white",
};

const TILE_SUB: Record<TileVariant, string> = {
  idle: "text-neutral-500",
  scorer: "text-white/80",
  assist: "text-emerald-700",
  selected: "text-white/80",
};

function RosterTile({
  primary,
  secondary,
  badge,
  variant,
  disabled,
  onClick,
}: {
  primary: string;
  secondary: string;
  badge?: string;
  variant: TileVariant;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative flex min-h-[72px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-2 text-center transition disabled:opacity-50 ${TILE_STYLES[variant]}`}
    >
      {badge ? (
        <span className="absolute right-1 top-1 rounded-full border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-bold text-neutral-900">
          {badge}
        </span>
      ) : null}
      <span className="text-2xl font-semibold tabular-nums">{primary}</span>
      {secondary ? <span className={`text-[11px] ${TILE_SUB[variant]}`}>{secondary}</span> : null}
    </button>
  );
}

type GoalSheetState = { team: "home" | "away"; picks: (string | null)[]; period: number };
type PenaltySheetState = {
  team: "home" | "away";
  playerId: string | null;
  infraction: string;
  minutes: number;
  period: number;
};

export function ConsoleClient({ gameId, code = null }: { gameId: string; code?: string | null }) {
  const backHref = code ? `/scorekeeper?code=${encodeURIComponent(code)}` : "/scorekeeper";
  const [data, setData] = useState<ConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [period, setPeriod] = useState(1);
  const periodInitialized = useRef(false);
  const [lineupsOpen, setLineupsOpen] = useState(false);
  const [goalSheet, setGoalSheet] = useState<GoalSheetState | null>(null);
  const [penaltySheet, setPenaltySheet] = useState<PenaltySheetState | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/scorekeeper/game/${gameId}`, { cache: "no-store", headers: authHeaders(code) });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Couldn't load this game");
        return;
      }
      setData(json);
      setError(null);
      // First load only: pick up where the sheet left off (a reopened or resumed game).
      if (!periodInitialized.current) {
        periodInitialized.current = true;
        const all = [...(json.goalEvents as GoalEvent[]), ...(json.penaltyEvents as PenaltyEvent[])];
        const latest = all.reduce<GoalEvent | PenaltyEvent | null>(
          (a, b) => (!a || new Date(b.createdAt).getTime() > new Date(a.createdAt).getTime() ? b : a),
          null,
        );
        if (latest?.period) setPeriod(latest.period);
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, [gameId, code]);

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
    const result = await postAction(gameId, body, code);
    setBusy(false);
    if (!result.ok) {
      setActionError(result.error ?? "That didn't work");
      return false;
    }
    await load();
    return true;
  };

  const startGame = () => runAction({ action: "start" });

  const endGame = async () => {
    const ok = await runAction({ action: "end" });
    if (ok) setConfirmEnd(false);
  };

  const reopenGame = () => runAction({ action: "reopen" });

  const resetGame = async () => {
    const ok = await runAction({ action: "reset" });
    if (ok) setConfirmReset(false);
  };

  const removeGoal = (eventId: string) => runAction({ action: "remove-goal", eventId });
  const removePenalty = (eventId: string) => runAction({ action: "remove-penalty", eventId });

  const openGoalSheet = (team: "home" | "away") => {
    setGoalSheet({ team, picks: [], period });
    setPenaltySheet(null);
    setActionError(null);
  };
  const closeGoalSheet = () => setGoalSheet(null);

  const openPenaltySheet = (team: "home" | "away") => {
    setPenaltySheet({ team, playerId: null, infraction: INFRACTIONS[0], minutes: 2, period });
    setGoalSheet(null);
    setActionError(null);
  };
  const closePenaltySheet = () => setPenaltySheet(null);

  const pickGoalTile = (id: string | null) => {
    setGoalSheet((prev) => (prev ? { ...prev, picks: toggleGoalPick(prev.picks, id) } : prev));
  };

  const pickPenaltyTile = (id: string | null) => {
    setPenaltySheet((prev) => (prev ? { ...prev, playerId: prev.playerId === id ? null : id } : prev));
  };

  const saveGoal = async () => {
    if (!goalSheet || !data) return;
    const teamId = goalSheet.team === "home" ? data.game.homeTeamId : data.game.awayTeamId;
    const scorerId = goalSheet.picks.length > 0 ? goalSheet.picks[0] : null;
    const assistId = goalSheet.picks.length > 1 ? goalSheet.picks[1] : null;
    const assist2Id = goalSheet.picks.length > 2 ? goalSheet.picks[2] : null;
    const ok = await runAction({
      action: "add-goal",
      teamId,
      scorerId,
      assistId,
      assist2Id,
      period,
    });
    if (ok) setGoalSheet(null);
  };

  const savePenalty = async () => {
    if (!penaltySheet || !data) return;
    const teamId = penaltySheet.team === "home" ? data.game.homeTeamId : data.game.awayTeamId;
    const ok = await runAction({
      action: "add-penalty",
      teamId,
      playerId: penaltySheet.playerId,
      infraction: penaltySheet.infraction,
      minutes: penaltySheet.minutes,
      period,
    });
    if (ok) setPenaltySheet(null);
  };

  if (loading) {
    return <div className="glass-card rounded-3xl p-10 text-center text-sm text-neutral-500">Loading…</div>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <div className="glass-card rounded-3xl p-10 text-center text-sm font-medium text-rose-600">
          {error ?? "Game not found."}
        </div>
        <Link href={backHref} className="text-sm font-medium text-neutral-600 underline underline-offset-4 hover:text-neutral-900">
          ← Back to games
        </Link>
      </div>
    );
  }

  const { game, roster, playerPool, goalEvents, penaltyEvents } = data;
  const rosterFor = (team: "home" | "away") => (team === "home" ? roster.home : roster.away);
  const rosterForTeamId = (teamId: string) => (teamId === game.homeTeamId ? roster.home : roster.away);
  const dressedCount = (list: RosterPlayer[]) => list.filter((p) => p.dressed).length;
  const availablePool = playerPool.filter(
    (p) => !roster.home.some((r) => r.id === p.id) && !roster.away.some((r) => r.id === p.id),
  );

  // Chronological sheet: goals + penalties merged, newest first. Goal ordinals
  // are numbered by their true chronological order (ascending), independent of
  // display order.
  const goalOrdinal = new Map(
    [...goalEvents]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((g, i) => [g.id, i + 1] as const),
  );
  type SheetRow = { kind: "goal"; event: GoalEvent } | { kind: "penalty"; event: PenaltyEvent };
  const sheetRows: SheetRow[] = [
    ...goalEvents.map((event): SheetRow => ({ kind: "goal", event })),
    ...penaltyEvents.map((event): SheetRow => ({ kind: "penalty", event })),
  ].sort((a, b) => new Date(b.event.createdAt).getTime() - new Date(a.event.createdAt).getTime());

  const goalTeamName = goalSheet ? (goalSheet.team === "home" ? game.homeTeam : game.awayTeam) : "";
  const goalColors = goalSheet ? getTeamColors(goalTeamName) : null;
  const goalFullRoster = goalSheet ? rosterFor(goalSheet.team) : [];
  const goalDressed = goalFullRoster.filter((p) => p.dressed);
  const goalTiles = goalDressed.length ? goalDressed : goalFullRoster;
  const goalShowFullNote = goalDressed.length === 0 && goalFullRoster.length > 0;

  const goalPlayerPreview = (id: string | null): string => {
    if (id === null) return "Unknown";
    const p = goalFullRoster.find((x) => x.id === id);
    if (!p) return "Unknown";
    return p.jersey != null ? `#${p.jersey} ${surname(p.name)}` : surname(p.name);
  };

  const penaltyTeamName = penaltySheet ? (penaltySheet.team === "home" ? game.homeTeam : game.awayTeam) : "";
  const penaltyFullRoster = penaltySheet ? rosterFor(penaltySheet.team) : [];
  const penaltyDressed = penaltyFullRoster.filter((p) => p.dressed);
  const penaltyTiles = penaltyDressed.length ? penaltyDressed : penaltyFullRoster;
  const penaltyShowFullNote = penaltyDressed.length === 0 && penaltyFullRoster.length > 0;

  return (
    <section className="space-y-6 pb-16">
      <Link href={backHref} className="text-xs font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-900">
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
          {game.awayScore ?? 0}
          <span className="mx-2 text-neutral-300">–</span>
          {game.homeScore ?? 0}
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

      {game.status === "live" || game.status === "final" ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Period</p>
          <div className="mt-2">
            <PeriodChips value={period} onChange={setPeriod} />
          </div>
        </div>
      ) : null}

      {actionError ? <p className="text-center text-sm font-medium text-rose-600">{actionError}</p> : null}

      {game.status === "scheduled" ? (
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Lineups</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <LineupColumn
              teamName={game.awayTeam}
              roster={roster.away}
              pool={availablePool}
              busy={busy}
              onToggle={(playerId, dressed) => runAction({ action: "toggle-player", teamId: game.awayTeamId, playerId, dressed })}
              onAddNew={(name) => runAction({ action: "add-new-player", teamId: game.awayTeamId, name })}
            />
            <LineupColumn
              teamName={game.homeTeam}
              roster={roster.home}
              pool={availablePool}
              busy={busy}
              onToggle={(playerId, dressed) => runAction({ action: "toggle-player", teamId: game.homeTeamId, playerId, dressed })}
              onAddNew={(name) => runAction({ action: "add-new-player", teamId: game.homeTeamId, name })}
            />
          </div>
        </div>
      ) : null}

      {game.status === "scheduled" ? (
        <button
          type="button"
          disabled={busy}
          onClick={startGame}
          className="min-h-14 w-full rounded-2xl bg-neutral-900 px-4 py-5 text-lg font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {busy ? "Starting…" : "Start game"}
        </button>
      ) : null}

      {game.status === "live" ? (
        <div className="space-y-4">
          {!goalSheet && !penaltySheet ? (
            <div className="grid grid-cols-2 gap-3">
              {(["away", "home"] as const).map((team) => {
                const teamName = team === "home" ? game.homeTeam : game.awayTeam;
                const colors = getTeamColors(teamName);
                return (
                  <div key={team} className="space-y-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openGoalSheet(team)}
                      className="min-h-16 w-full rounded-2xl border px-3 py-3 text-base font-semibold transition disabled:opacity-50"
                      style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
                    >
                      Goal · {teamName}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openPenaltySheet(team)}
                      className="min-h-12 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Penalty
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {goalSheet && goalColors ? (
            <div
              className="glass-card space-y-4 rounded-3xl border-l-4 p-5"
              style={{ borderLeftColor: goalColors.border }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Goal — {goalTeamName}</p>
              {goalShowFullNote ? (
                <p className="text-xs font-medium text-amber-700">No lineup set — showing full roster</p>
              ) : null}
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {goalTiles.map((p) => {
                  const idx = goalSheet.picks.indexOf(p.id);
                  const variant: TileVariant = idx === 0 ? "scorer" : idx === 1 || idx === 2 ? "assist" : "idle";
                  const badge = idx === 0 ? "G" : idx === 1 ? "A1" : idx === 2 ? "A2" : undefined;
                  return (
                    <RosterTile
                      key={p.id}
                      primary={p.jersey != null ? String(p.jersey) : surname(p.name)}
                      secondary={p.jersey != null ? surname(p.name) : ""}
                      badge={badge}
                      variant={variant}
                      disabled={busy}
                      onClick={() => pickGoalTile(p.id)}
                    />
                  );
                })}
                <RosterTile
                  primary="?"
                  secondary="Unknown"
                  variant={goalSheet.picks[0] === null ? "scorer" : "idle"}
                  badge={goalSheet.picks[0] === null ? "G" : undefined}
                  disabled={busy}
                  onClick={() => pickGoalTile(null)}
                />
              </div>
              {goalSheet.picks.length === 0 ? (
                <p className="text-sm text-neutral-500">Tap a player to set the scorer.</p>
              ) : (
                <p className="text-sm text-neutral-600">
                  {goalPlayerPreview(goalSheet.picks[0])} ←{" "}
                  {goalSheet.picks.length > 1
                    ? goalSheet.picks.slice(1).map((id) => goalPlayerPreview(id)).join(", ")
                    : "unassisted"}{" "}
                  · {periodLabel(period)}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={busy || goalSheet.picks.length === 0}
                  onClick={saveGoal}
                  className="min-h-14 flex-1 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save goal"}
                </button>
                <button
                  type="button"
                  onClick={closeGoalSheet}
                  className="min-h-14 rounded-xl px-4 text-sm font-semibold text-neutral-500 transition hover:text-neutral-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {penaltySheet ? (
            <div className="glass-card space-y-4 rounded-3xl p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Penalty — {penaltyTeamName}</p>
              {penaltyShowFullNote ? (
                <p className="text-xs font-medium text-amber-700">No lineup set — showing full roster</p>
              ) : null}
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {penaltyTiles.map((p) => (
                  <RosterTile
                    key={p.id}
                    primary={p.jersey != null ? String(p.jersey) : surname(p.name)}
                    secondary={p.jersey != null ? surname(p.name) : ""}
                    variant={penaltySheet.playerId === p.id ? "selected" : "idle"}
                    disabled={busy}
                    onClick={() => pickPenaltyTile(p.id)}
                  />
                ))}
                <RosterTile
                  primary="—"
                  secondary="Bench"
                  variant={penaltySheet.playerId === null ? "selected" : "idle"}
                  disabled={busy}
                  onClick={() => pickPenaltyTile(null)}
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Infraction</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {INFRACTIONS.map((name) => (
                    <button
                      key={name}
                      type="button"
                      disabled={busy}
                      onClick={() => setPenaltySheet((prev) => (prev ? { ...prev, infraction: name } : prev))}
                      className={`min-h-12 rounded-full border px-4 text-sm font-semibold transition disabled:opacity-50 ${
                        penaltySheet.infraction === name
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-black/10 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Minutes</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MINUTE_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={busy}
                      onClick={() => setPenaltySheet((prev) => (prev ? { ...prev, minutes: m } : prev))}
                      className={`min-h-12 min-w-16 rounded-full border px-4 text-sm font-semibold transition disabled:opacity-50 ${
                        penaltySheet.minutes === m
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-black/10 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={savePenalty}
                  className="min-h-14 flex-1 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save penalty"}
                </button>
                <button
                  type="button"
                  onClick={closePenaltySheet}
                  className="min-h-14 rounded-xl px-4 text-sm font-semibold text-neutral-500 transition hover:text-neutral-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <div>
            <button
              type="button"
              onClick={() => setLineupsOpen((v) => !v)}
              className="flex min-h-12 w-full items-center justify-between rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              <span>
                Lineups · {dressedCount(roster.away)} / {dressedCount(roster.home)} dressed
              </span>
              <span>{lineupsOpen ? "▾" : "▸"}</span>
            </button>
            {lineupsOpen ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <LineupColumn
                  teamName={game.awayTeam}
                  roster={roster.away}
                  pool={availablePool}
                  busy={busy}
                  onToggle={(playerId, dressed) => runAction({ action: "toggle-player", teamId: game.awayTeamId, playerId, dressed })}
                  onAddNew={(name) => runAction({ action: "add-new-player", teamId: game.awayTeamId, name })}
                />
                <LineupColumn
                  teamName={game.homeTeam}
                  roster={roster.home}
                  pool={availablePool}
                  busy={busy}
                  onToggle={(playerId, dressed) => runAction({ action: "toggle-player", teamId: game.homeTeamId, playerId, dressed })}
                  onAddNew={(name) => runAction({ action: "add-new-player", teamId: game.homeTeamId, name })}
                />
              </div>
            ) : null}
          </div>

          {confirmEnd ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={endGame}
                className="min-h-12 flex-1 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm end game
              </button>
              <button
                type="button"
                onClick={() => setConfirmEnd(false)}
                className="min-h-12 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              className="min-h-12 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
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
          className="min-h-14 w-full rounded-2xl bg-neutral-900 px-4 text-lg font-semibold text-white transition hover:bg-black disabled:opacity-50"
        >
          {busy ? "Reopening…" : "Edit sheet"}
        </button>
      ) : null}

      {game.status === "live" || game.status === "final" ? (
        <div className="space-y-3">
          {confirmReset ? (
            <div className="glass-card space-y-3 rounded-3xl p-5">
              <p className="text-sm text-neutral-700">
                Are you sure? This puts the game back to <span className="font-semibold">scheduled</span> and erases every goal
                and penalty on the sheet. Lineups stay. There is no undo.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={resetGame}
                  className="min-h-12 flex-1 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                >
                  {busy ? "Resetting…" : "Yes, reset the game"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-12 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-12 w-full text-center text-xs font-medium text-neutral-500 underline underline-offset-4 transition hover:text-neutral-900"
            >
              Reset game
            </button>
          )}
        </div>
      ) : null}

      {game.status === "live" || game.status === "final" ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Sheet</p>
          {sheetRows.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Nothing on the sheet yet.</p>
          ) : (
            <div className="glass-card mt-3 divide-y divide-black/5 overflow-hidden rounded-3xl">
              {sheetRows.map((row) => {
                const teamName = row.event.teamId === game.homeTeamId ? game.homeTeam : game.awayTeam;
                const colors = getTeamColors(teamName);
                const teamRoster = rosterForTeamId(row.event.teamId);
                return (
                  <div key={row.event.id} className="flex items-stretch gap-3 px-4 py-3">
                    <div className="w-[3px] shrink-0 rounded-full" style={{ backgroundColor: colors.border }} />
                    <div className="min-w-0 flex-1">
                      {row.kind === "goal" ? (
                        <>
                          <p className="text-sm font-semibold text-neutral-900">
                            <span className="font-medium text-neutral-500">{teamName} · {periodLabel(row.event.period)} · </span>
                            {playerDisplay(teamRoster, row.event.scorerId, row.event.scorerName)}{" "}
                            <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">
                              G{goalOrdinal.get(row.event.id)}
                            </span>
                          </p>
                          <p className="text-sm text-neutral-500">
                            {row.event.assistId || row.event.assistName
                              ? `← ${playerDisplay(teamRoster, row.event.assistId, row.event.assistName)}${
                                  row.event.assist2Id || row.event.assist2Name
                                    ? `, ${playerDisplay(teamRoster, row.event.assist2Id, row.event.assist2Name)}`
                                    : ""
                                }`
                              : "unassisted"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-neutral-900">
                            <span className="font-medium text-neutral-500">{teamName} · {periodLabel(row.event.period)} · </span>
                            {playerDisplay(teamRoster, row.event.playerId, row.event.playerName)}{" "}
                            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">PEN</span>
                          </p>
                          <p className="text-sm text-neutral-500">
                            {row.event.infraction} · {row.event.minutes} min
                          </p>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => (row.kind === "goal" ? removeGoal(row.event.id) : removePenalty(row.event.id))}
                      className="min-h-11 shrink-0 text-xs font-medium text-neutral-500 hover:text-rose-600 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
