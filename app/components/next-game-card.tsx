import Link from "next/link";
import { getTeamColors } from "@/lib/league-data";
import { TeamLogo, teamLogo } from "@/lib/team-logos";
import type { LiveGame } from "@/lib/live-season";

// Shared by /schedule (the full slate) and the home page (just the marquee) —
// one source of truth for "what does the next game look like."

/** Team logo when one is on file, otherwise the original color dot — used
 * everywhere a game row needs a compact team identifier next to the name. */
export function TeamMarker({ name, size, dotSize }: { name: string; size: number; dotSize: number }) {
  if (teamLogo(name)) return <TeamLogo name={name} size={size} />;
  const colors = getTeamColors(name);
  return (
    <span
      className="shrink-0 rounded-full"
      style={{ background: colors.border, width: dotSize, height: dotSize }}
      aria-hidden
    />
  );
}

export function formatGameDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/** "10:30 PM · Rink A" -> { time: "10:30 PM", rink: "Rink A" }. Tolerates a bare time with no rink. */
export function splitTimeRink(raw: string | null): { time: string | null; rink: string | null } {
  if (!raw) return { time: null, rink: null };
  const [time, ...rest] = raw.split("·").map((part) => part.trim());
  return { time: time || null, rink: rest.length ? rest.join(" · ") : null };
}

/** Minutes-since-midnight from a "10:30 PM"-style string, for same-date ordering. Unparseable times sort last. */
export function timeSortKey(raw: string | null): number {
  const match = raw?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return Infinity;
  let hour = Number(match[1]) % 12;
  if (/PM/i.test(match[3])) hour += 12;
  return hour * 60 + Number(match[2]);
}

export function sortChronological(list: LiveGame[]): LiveGame[] {
  return [...list].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : timeSortKey(a.time) - timeSortKey(b.time)));
}

export function PlayoffBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
      Playoff
    </span>
  );
}

/** W-L-T for a team, or null if the league hasn't started keeping score yet. */
export function recordFor(name: string, recordsByTeam: Map<string, string> | null): string | null {
  return recordsByTeam?.get(name) ?? null;
}

export function NextGameCard({ game, recordsByTeam }: { game: LiveGame; recordsByTeam: Map<string, string> | null }) {
  const { time, rink } = splitTimeRink(game.time);
  const awayRecord = recordFor(game.awayTeam, recordsByTeam);
  const homeRecord = recordFor(game.homeTeam, recordsByTeam);

  return (
    <Link href={`/games/${game.id}`} className="group glass-card lift block overflow-hidden rounded-3xl">
      <div className="p-6 sm:p-8 md:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Next game</p>
          {game.gameType === "playoff" ? <PlayoffBadge /> : null}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex items-center gap-2.5">
            <TeamMarker name={game.awayTeam} size={44} dotSize={12} />
            <span className="text-3xl font-semibold text-neutral-900 md:text-4xl">{game.awayTeam}</span>
            {awayRecord ? <span className="text-sm font-medium text-neutral-400">{awayRecord}</span> : null}
          </div>
          <span className="text-lg font-normal text-neutral-400 sm:text-xl">at</span>
          <div className="flex items-center gap-2.5">
            <TeamMarker name={game.homeTeam} size={44} dotSize={12} />
            <span className="text-3xl font-semibold text-neutral-900 md:text-4xl">{game.homeTeam}</span>
            {homeRecord ? <span className="text-sm font-medium text-neutral-400">{homeRecord}</span> : null}
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-end justify-between gap-6 border-t border-black/5 pt-6">
          <p className="text-sm font-medium text-neutral-500">{formatGameDate(game.date)}</p>
          <div className="text-right">
            {time ? (
              <p className="text-2xl font-semibold tabular-nums text-neutral-900 md:text-3xl">{time}</p>
            ) : (
              <p className="text-2xl font-semibold text-neutral-400 md:text-3xl">TBD</p>
            )}
            {rink ? <p className="mt-1 text-sm text-neutral-500">{rink}</p> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
