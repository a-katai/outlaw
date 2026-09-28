import Link from "next/link";
import type { LiveGame } from "@/lib/live-season";
import { getTeamColors } from "@/lib/league-data";
import { TeamLogo, teamLogo } from "@/lib/team-logos";
import { splitTimeRink } from "@/app/components/next-game-card";

/** One side of a matchup — logo over a colour-underlined nameplate. */
export function MatchupSide({ name }: { name: string }) {
  const colors = getTeamColors(name);
  return (
    <div className="flex w-24 flex-col items-center gap-2 sm:w-28 md:w-32">
      {teamLogo(name) ? (
        <>
          <div className="md:hidden"><TeamLogo name={name} size={40} /></div>
          <div className="hidden md:block"><TeamLogo name={name} size={52} /></div>
        </>
      ) : null}
      <p
        className="nameplate text-xs leading-none text-neutral-900 sm:text-sm md:text-base"
        style={{ borderBottom: `2px solid ${colors.border}`, paddingBottom: "0.3rem" }}
      >
        {name}
      </p>
    </div>
  );
}

/** A compact matchup cell — two of these sit side by side as the night's slate. */
export function MatchupCell({ game }: { game: LiveGame }) {
  const { time, rink } = splitTimeRink(game.time);
  return (
    <Link href={`/games/${game.id}`} className="group block px-2 py-6 text-center">
      <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
        <MatchupSide name={game.awayTeam} />
        <span className="nameplate self-center pb-5 text-xs text-neutral-300">at</span>
        <MatchupSide name={game.homeTeam} />
      </div>
      <p className="mt-4 text-xs font-medium text-neutral-600 sm:text-sm">
        {time ? <span className="text-neutral-900">{time}</span> : null}
        {rink ? <span className="text-neutral-500"> · {rink}</span> : null}
      </p>
    </Link>
  );
}

/**
 * The whole night's slate — every game sharing the next date, side by side.
 * They stack only on the narrowest phones, where two nameplates would collide.
 */
export function NightSlate({ games }: { games: LiveGame[] }) {
  return (
    <div className="grid grid-cols-1 divide-y divide-black/[0.07] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
      {games.map((game) => (
        <MatchupCell key={game.id} game={game} />
      ))}
    </div>
  );
}
