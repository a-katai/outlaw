import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerProfile, type PlayerGoalieCareerRow } from "@/lib/players";
import { getTeamColors } from "@/lib/league-data";
import { TeamLogo, teamLogo } from "@/lib/team-logos";
import { PositionBadge, RankBadge } from "@/app/draft/draft-ui";
import { matchPlayerFilm } from "@/lib/game-film";
import type { VideoItem } from "@/app/components/video-gallery";
import videosData from "@/videos-data.json";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPlayerProfile(id);
  if (!profile) {
    return { title: "Not found — Outlaw Hockey League" };
  }
  return {
    title: `${profile.name} — Outlaw Hockey League`,
    description: `Career stats, game log, and clips for ${profile.name} in the Outlaw Hockey League.`,
  };
}

function TeamPill({ name }: { name: string }) {
  const colors = getTeamColors(name);
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold"
      style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
    >
      {name}
    </span>
  );
}

function formatGameDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type DisplayCareerRow = { key: string; label: string; gp: number; g: number; a: number; pts: number };

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getPlayerProfile(id);
  if (!profile) notFound();

  const isGoalie = profile.position === "G";

  const displayRows: DisplayCareerRow[] = [
    ...profile.career.map((r) => ({
      key: `${r.seasonId}-${r.gameType}`,
      label: r.gameType === "playoff" ? `${r.seasonLabel} · Playoffs` : r.seasonLabel,
      gp: r.gamesPlayed,
      g: r.goals,
      a: r.assists,
      pts: r.points,
    })),
    ...(profile.archiveLine
      ? [
          {
            key: "2025-26-archive",
            label: "2025–26",
            gp: profile.archiveLine.gamesPlayed,
            g: profile.archiveLine.goals,
            a: profile.archiveLine.assists,
            pts: profile.archiveLine.points,
          },
        ]
      : []),
  ];

  const videos = videosData as VideoItem[];
  const clips = matchPlayerFilm(videos, [profile.name, profile.archiveLine?.player]);
  const visibleClips = clips.slice(0, 6);

  return (
    <section className="space-y-10">
      <div>
        <Link
          href="/players"
          className="text-xs font-medium text-neutral-500 underline underline-offset-4 transition hover:text-neutral-900"
        >
          ← Players
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-neutral-900 md:text-4xl">{profile.name}</h1>
          <RankBadge rank={profile.rank} />
          <PositionBadge position={profile.position} />
        </div>

        <div className="mt-3 flex items-center gap-2.5">
          {profile.teamName ? (
            <>
              {teamLogo(profile.teamName) ? <TeamLogo name={profile.teamName} size={24} /> : null}
              <TeamPill name={profile.teamName} />
            </>
          ) : (
            <span className="text-sm font-medium text-neutral-400">Awaiting draft</span>
          )}
        </div>
      </div>

      {isGoalie ? (
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Career</h2>
          {profile.goalieCareer.length === 0 && !profile.archiveLine ? (
            <div className="glass-card mt-4 rounded-3xl p-8 text-center">
              <p className="text-sm text-neutral-500">First season on record starts this fall.</p>
            </div>
          ) : (
            <>
              {profile.goalieCareer.length > 0 ? (
                <div className="glass-card mt-4 overflow-x-auto rounded-3xl">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
                      <tr>
                        <th className="px-4 py-3">Season</th>
                        <th className="px-4 py-3">GP</th>
                        <th className="px-4 py-3">W</th>
                        <th className="px-4 py-3">L</th>
                        <th className="px-4 py-3">T</th>
                        <th className="px-4 py-3">GA</th>
                        <th className="px-4 py-3">GAA</th>
                        <th className="px-4 py-3">SO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.goalieCareer.map((r: PlayerGoalieCareerRow) => (
                        <tr key={`${r.seasonId}-${r.gameType}`} className="border-t border-black/5 text-neutral-700">
                          <td className="px-4 py-3 font-semibold text-neutral-900">
                            {r.gameType === "playoff" ? `${r.seasonLabel} · Playoffs` : r.seasonLabel}
                          </td>
                          <td className="px-4 py-3">{r.gp}</td>
                          <td className="px-4 py-3">{r.wins}</td>
                          <td className="px-4 py-3">{r.losses}</td>
                          <td className="px-4 py-3">{r.ties}</td>
                          <td className="px-4 py-3">{r.goalsAgainst}</td>
                          <td className="px-4 py-3 font-semibold text-neutral-900">{r.gaa.toFixed(2)}</td>
                          <td className="px-4 py-3">{r.shutouts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="glass-card mt-4 rounded-3xl p-8 text-center">
                  <p className="text-sm text-neutral-500">First season in net starts this fall.</p>
                </div>
              )}
              {profile.archiveLine ? (
                <p className="mt-3 text-xs text-neutral-500">
                  2025–26 (recorded as a skater, before goalie tracking): {profile.archiveLine.gamesPlayed} GP,{" "}
                  {profile.archiveLine.goals}G, {profile.archiveLine.assists}A, {profile.archiveLine.points} PTS
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : (
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Career</h2>
        {displayRows.length === 0 ? (
          <div className="glass-card mt-4 rounded-3xl p-8 text-center">
            <p className="text-sm text-neutral-500">First season on record starts this fall.</p>
          </div>
        ) : (
          <>
            <div className="glass-card mt-4 overflow-hidden rounded-3xl md:hidden">
              <div className="grid grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] gap-2 border-b border-black/5 bg-neutral-50/90 px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                <p>Season</p>
                <p className="text-center">GP</p>
                <p className="text-center">G</p>
                <p className="text-center">A</p>
                <p className="text-center">PTS</p>
              </div>
              <div className="divide-y divide-black/5">
                {displayRows.map((r) => (
                  <div
                    key={r.key}
                    className="grid grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] gap-2 px-3 py-3 text-xs text-neutral-700"
                  >
                    <p className="truncate font-semibold text-neutral-900">{r.label}</p>
                    <p className="text-center">{r.gp}</p>
                    <p className="text-center">{r.g}</p>
                    <p className="text-center">{r.a}</p>
                    <p className="text-center font-semibold text-neutral-900">{r.pts}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card mt-4 hidden overflow-x-auto rounded-3xl md:block">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-neutral-50/90 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Season</th>
                    <th className="px-4 py-3">GP</th>
                    <th className="px-4 py-3">G</th>
                    <th className="px-4 py-3">A</th>
                    <th className="px-4 py-3">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r) => (
                    <tr key={r.key} className="border-t border-black/5 text-neutral-700">
                      <td className="px-4 py-3 font-semibold text-neutral-900">{r.label}</td>
                      <td className="px-4 py-3">{r.gp}</td>
                      <td className="px-4 py-3">{r.g}</td>
                      <td className="px-4 py-3">{r.a}</td>
                      <td className="px-4 py-3 font-semibold text-neutral-900">{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      )}

      {isGoalie && profile.goalieGameLog.length > 0 ? (
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Game log</h2>
          <div className="glass-card mt-4 divide-y divide-black/5 overflow-hidden rounded-3xl">
            {profile.goalieGameLog.map((g) => (
              <Link
                key={g.gameId}
                href={`/games/${g.gameId}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-neutral-50/80"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{g.matchup}</p>
                  <p className="text-xs text-neutral-500">{formatGameDate(g.date)}</p>
                </div>
                <p className="shrink-0 text-sm text-neutral-600">
                  <span className={`font-semibold ${g.result === "W" ? "text-neutral-900" : "text-neutral-500"}`}>{g.result}</span>
                  {" · "}
                  {g.goalsAgainst} GA
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {!isGoalie && profile.gameLog.length > 0 ? (
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Game log</h2>
          <div className="glass-card mt-4 divide-y divide-black/5 overflow-hidden rounded-3xl">
            {profile.gameLog.map((g) => (
              <Link
                key={g.gameId}
                href={`/games/${g.gameId}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-neutral-50/80"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{g.matchup}</p>
                  <p className="text-xs text-neutral-500">{formatGameDate(g.date)}</p>
                </div>
                <p className="shrink-0 text-sm text-neutral-600">
                  {g.goals}G, {g.assists}A
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {visibleClips.length > 0 ? (
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Clips</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleClips.map((video) => (
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
          {clips.length > 6 ? (
            <a
              href="https://www.youtube.com/@outlawhockeyleague9642"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 underline underline-offset-4 transition hover:text-neutral-900"
            >
              More on YouTube →
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
