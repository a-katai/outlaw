import Image from "next/image";
import Link from "next/link";
import { getActiveSeasonLive, type LiveGame } from "@/lib/live-season";
import { getTeamColors, type TeamStanding } from "@/lib/league-data";
import { TeamLogo, teamLogo, teamSlug } from "@/lib/team-logos";
import { formatGameDate, sortChronological, splitTimeRink } from "@/app/components/next-game-card";

const LOGO = "/ohl_logo_2.png";

export const dynamic = "force-dynamic";

/** One side of a matchup — logo over a colour-underlined nameplate. */
function MatchupSide({ name }: { name: string }) {
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
function MatchupCell({ game }: { game: LiveGame }) {
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
 * Center-ice hero: the league mark sits at the center-ice dot inside a faint
 * face-off circle, with the whole night's slate — both Wednesday games —
 * stacked beneath it.
 */
function CenterIceHero({ games }: { games: LiveGame[] }) {
  return (
    <div className="hero-rise relative overflow-hidden py-10 text-center md:py-14">
      {/* Face-off circles are centered on the mark itself — the logo is the
          center-ice dot — so they track it across breakpoints. */}
      <div className="relative flex justify-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[272px] w-[272px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.06] md:h-[384px] md:w-[384px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[228px] w-[228px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.045] md:h-[324px] md:w-[324px]"
        />
        <Image
          src={LOGO}
          alt="Outlaw Hockey League"
          width={480}
          height={480}
          sizes="(min-width: 768px) 320px, 224px"
          className="relative h-auto w-56 object-contain md:w-80"
          priority
        />
      </div>

      <p className="relative mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
        {formatGameDate(games[0].date)}
      </p>

      {/* Both Wednesday games on one line; they stack only on the narrowest
          phones, where two nameplates side by side would collide. */}
      <div className="relative mx-auto mt-2 grid max-w-3xl grid-cols-1 divide-y divide-black/[0.07] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {games.map((game) => (
          <MatchupCell key={game.id} game={game} />
        ))}
      </div>

      <Link
        href="/schedule"
        className="relative mt-6 inline-block text-sm font-medium text-neutral-400 transition hover:text-neutral-700"
      >
        Full schedule →
      </Link>
    </div>
  );
}

/** Quiet single-line facts under the hero — hairlines, not cards. */
function PhaseStrip() {
  const rows = [
    { href: "/draft", label: "Draft night", value: "Wednesday, August 26 · 8 PM · Mr. Joe's" },
    { href: "/payments", label: "Fall dues", value: "$150 deposit · skaters $650 · goalies $100" },
  ];
  return (
    <div className="hero-rise-late mx-auto max-w-2xl divide-y divide-black/[0.07] border-y border-black/[0.07]">
      {rows.map((row) => (
        <Link key={row.href} href={row.href} className="group flex items-baseline justify-between gap-6 py-4">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{row.label}</span>
          <span className="text-right text-sm font-medium text-neutral-700 transition group-hover:text-neutral-900">
            {row.value} <span className="text-neutral-300 transition group-hover:text-neutral-500">→</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function LatestResultRow({ game }: { game: LiveGame }) {
  const homeWins = (game.homeScore as number) > (game.awayScore as number);
  return (
    <Link href={`/games/${game.id}`} className="group flex items-baseline justify-between gap-6 py-4">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Latest</span>
      <span className="text-right text-sm font-medium text-neutral-700 transition group-hover:text-neutral-900">
        <span className={homeWins ? "text-neutral-500" : "font-semibold text-neutral-900"}>
          {game.awayTeam} {game.awayScore}
        </span>
        <span className="text-neutral-300"> – </span>
        <span className={homeWins ? "font-semibold text-neutral-900" : "text-neutral-500"}>
          {game.homeScore} {game.homeTeam}
        </span>
        <span className="text-neutral-400"> · Final</span>{" "}
        <span className="text-neutral-300 transition group-hover:text-neutral-500">→</span>
      </span>
    </Link>
  );
}

function StandingsStrip({ standings }: { standings: TeamStanding[] }) {
  return (
    <div className="hero-rise-late mx-auto max-w-2xl">
      <div className="divide-y divide-black/[0.07] border-y border-black/[0.07]">
        {standings.map((team, i) => (
          <Link
            key={team.team}
            href={teamLogo(team.team) ? `/teams/${teamSlug(team.team)}` : "/stats"}
            className="group flex items-center justify-between gap-4 py-3"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="w-4 shrink-0 text-xs font-medium tabular-nums text-neutral-400">{i + 1}</span>
              {teamLogo(team.team) ? <TeamLogo name={team.team} size={22} /> : null}
              <span className="truncate text-sm font-medium text-neutral-800 transition group-hover:text-neutral-900">
                {team.team}
              </span>
            </span>
            <span className="flex shrink-0 items-baseline gap-4 text-xs text-neutral-500">
              <span className="tabular-nums">
                {team.wins}-{team.losses}-{team.ties}
              </span>
              <span className="text-sm font-semibold tabular-nums text-neutral-900">{team.points}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-3 text-right">
        <Link href="/stats" className="text-xs font-medium text-neutral-400 transition hover:text-neutral-700">
          Full stats →
        </Link>
      </div>
    </div>
  );
}

export default async function Home() {
  const season = await getActiveSeasonLive();
  const games = season?.games ?? [];
  const upcoming = sortChronological(games.filter((g) => g.status !== "final"));
  // The league plays two games every Wednesday, so the hero shows the whole
  // night — every game sharing the next date, not just the earliest one.
  const nextNight = upcoming.length ? upcoming.filter((g) => g.date === upcoming[0].date) : [];
  const finals = games.filter((g) => g.status === "final" && g.gameType === "regular");
  const hasFinals = finals.length > 0;
  const latest = hasFinals ? sortChronological(finals)[finals.length - 1] : null;

  return (
    <section className="space-y-6">
      <h1 className="sr-only">Outlaw Hockey League</h1>

      {nextNight.length ? (
        <CenterIceHero games={nextNight} />
      ) : (
        <div className="flex justify-center py-10">
          <Image src={LOGO} alt="Outlaw Hockey League" width={220} height={220} sizes="220px" className="h-auto w-44 object-contain sm:w-52" priority />
        </div>
      )}

      {hasFinals && latest ? (
        <div className="mx-auto max-w-2xl">
          <div className="divide-y divide-black/[0.07] border-y border-black/[0.07]">
            <LatestResultRow game={latest} />
          </div>
          <div className="mt-8">
            <StandingsStrip standings={season?.standings ?? []} />
          </div>
        </div>
      ) : (
        <PhaseStrip />
      )}
    </section>
  );
}
