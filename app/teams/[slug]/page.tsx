import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveSeasonLive, type LiveGame } from "@/lib/live-season";
import { seasons as staticSeasons } from "@/lib/league-data";
import { TeamLogo, teamNameFromSlug } from "@/lib/team-logos";
import { matchTeamFilm } from "@/lib/game-film";
import { formatGameDate, sortChronological, splitTimeRink, TeamMarker } from "@/app/components/next-game-card";
import type { VideoItem } from "@/app/components/video-gallery";
import videosData from "@/videos-data.json";

export const dynamic = "force-dynamic";

const ORDINAL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const teamName = teamNameFromSlug(slug);
  if (!teamName) return { title: "Team not found — Outlaw Hockey League" };
  return {
    title: `${teamName} — Outlaw Hockey League`,
    description: `Roster, schedule, film, and history for the ${teamName}.`,
  };
}

function TeamGameRow({ game, teamName }: { game: LiveGame; teamName: string }) {
  const isHome = game.homeTeam === teamName;
  const opponent = isHome ? game.awayTeam : game.homeTeam;
  const isFinal = game.status === "final" && game.homeScore !== null && game.awayScore !== null;
  const thisScore = isHome ? game.homeScore : game.awayScore;
  const oppScore = isHome ? game.awayScore : game.homeScore;
  const result: "W" | "L" | "T" | null = isFinal
    ? (thisScore as number) > (oppScore as number)
      ? "W"
      : (thisScore as number) < (oppScore as number)
        ? "L"
        : "T"
    : null;
  const { time, rink } = splitTimeRink(game.time);

  return (
    <Link
      href={`/games/${game.id}`}
      className="group flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-neutral-50/80"
    >
      <div className="flex min-w-0 items-center gap-3">
        <TeamMarker name={opponent} size={32} dotSize={10} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900">
            {isHome ? "vs" : "at"} {opponent}
          </p>
          <p className="text-xs text-neutral-500">
            {formatGameDate(game.date)}
            {time ? ` · ${time}` : ""}
            {rink && !isFinal ? ` · ${rink}` : ""}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {isFinal ? (
          <p
            className={`text-lg font-semibold tabular-nums ${
              result === "W" ? "text-emerald-600" : result === "L" ? "text-neutral-400" : "text-neutral-600"
            }`}
          >
            {result} {thisScore}–{oppScore}
          </p>
        ) : (
          <p className="text-sm font-medium text-neutral-500">{time ?? "TBD"}</p>
        )}
      </div>
    </Link>
  );
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const teamName = teamNameFromSlug(slug);
  if (!teamName) notFound();

  const season = await getActiveSeasonLive();

  const record = season?.standings.find((s) => s.team === teamName) ?? null;
  const hasFinals = season?.standings.some((s) => s.gp > 0) ?? false;
  const standingsPosition =
    hasFinals && season ? season.standings.findIndex((s) => s.team === teamName) + 1 : null;

  const roster = season?.rosters?.[teamName] ?? [];

  const teamGames = (season?.games ?? []).filter((g) => g.homeTeam === teamName || g.awayTeam === teamName);
  const upcomingGames = sortChronological(teamGames.filter((g) => g.status === "scheduled")).slice(0, 5);
  const resultGames = [...teamGames.filter((g) => g.status === "final")].sort((a, b) =>
    a.date !== b.date ? (a.date > b.date ? -1 : 1) : 0,
  );

  const videos = videosData as VideoItem[];
  const allFilmMatches = matchTeamFilm(videos, teamName);
  const filmMatches = allFilmMatches.slice(0, 9);

  const historyLines = staticSeasons
    .filter((s) => s.id !== "2026-27" && s.standings.length > 0)
    .map((s) => {
      const idx = s.standings.findIndex((t) => t.team === teamName);
      if (idx === -1) return null;
      const t = s.standings[idx];
      return {
        seasonLabel: s.label,
        gp: t.gp,
        wins: t.wins,
        losses: t.losses,
        ties: t.ties,
        points: t.points,
        position: idx + 1,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <section className="space-y-10">
      <Link
        href="/teams"
        className="text-xs font-medium text-neutral-500 underline underline-offset-4 transition hover:text-neutral-900"
      >
        ← Teams
      </Link>

      <div className="glass-card rounded-3xl p-8 text-center md:p-12">
        <TeamLogo name={teamName} size={140} className="mx-auto" />
        <h1 className="mt-5 text-4xl font-semibold text-neutral-900 md:text-5xl">{teamName}</h1>
        {hasFinals && record ? (
          <p className="mt-3 text-neutral-600">
            {record.wins}-{record.losses}-{record.ties} · {record.points} PTS
            {standingsPosition ? ` · #${standingsPosition} in standings` : ""}
          </p>
        ) : (
          <p className="mt-3 text-neutral-600">First game September 9.</p>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Roster</h2>
        {roster.length === 0 ? (
          <Link
            href="/draft"
            className="glass-card mt-4 block rounded-3xl p-6 text-sm text-neutral-600 transition hover:bg-neutral-50/80"
          >
            Roster forms at the draft — Wednesday, August 26.
          </Link>
        ) : (
          <div className="glass-card mt-4 divide-y divide-black/5 overflow-hidden rounded-3xl">
            {roster.map((p) => (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-neutral-50/80"
              >
                <span className="font-medium text-neutral-900">{p.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-neutral-500">
                  {p.position ? (
                    <span className="rounded-full border border-black/10 px-2 py-0.5 font-semibold">{p.position}</span>
                  ) : null}
                  {p.rank ? <span>#{p.rank}</span> : null}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-5">
        <h2 className="text-2xl font-semibold text-neutral-900">Schedule</h2>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Upcoming</p>
          {upcomingGames.length > 0 ? (
            <div className="glass-card mt-3 divide-y divide-black/5 overflow-hidden rounded-3xl">
              {upcomingGames.map((g) => (
                <TeamGameRow key={g.id} game={g} teamName={teamName} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">No games scheduled.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Results</p>
          {resultGames.length > 0 ? (
            <div className="glass-card mt-3 divide-y divide-black/5 overflow-hidden rounded-3xl">
              {resultGames.map((g) => (
                <TeamGameRow key={g.id} game={g} teamName={teamName} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">No games played yet.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Team film</h2>
        {filmMatches.length === 0 ? (
          <div className="glass-card mt-4 rounded-3xl p-6 text-sm text-neutral-600">No team film yet.</div>
        ) : (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filmMatches.map((video) => (
                <article key={video.id} className="glass-card lift overflow-hidden rounded-3xl">
                  <a href={video.url} target="_blank" rel="noreferrer" className="block">
                    <div className="relative aspect-video w-full">
                      <Image
                        src={video.thumbnail}
                        alt={video.title}
                        fill
                        sizes="(min-width: 1280px) 352px, (min-width: 768px) 45vw, 100vw"
                        className="object-cover"
                        loading="lazy"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-black/20" />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
                          <span
                            className="ml-1 block h-0 w-0 border-y-[9px] border-y-transparent border-l-[14px] border-l-neutral-900"
                            aria-hidden
                          />
                        </span>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="line-clamp-2 text-base font-semibold text-neutral-900">{video.matchup}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{video.subtitle}</p>
                      <p className="mt-2 text-sm font-medium text-neutral-500">{video.gameDate}</p>
                    </div>
                  </a>
                </article>
              ))}
            </div>
            <a
              href="https://www.youtube.com/@outlawhockeyleague9642"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 underline underline-offset-4 transition hover:text-neutral-900"
            >
              More on YouTube →
            </a>
          </>
        )}
      </div>

      {historyLines.length > 0 ? (
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">History</h2>
          <div className="glass-card mt-4 divide-y divide-black/5 overflow-hidden rounded-3xl">
            {historyLines.map((h) => (
              <div key={h.seasonLabel} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-medium text-neutral-900">{h.seasonLabel}</span>
                <span className="text-neutral-500">
                  {h.gp} GP · {h.wins}-{h.losses}-{h.ties} · {h.points} PTS ·{" "}
                  {ORDINAL[h.position] ?? `${h.position}th`}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
