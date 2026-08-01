import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameDetail, type GameStatLine, type LineupPlayer } from "@/lib/live-season";
import { getTeamColors } from "@/lib/league-data";
import { matchGameFilm } from "@/lib/game-film";
import { LiveGameFeed } from "./live-game-feed";
import type { VideoItem } from "@/app/components/video-gallery";
import videosData from "@/videos-data.json";

export const dynamic = "force-dynamic";

function formatGameDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function TeamPill({ name }: { name: string }) {
  const colors = getTeamColors(name);
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1.5 text-base font-semibold md:text-lg"
      style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
    >
      {name}
    </span>
  );
}

function LineupCard({ teamName, players }: { teamName: string; players: LineupPlayer[] }) {
  const colors = getTeamColors(teamName);
  return (
    <div className="glass-card rounded-3xl p-5">
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
          style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
        >
          {teamName}
        </span>
        <span className="text-xs font-medium text-neutral-500">{players.length} dressed</span>
      </div>
      {players.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No lineup submitted yet.</p>
      ) : (
        <ul className="mt-3 space-y-1 text-sm text-neutral-700">
          {players.map((p) => (
            <li key={p.playerId}>{p.playerName}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BoxScoreCard({ teamName, scorers }: { teamName: string; scorers: GameStatLine[] }) {
  const colors = getTeamColors(teamName);
  return (
    <div className="glass-card rounded-3xl p-6">
      <span
        className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
        style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
      >
        {teamName}
      </span>
      <div className="mt-4 space-y-2 text-sm">
        {scorers.length === 0 ? (
          <p className="text-neutral-500">No scoring recorded</p>
        ) : (
          scorers.map((s) => (
            <p key={s.playerId} className="text-neutral-700">
              <span className="font-medium text-neutral-900">{s.playerName}</span>{" "}
              <span className="text-neutral-500">
                ({s.goals}G, {s.assists}A)
              </span>
            </p>
          ))
        )}
      </div>
    </div>
  );
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGameDetail(id);
  if (!game) notFound();

  const isFinal = game.status === "final" && game.homeScore !== null && game.awayScore !== null;
  const isLive = game.status === "live";
  const homeWins = isFinal && (game.homeScore as number) > (game.awayScore as number);
  const awayWins = isFinal && (game.awayScore as number) > (game.homeScore as number);

  const videos = videosData as VideoItem[];
  const filmMatches = matchGameFilm(videos, { date: game.date, homeTeam: game.homeTeam, awayTeam: game.awayTeam });

  const hasLineups = game.lineups.home.length + game.lineups.away.length > 0;
  const lineupsSection = hasLineups ? (
    <div>
      <h2 className="text-2xl font-semibold text-neutral-900">Lineups</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <LineupCard teamName={game.awayTeam} players={game.lineups.away} />
        <LineupCard teamName={game.homeTeam} players={game.lineups.home} />
      </div>
    </div>
  ) : null;

  return (
    <section className="space-y-10">
      <div>
        <Link
          href="/schedule"
          className="text-xs font-medium text-neutral-500 underline underline-offset-4 transition hover:text-neutral-900"
        >
          ← Schedule
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            {formatGameDate(game.date)}
            {game.time ? ` · ${game.time}` : ""}
          </p>
          {game.gameType === "playoff" ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              Playoff{game.series ? ` · ${game.series.name}` : ""}
            </span>
          ) : null}
          {isLive ? (
            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
              Live
            </span>
          ) : null}
        </div>

        <h1 className="mt-3 flex flex-wrap items-center gap-3 text-2xl font-semibold text-neutral-900 md:text-3xl">
          <TeamPill name={game.awayTeam} />
          <span className="text-base font-normal text-neutral-400 md:text-lg">at</span>
          <TeamPill name={game.homeTeam} />
        </h1>
      </div>

      {!isFinal ? lineupsSection : null}

      {isFinal ? (
        <div className="glass-card rounded-3xl p-8 text-center md:p-12">
          <div className="flex items-center justify-center gap-6 md:gap-12">
            <div>
              <p className={`text-5xl font-semibold md:text-7xl ${awayWins ? "text-neutral-900" : "text-neutral-400"}`}>
                {game.awayScore}
              </p>
              <p className="mt-2 text-sm font-medium text-neutral-500">{game.awayTeam}</p>
            </div>
            <span className="text-2xl text-neutral-300 md:text-4xl">–</span>
            <div>
              <p className={`text-5xl font-semibold md:text-7xl ${homeWins ? "text-neutral-900" : "text-neutral-400"}`}>
                {game.homeScore}
              </p>
              <p className="mt-2 text-sm font-medium text-neutral-500">{game.homeTeam}</p>
            </div>
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Final</p>
        </div>
      ) : isLive ? (
        <LiveGameFeed
          gameId={game.id}
          homeTeam={game.homeTeam}
          awayTeam={game.awayTeam}
          initial={{
            status: game.status,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            goalEvents: game.goalEvents,
          }}
        />
      ) : (
        <div className="glass-card rounded-3xl p-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Scheduled</p>
          {game.time ? <p className="mt-2 text-neutral-600">{game.time}</p> : null}
        </div>
      )}

      {isFinal ? (
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Box score</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <BoxScoreCard teamName={game.awayTeam} scorers={game.awayScorers} />
            <BoxScoreCard teamName={game.homeTeam} scorers={game.homeScorers} />
          </div>
        </div>
      ) : null}

      {isFinal ? lineupsSection : null}

      {filmMatches.length > 0 ? (
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Game film</h2>
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
        </div>
      ) : null}
    </section>
  );
}
