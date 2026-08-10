"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getTeamColors } from "@/lib/league-data";
import { TeamLogo, teamLogo } from "@/lib/team-logos";
import { TV_BACKGROUND_STYLE } from "../draft-board-client";

// The five real Outlaw teams (matches lib/team-logos.tsx + lib/league-data.ts
// team-color palette exactly) — this is pure theater, no DB read, so the
// roster is fixed here rather than fetched.
const DRAFT_TEAMS = ["Wednesday Knights", "Toe Dragons", "Ghost Pirates", "Tank Fillers", "Trashers"];

type Phase = "setup" | "revealing" | "done";

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

/** Unbiased-enough Fisher-Yates shuffle seeded from the Web Crypto RNG. */
function shuffleTeams(teams: string[]): string[] {
  const arr = [...teams];
  for (let i = arr.length - 1; i > 0; i--) {
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    const j = rand[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function LotteryClient() {
  const [phase, setPhase] = useState<Phase>("setup");
  // order[0] = 1st overall pick ... order[4] = 5th overall pick.
  const [order, setOrder] = useState<string[] | null>(null);
  // How many slots have been revealed so far, counting from the *end* of
  // order (5th pick first) toward the front (1st pick last).
  const [revealedCount, setRevealedCount] = useState(0);

  const teamCount = DRAFT_TEAMS.length;

  const handleDraw = useCallback(() => {
    setOrder(shuffleTeams(DRAFT_TEAMS));
    setRevealedCount(0);
    setPhase("revealing");
  }, []);

  const handleAdvance = useCallback(() => {
    setRevealedCount((count) => {
      if (count >= teamCount) return count;
      const next = count + 1;
      if (next === teamCount) setPhase("done");
      return next;
    });
  }, [teamCount]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      if (phase !== "revealing") return;
      e.preventDefault();
      handleAdvance();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, handleAdvance]);

  const nextPickNumber = teamCount - revealedCount;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center overflow-hidden px-8 py-6"
      style={TV_BACKGROUND_STYLE}
      onClick={phase === "revealing" ? handleAdvance : undefined}
    >
      <div className="absolute right-6 top-6">
        <Link href="/admin" className="text-xs font-medium text-neutral-400 transition hover:text-neutral-700">
          Exit
        </Link>
      </div>

      <div className="flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-8 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">Draft night</p>
          <h1 className="mt-2 text-4xl font-semibold text-neutral-900 md:text-5xl">Lottery</h1>
        </div>

        {phase === "setup" ? (
          <>
            <div className="grid w-full grid-cols-5 gap-3">
              {DRAFT_TEAMS.map((name) => {
                const colors = getTeamColors(name);
                const hasLogo = Boolean(teamLogo(name));
                return (
                  <div key={name} className="glass-card flex flex-col items-center gap-2 rounded-2xl px-2 py-5">
                    {hasLogo ? (
                      <TeamLogo name={name} size={56} />
                    ) : (
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors.border }} aria-hidden />
                    )}
                    <span className="text-xs font-semibold text-neutral-700 md:text-sm">{name}</span>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleDraw}
              className="rounded-full bg-neutral-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700"
            >
              Draw order
            </button>
          </>
        ) : (
          <>
            <div className="flex w-full flex-col gap-2.5">
              {order?.map((teamName, index) => {
                // Row 0 = 1st overall (biggest treatment, revealed last).
                // Row (teamCount-1) = last overall pick (revealed first).
                const pickNumber = index + 1;
                const revealed = index >= teamCount - revealedCount;
                const isTop = index === 0;
                const colors = getTeamColors(teamName);
                const hasLogo = Boolean(teamLogo(teamName));
                return (
                  <div
                    key={index}
                    className={`glass-card flex items-center gap-4 rounded-2xl px-5 transition-all duration-300 ease-out ${
                      isTop ? "py-5" : "py-3"
                    } ${revealed ? "scale-100 opacity-100" : "scale-95 opacity-40"}`}
                    style={revealed && isTop ? { boxShadow: `0 0 0 2px ${colors.border}` } : undefined}
                  >
                    <span
                      className={`shrink-0 font-semibold text-neutral-400 ${isTop ? "w-24 text-lg" : "w-20 text-sm"}`}
                    >
                      {ordinal(pickNumber)} pick
                    </span>
                    {revealed ? (
                      <>
                        {hasLogo ? (
                          <TeamLogo name={teamName} size={isTop ? 56 : 36} />
                        ) : (
                          <span
                            className={`shrink-0 rounded-full ${isTop ? "h-4 w-4" : "h-2.5 w-2.5"}`}
                            style={{ backgroundColor: colors.border }}
                            aria-hidden
                          />
                        )}
                        <span className={`font-semibold text-neutral-900 ${isTop ? "text-3xl md:text-4xl" : "text-lg"}`}>
                          {teamName}
                        </span>
                      </>
                    ) : (
                      <span className="text-lg text-neutral-300">?</span>
                    )}
                  </div>
                );
              })}
            </div>

            {phase === "revealing" ? (
              <p className="text-sm text-neutral-500">
                Tap, click, or press space to reveal the {ordinal(nextPickNumber)} pick.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Link
                  href="/admin"
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-semibold text-neutral-900 underline underline-offset-4 transition hover:text-neutral-600"
                >
                  Set this order in Admin →
                </Link>
                <p className="text-xs text-neutral-400">
                  Enter this order in the admin Draft tab. It is not auto-applied.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
