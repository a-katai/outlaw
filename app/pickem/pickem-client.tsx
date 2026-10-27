"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTeamColors } from "@/lib/league-data";
import { TeamMarker } from "@/app/components/next-game-card";
import type { PickChoice } from "@/lib/pickem";

export type PickemPlayer = { id: string; name: string; claimed: boolean };

export type PickemGame = {
  id: string;
  awayTeam: string;
  homeTeam: string;
  time: string | null;
  rink: string | null;
  lockAt: string | null; // ISO instant; null = unreadable time, treated as locked
  live: boolean;
  myPick: PickChoice | null;
};

function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Sign-in: pick your name; first time on a name, that PIN becomes yours. */
function SignIn({ players, onDone }: { players: PickemPlayer[]; onDone: () => void }) {
  const [playerId, setPlayerId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const player = players.find((p) => p.id === playerId);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pickem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, pin }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      onDone();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass-card max-w-md space-y-4 rounded-3xl p-6">
      <h2 className="text-xl font-semibold text-neutral-900">Who are you?</h2>
      <select
        aria-label="Your name"
        value={playerId}
        onChange={(e) => {
          setPlayerId(e.target.value);
          setPin("");
          setError(null);
        }}
        className="w-full rounded-xl border border-black/10 bg-white px-4 py-3.5 text-base outline-none ring-blue-500/30 transition focus:ring-4"
        required
      >
        <option value="">Pick your name</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {player ? (
        <div>
          <input
            aria-label={player.claimed ? "PIN" : "Choose a 4-digit PIN"}
            className="w-full min-w-0 rounded-xl border border-black/10 bg-white px-4 py-4 text-center text-2xl font-semibold tracking-[0.5em] outline-none ring-blue-500/30 transition focus:ring-4"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            autoComplete="off"
            type="password"
            required
          />
          <p className="mt-2 text-xs text-neutral-500">
            {player.claimed ? "Your PIN." : "First time. Choose a 4-digit PIN. You'll use it to sign in again."}
          </p>
        </div>
      ) : null}
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      <button
        type="submit"
        disabled={busy || !player || pin.length !== 4}
        className="w-full rounded-full bg-neutral-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-40"
      >
        {busy ? "Checking…" : player && !player.claimed ? "Set PIN" : "Continue"}
      </button>
    </form>
  );
}

function ChoiceButton({
  label,
  team,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  team: string | null;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const color = team ? getTeamColors(team).border : "#737373";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1 py-3 text-center transition active:scale-[0.97] disabled:cursor-default"
      style={{
        borderColor: selected ? color : "rgba(0,0,0,0.08)",
        background: selected ? `${color}14` : "rgba(255,255,255,0.9)",
        opacity: disabled && !selected ? 0.45 : 1,
      }}
    >
      {team ? <TeamMarker name={team} size={32} dotSize={12} /> : <span className="text-lg font-semibold text-neutral-400">=</span>}
      <span className="max-w-full px-1 text-center text-[11px] leading-tight text-balance font-semibold uppercase tracking-wide text-neutral-900">{label}</span>
    </button>
  );
}

function GameCard({
  game,
  now,
  signedIn,
  onNeedSignIn,
}: {
  game: PickemGame;
  now: number | null;
  signedIn: boolean;
  onNeedSignIn: () => void;
}) {
  const [pick, setPick] = useState<PickChoice | null>(game.myPick);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lockMs = game.lockAt ? new Date(game.lockAt).getTime() : null;
  const locked = game.live || lockMs === null || (now !== null && now >= lockMs);

  const choose = async (next: PickChoice) => {
    if (locked || saving) return;
    if (!signedIn) {
      onNeedSignIn();
      return;
    }
    const prev = pick;
    setPick(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/pickem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: [{ gameId: game.id, pick: next }] }),
      });
      const data = await res.json();
      if (!data.ok) {
        setPick(prev);
        setError(data.error ?? "Couldn't save that pick.");
      }
    } catch {
      setPick(prev);
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-3xl p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <p className="font-medium text-neutral-500">
          {game.time ? <span className="font-semibold tabular-nums text-neutral-900">{game.time}</span> : "TBD"}
          {game.rink ? ` · ${game.rink}` : ""}
        </p>
        <p className={`font-semibold tabular-nums ${locked ? "text-neutral-400" : "text-neutral-900"}`}>
          {locked ? (game.live ? "Live · locked" : "Locked") : now !== null && lockMs !== null ? `Locks in ${countdown(lockMs - now)}` : " "}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <ChoiceButton label={game.awayTeam} team={game.awayTeam} selected={pick === "away"} disabled={locked} onClick={() => choose("away")} />
        <ChoiceButton label="Tie" team={null} selected={pick === "tie"} disabled={locked} onClick={() => choose("tie")} />
        <ChoiceButton label={game.homeTeam} team={game.homeTeam} selected={pick === "home"} disabled={locked} onClick={() => choose("home")} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-400">
        <span>Away</span>
        <span />
        <span>Home</span>
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}
      {locked && !pick ? <p className="mt-3 text-xs text-neutral-500">No pick made.</p> : null}
    </div>
  );
}

export function PickemClient({
  ready,
  players,
  meName,
  games,
  dateLabel,
}: {
  ready: boolean;
  players: PickemPlayer[];
  meName: string | null;
  games: PickemGame[];
  dateLabel: string | null;
}) {
  const router = useRouter();
  const now = useNow();
  const [showSignIn, setShowSignIn] = useState(false);
  const signedIn = meName !== null;

  const signOut = async () => {
    await fetch("/api/pickem", { method: "DELETE" }).catch(() => null);
    router.refresh();
  };

  if (!games.length) {
    return (
      <div className="glass-card max-w-xl rounded-3xl p-8 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">This week</p>
        <h2 className="mt-3 text-2xl font-semibold text-neutral-900">No games to pick.</h2>
        <p className="mt-2 text-neutral-600">The next slate opens as soon as it&apos;s on the schedule.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">This week</h2>
        <span className="text-xs text-neutral-400">{dateLabel}</span>
      </div>

      {!ready ? (
        <p className="text-sm text-neutral-500">Picks open soon.</p>
      ) : signedIn ? (
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <p className="text-neutral-600">
            Picking as <span className="font-semibold text-neutral-900">{meName}</span>
          </p>
          <button type="button" onClick={signOut} className="text-xs font-medium text-neutral-500 underline-offset-2 hover:underline">
            Not you?
          </button>
        </div>
      ) : (
        <SignIn players={players} onDone={() => router.refresh()} />
      )}

      <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
        {games.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            now={now}
            signedIn={ready && signedIn}
            onNeedSignIn={() => setShowSignIn(true)}
          />
        ))}
      </div>
      {ready && !signedIn && showSignIn ? <p className="text-sm font-medium text-rose-600">Sign in above to make your pick.</p> : null}
    </div>
  );
}
