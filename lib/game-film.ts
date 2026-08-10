import type { VideoItem } from "@/app/components/video-gallery";

/**
 * Date strings a video title might carry for a given ISO game date:
 * zero-padded MM-DD-YYYY and zero-stripped M-D-YYYY.
 */
function dateVariants(iso: string): string[] {
  const [y, m, d] = iso.split("-");
  const month = Number(m);
  const day = Number(d);
  if (!y || !Number.isFinite(month) || !Number.isFinite(day)) return [];
  const pad = (n: number) => n.toString().padStart(2, "0");
  const padded = `${pad(month)}-${pad(day)}-${y}`;
  const stripped = `${month}-${day}-${y}`;
  return Array.from(new Set([padded, stripped]));
}

/** A team name and its trailing-"s"-stripped form, e.g. "Toe Dragons" -> "Toe Dragon". */
function nameVariants(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const variants = [trimmed];
  if (/s$/i.test(trimmed)) variants.push(trimmed.slice(0, -1));
  return variants;
}

/**
 * Matches league YouTube videos to a game: title must contain the game date
 * (MM-DD-YYYY or M-D-YYYY) AND at least one of the two team names
 * (case-insensitive, trailing "s" optional). Pure function — no I/O.
 */
export function matchGameFilm(
  videos: VideoItem[],
  game: { date: string; homeTeam: string; awayTeam: string },
): VideoItem[] {
  const dates = dateVariants(game.date);
  if (dates.length === 0) return [];

  const teamNeedles = [...nameVariants(game.homeTeam), ...nameVariants(game.awayTeam)].map((n) => n.toLowerCase());
  if (teamNeedles.length === 0) return [];

  return videos.filter((video) => {
    const title = video.title.toLowerCase();
    const dateMatch = dates.some((d) => title.includes(d));
    if (!dateMatch) return false;
    return teamNeedles.some((needle) => title.includes(needle));
  });
}

/**
 * Matches league YouTube videos whose title or matchup mentions a team by
 * name (case-insensitive substring, trailing "s" optional — same rule as
 * matchGameFilm's team check). Pure function — no I/O.
 */
export function matchTeamFilm(videos: VideoItem[], teamName: string): VideoItem[] {
  const needles = nameVariants(teamName).map((n) => n.toLowerCase());
  if (needles.length === 0) return [];
  return videos.filter((video) => {
    const haystack = `${video.title} ${video.matchup}`.toLowerCase();
    return needles.some((needle) => haystack.includes(needle));
  });
}

/**
 * Matches league YouTube videos whose title mentions a player by full name
 * (case-insensitive substring). Pass both the site name and, if the player
 * has an archive alias, that alias — some older clips use the archive
 * spelling. Pure function — no I/O.
 */
export function matchPlayerFilm(videos: VideoItem[], names: (string | null | undefined)[]): VideoItem[] {
  const needles = Array.from(
    new Set(names.filter((n): n is string => Boolean(n && n.trim())).map((n) => n.trim().toLowerCase())),
  );
  if (needles.length === 0) return [];
  return videos.filter((video) => {
    const title = video.title.toLowerCase();
    return needles.some((needle) => title.includes(needle));
  });
}
