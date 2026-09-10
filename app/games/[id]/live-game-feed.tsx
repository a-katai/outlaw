"use client";

import { useEffect, useState } from "react";
import type { GameStatus, GoalEventLine, PenaltyEventLine } from "@/lib/live-season";
import { GoalList } from "./goal-list";
import { PenaltyList } from "./penalty-list";

const POLL_MS = 15000;

type LiveState = {
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  goalEvents: GoalEventLine[];
  penaltyEvents: PenaltyEventLine[];
};

/** Public, client-side live score + goal feed for /games/[id]. Polls while the game is live. */
export function LiveGameFeed({
  gameId,
  initial,
  homeTeam,
  awayTeam,
}: {
  gameId: string;
  initial: LiveState;
  homeTeam: string;
  awayTeam: string;
}) {
  const [state, setState] = useState<LiveState>(initial);

  useEffect(() => {
    if (state.status !== "live") return;
    let ignore = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/games/${gameId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!ignore && data.ok) {
          setState({
            status: data.status,
            homeScore: data.homeScore,
            awayScore: data.awayScore,
            goalEvents: data.goalEvents,
            penaltyEvents: data.penaltyEvents ?? [],
          });
        }
      } catch {
        // Transient poll failure — try again next tick.
      }
    };

    const interval = setInterval(poll, POLL_MS);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [gameId, state.status]);

  const homeWins = (state.homeScore ?? 0) > (state.awayScore ?? 0);
  const awayWins = (state.awayScore ?? 0) > (state.homeScore ?? 0);

  return (
    <>
      <div className="glass-card rounded-3xl p-8 text-center md:p-12">
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">Live</p>
        </div>
        <div className="flex items-center justify-center gap-6 md:gap-12">
          <div>
            <p className={`text-5xl font-semibold md:text-7xl ${awayWins ? "text-neutral-900" : "text-neutral-400"}`}>
              {state.awayScore ?? 0}
            </p>
            <p className="mt-2 text-sm font-medium text-neutral-500">{awayTeam}</p>
          </div>
          <span className="text-2xl text-neutral-300 md:text-4xl">–</span>
          <div>
            <p className={`text-5xl font-semibold md:text-7xl ${homeWins ? "text-neutral-900" : "text-neutral-400"}`}>
              {state.homeScore ?? 0}
            </p>
            <p className="mt-2 text-sm font-medium text-neutral-500">{homeTeam}</p>
          </div>
        </div>
      </div>

      <GoalList goals={state.goalEvents} />

      <PenaltyList penalties={state.penaltyEvents} />
    </>
  );
}
