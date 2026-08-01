"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { draftOrderOnClock, sortByRankThenName } from "@/lib/draft-logic";
import type { Team } from "@/lib/draft-types";
import { FormatBadge, PositionBadge, RankBadge, StatusBadge } from "../draft-ui";
import { useLiveDraft } from "../use-live-draft";

const STORAGE_KEY = "outlaw_draft_code";

type WhoamiTeam = { id: string; name: string; draft_order: number | null };

export function PickClient() {
  const [code, setCode] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null,
  );
  const [codeInput, setCodeInput] = useState("");
  const [team, setTeam] = useState<WhoamiTeam | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [pickSuccess, setPickSuccess] = useState<string | null>(null);

  const { draft, teams, players, picks, loading, error, refetch } = useLiveDraft();

  const resolveCode = async (value: string) => {
    setResolving(true);
    setResolveError(null);
    try {
      const res = await fetch("/api/draft/whoami", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const data = await res.json();
      if (!data.ok) {
        setResolveError(data.error ?? "Invalid code");
        setTeam(null);
        window.localStorage.removeItem(STORAGE_KEY);
        setCode(null);
        return;
      }
      setTeam(data.team);
      window.localStorage.setItem(STORAGE_KEY, value);
      setCode(value);
    } catch {
      setResolveError("Couldn't reach the server. Try again.");
    } finally {
      setResolving(false);
    }
  };

  // Auto-resolve a code restored from localStorage on first load.
  useEffect(() => {
    if (!code || team || resolving) return;
    let ignore = false;
    (async () => {
      setResolving(true);
      setResolveError(null);
      try {
        const res = await fetch("/api/draft/whoami", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (ignore) return;
        if (!data.ok) {
          setResolveError(data.error ?? "Invalid code");
          setTeam(null);
          window.localStorage.removeItem(STORAGE_KEY);
          setCode(null);
        } else {
          setTeam(data.team);
        }
      } catch {
        if (!ignore) setResolveError("Couldn't reach the server. Try again.");
      } finally {
        if (!ignore) setResolving(false);
      }
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const submitCode = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = codeInput.trim().toUpperCase();
    if (!value) return;
    resolveCode(value);
  };

  const switchTeam = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setCode(null);
    setTeam(null);
    setCodeInput("");
    setResolveError(null);
  };

  const orderedTeams = useMemo(
    () => teams.filter((t) => t.draft_order !== null).sort((a, b) => (a.draft_order ?? 0) - (b.draft_order ?? 0)),
    [teams],
  );
  const teamCount = orderedTeams.length;
  const teamByDraftOrder = useMemo(() => new Map(orderedTeams.map((t) => [t.draft_order as number, t])), [orderedTeams]);
  const draftedPlayerIds = useMemo(() => new Set(picks.map((p) => p.player_id)), [picks]);
  const availablePlayers = useMemo(
    () =>
      sortByRankThenName(
        players
          .filter((p) => !draftedPlayerIds.has(p.id))
          .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [players, draftedPlayerIds, search],
  );

  const myTeam: Team | undefined = team ? teams.find((t) => t.id === team.id) : undefined;
  const myPicks = useMemo(
    () =>
      myTeam
        ? picks.filter((p) => p.team_id === myTeam.id).sort((a, b) => a.pick_number - b.pick_number)
        : [],
    [picks, myTeam],
  );
  const playerNameById = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);

  const onClockOrder = draft && teamCount > 0 ? draftOrderOnClock(draft.current_pick, teamCount, draft.format) : null;
  const onClockTeam = onClockOrder ? teamByDraftOrder.get(onClockOrder) : undefined;
  const isMyTurn = Boolean(draft?.status === "live" && myTeam && onClockTeam?.id === myTeam.id);

  const selectedPlayer = selectedPlayerId ? players.find((p) => p.id === selectedPlayerId) : null;

  const confirmPick = async () => {
    if (!selectedPlayerId || !code || !draft) return;
    setSubmitting(true);
    setPickError(null);
    try {
      const res = await fetch("/api/draft/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, playerId: selectedPlayerId, draftId: draft.id }),
      });
      const data = await res.json();
      if (!data.ok) {
        setPickError(data.error ?? "Couldn't submit that pick.");
        return;
      }
      setPickSuccess(`Drafted ${selectedPlayer?.name ?? "player"}.`);
      setSelectedPlayerId(null);
      refetch();
      setTimeout(() => setPickSuccess(null), 4000);
    } catch {
      setPickError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Code entry state ---
  if (!team) {
    return (
      <section className="mx-auto max-w-md space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Live Draft</p>
          <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Captain sign-in</h1>
          <p className="mt-3 text-sm text-neutral-600">Enter your team&apos;s pick code to make selections.</p>
        </div>
        <form onSubmit={submitCode} className="glass-card space-y-4 rounded-3xl p-6 md:p-8">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Team code</span>
            <input
              className="min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-center text-lg font-semibold uppercase tracking-[0.3em] outline-none ring-blue-500/30 transition focus:ring-4"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              autoComplete="off"
              required
            />
          </label>
          {resolveError ? <p className="text-sm font-medium text-rose-600">{resolveError}</p> : null}
          <button
            type="submit"
            disabled={resolving}
            className="w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
          >
            {resolving ? "Checking…" : "Continue"}
          </button>
        </form>
      </section>
    );
  }

  if (loading) {
    return <div className="glass-card rounded-3xl p-10 text-center text-sm text-neutral-500">Loading draft…</div>;
  }

  if (error || !draft) {
    return (
      <div className="glass-card rounded-3xl p-10 text-center text-sm font-medium text-rose-600">
        {error ?? "Draft coming soon."}
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Live Draft</p>
          <h1 className="mt-2 text-4xl font-semibold text-neutral-900">{myTeam?.name ?? team.name}</h1>
        </div>
        <button
          type="button"
          onClick={switchTeam}
          className="text-xs font-medium text-neutral-500 underline underline-offset-4 transition hover:text-neutral-900"
        >
          Not your team? Switch code
        </button>
      </div>

      <div className="glass-card rounded-3xl p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={draft.status} />
          <FormatBadge format={draft.format} />
          <span className="text-xs text-neutral-500">Pick #{draft.current_pick}</span>
        </div>
        <p className={`mt-4 text-lg font-semibold ${isMyTurn ? "text-emerald-700" : "text-neutral-500"}`}>
          {draft.status === "complete"
            ? "Draft complete."
            : isMyTurn
              ? "You're on the clock — make your pick below."
              : `On the clock: ${onClockTeam?.name ?? "—"}`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-neutral-900">Available players</h2>
            <input
              className="w-40 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-blue-500/30 transition focus:ring-4 sm:w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players"
            />
          </div>

          {pickError ? <p className="mt-3 text-sm font-medium text-rose-600">{pickError}</p> : null}
          {pickSuccess ? <p className="mt-3 text-sm font-medium text-emerald-700">{pickSuccess}</p> : null}

          <div className="glass-card mt-4 max-h-[560px] overflow-y-auto rounded-3xl p-2">
            {availablePlayers.length === 0 ? (
              <p className="p-4 text-sm text-neutral-500">No players match.</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {availablePlayers.map((player) => (
                  <li key={player.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm text-neutral-800">{player.name}</span>
                      <RankBadge rank={player.rank} />
                      <PositionBadge position={player.position} />
                    </div>
                    {selectedPlayerId === player.id ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={confirmPick}
                          disabled={submitting}
                          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
                        >
                          {submitting ? "Drafting…" : `Draft ${player.name.split(" ")[0]} — confirm`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPlayerId(null)}
                          disabled={submitting}
                          className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPickError(null);
                          setSelectedPlayerId(player.id);
                        }}
                        disabled={!isMyTurn}
                        className="shrink-0 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Pick
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Your roster</h2>
          <div className="glass-card mt-4 rounded-3xl p-5">
            {myPicks.length === 0 ? (
              <p className="text-sm text-neutral-500">No picks yet.</p>
            ) : (
              <ol className="space-y-1.5">
                {myPicks.map((pick) => (
                  <li key={pick.id} className="flex items-baseline gap-2 text-sm text-neutral-700">
                    <span className="w-14 shrink-0 text-xs font-medium text-neutral-400">
                      R{pick.round} · #{pick.pick_number}
                    </span>
                    <span className="truncate">{playerNameById.get(pick.player_id) ?? "—"}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
