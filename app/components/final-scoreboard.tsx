import Link from "next/link";
import type { Star } from "@/lib/three-stars";
import { getTeamColors } from "@/lib/league-data";
import { TeamLogo, teamLogo } from "@/lib/team-logos";

/** Goals per period for both sides, only when every goal in the game carries a period. */
export type LineScore = { labels: string[]; away: number[]; home: number[] };

const ORDINAL = ["1st", "2nd", "3rd"];

function ScoreRow({
  name,
  score,
  won,
  periods,
  large,
}: {
  name: string;
  score: number;
  won: boolean;
  periods: number[] | null;
  large: boolean;
}) {
  const colors = getTeamColors(name);
  const tone = won ? "text-neutral-900" : "text-neutral-400";
  return (
    <div className={`flex items-center gap-3 ${large ? "py-2.5" : "py-2"}`}>
      {teamLogo(name) ? <TeamLogo name={name} size={large ? 36 : 26} /> : null}
      <span
        className={`nameplate min-w-0 flex-1 truncate ${large ? "text-base md:text-lg" : "text-sm"} ${tone}`}
        style={{ borderBottom: `2px solid ${won ? colors.border : "transparent"}`, paddingBottom: "0.15rem" }}
      >
        {name}
      </span>
      {periods
        ? periods.map((n, i) => (
            <span key={i} className={`hidden w-6 text-center text-sm tabular-nums sm:inline ${tone}`}>
              {n}
            </span>
          ))
        : null}
      <span className={`w-8 text-right font-semibold tabular-nums ${large ? "text-3xl md:text-4xl" : "text-2xl"} ${tone}`}>
        {score}
      </span>
    </div>
  );
}

/**
 * An official final: FINAL flag, both teams on their own line with logo,
 * nameplate and score (winner underlined in team colour), an optional period
 * line score, and the game's three stars beneath a hairline.
 */
export function FinalScoreboard({
  gameId,
  awayTeam,
  homeTeam,
  awayScore,
  homeScore,
  stars,
  lineScore = null,
  meta,
  large = false,
}: {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  stars: Star[];
  lineScore?: LineScore | null;
  /** Small right-aligned text beside FINAL — the rink, or a date. */
  meta?: string | null;
  large?: boolean;
}) {
  const homeWins = homeScore > awayScore;
  const awayWins = awayScore > homeScore;
  const tie = homeScore === awayScore;
  const labels = lineScore?.labels ?? null;

  return (
    <div className={large ? "" : "px-1"}>
      <div className="flex items-baseline justify-between pb-1">
        <Link href={`/games/${gameId}`} className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-900">
          Final{tie ? " · Tie" : ""}
        </Link>
        <span className="flex items-baseline gap-3 text-xs text-neutral-400">
          {labels
            ? labels.map((l) => (
                <span key={l} className="hidden w-6 text-center font-semibold uppercase sm:inline">
                  {l}
                </span>
              ))
            : null}
          {labels ? <span className="hidden w-8 text-right font-semibold uppercase sm:inline">T</span> : null}
          {meta && !labels ? <span>{meta}</span> : null}
        </span>
      </div>
      <div className="divide-y divide-black/[0.05]">
        <ScoreRow name={awayTeam} score={awayScore} won={awayWins || tie} periods={lineScore?.away ?? null} large={large} />
        <ScoreRow name={homeTeam} score={homeScore} won={homeWins || tie} periods={lineScore?.home ?? null} large={large} />
      </div>
      {stars.length ? (
        <div className="mt-2 border-t border-black/[0.07] pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Three stars</p>
          <div className="mt-1">
            {stars.map((star) => (
              <Link
                key={star.rank}
                href={`/players/${star.playerId}`}
                className="group flex items-center justify-between gap-3 py-1"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-6 shrink-0 text-[11px] font-medium tabular-nums text-neutral-400">{ORDINAL[star.rank - 1]}</span>
                  {teamLogo(star.team) ? <TeamLogo name={star.team} size={16} /> : null}
                  <span className="truncate text-sm font-medium text-neutral-800 transition group-hover:text-neutral-900">
                    {star.playerName}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-neutral-600">
                  {star.goalsAgainst !== null ? `${star.goalsAgainst} GA` : `${star.goals} G · ${star.assists} A`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Builds a period line score from goal events; null unless every goal has a period. */
export function lineScoreFromGoals(
  goals: { teamId: string; period: number | null }[],
  homeTeamId: string,
): LineScore | null {
  if (!goals.length || goals.some((g) => g.period == null)) return null;
  const hasOt = goals.some((g) => (g.period as number) >= 4);
  const labels = hasOt ? ["1", "2", "3", "OT"] : ["1", "2", "3"];
  const away = labels.map(() => 0);
  const home = labels.map(() => 0);
  for (const g of goals) {
    const i = Math.min((g.period as number) - 1, labels.length - 1);
    if (g.teamId === homeTeamId) home[i] += 1;
    else away[i] += 1;
  }
  return { labels, away, home };
}
