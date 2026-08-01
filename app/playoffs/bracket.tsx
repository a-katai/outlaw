import Link from "next/link";
import type { PlayoffBracket, PlayoffSeriesView } from "@/lib/live-season";
import { getTeamColors } from "@/lib/league-data";

// --- Shared helpers ---------------------------------------------------

function formatChipDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const date = new Date(2000, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ORDINAL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" };

/** The fixed fall format: round 1 = play-in, round 2 = semis (2 series), round 3 = final. */
function fixedSeed(round: number, position: number, slot: "a" | "b"): number | null {
  if (round === 1 && position === 1) return slot === "a" ? 4 : 5;
  if (round === 2 && position === 1) return slot === "a" ? 1 : null; // b = play-in winner, no fixed seed
  if (round === 2 && position === 2) return slot === "a" ? 2 : 3;
  return null;
}

/** True when the bracket's rounds are a subset of the fixed 3-round fall shape
 * (round 1: ≤1 series, round 2: ≤2 series at positions 1/2, round 3: ≤1 series).
 * A future format change (different round/position counts) falls through to
 * the generic column renderer instead of forcing a mismatched layout. */
function fitsFixedFormat(bracket: PlayoffBracket | null): boolean {
  if (!bracket || bracket.rounds.length === 0) return true;
  for (const r of bracket.rounds) {
    if (![1, 2, 3].includes(r.round)) return false;
    if (r.round === 1 && r.series.length > 1) return false;
    if (r.round === 3 && r.series.length > 1) return false;
    if (r.round === 2) {
      if (r.series.length > 2) return false;
      if (r.series.some((s) => s.position !== 1 && s.position !== 2)) return false;
      // Two series colliding on the same position (e.g. an admin left both
      // semifinals at the position-1 default) would silently drop one from
      // the fixed layout — fall through to the generic renderer instead.
      if (new Set(r.series.map((s) => s.position)).size !== r.series.length) return false;
    }
  }
  return true;
}

function findSeries(bracket: PlayoffBracket | null, round: number, position: number): PlayoffSeriesView | null {
  const r = bracket?.rounds.find((rr) => rr.round === round);
  return r?.series.find((s) => s.position === position) ?? null;
}

// --- Team row ------------------------------------------------------------

function SlotRow({
  name,
  fixedSeedNumber,
  wins,
  isWinner,
  isDecided,
}: {
  name: string | null;
  fixedSeedNumber: number | null;
  wins: number | null;
  isWinner: boolean;
  isDecided: boolean;
}) {
  if (!name) {
    const label = fixedSeedNumber ? ORDINAL[fixedSeedNumber] : "TBD";
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2">
        <span className="inline-flex items-center rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-400">
          {label}
        </span>
      </div>
    );
  }

  const colors = getTeamColors(name);
  const dimmed = isDecided && !isWinner;

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${
        isWinner ? "bg-amber-50" : ""
      } ${dimmed ? "opacity-50" : ""}`}
    >
      <span className="flex items-center gap-1.5">
        {fixedSeedNumber ? <span className="text-[10px] font-medium text-neutral-400">{fixedSeedNumber}</span> : null}
        <span
          className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
          style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
        >
          {name}
        </span>
      </span>
      {wins !== null ? (
        <span className={`text-sm font-semibold tabular-nums ${isWinner ? "text-amber-700" : "text-neutral-500"}`}>{wins}</span>
      ) : null}
    </div>
  );
}

// --- Series box ------------------------------------------------------------

type SeriesBoxProps = {
  /** Round/matchup label shown when no real series row (or blank name) exists yet. */
  roundLabel: string;
  /** best_of to assume before a real series row (with its own best_of) is on file. */
  fallbackBestOf: number;
  series: PlayoffSeriesView | null;
  round: number;
  position: number;
};

function SeriesBox({ roundLabel, fallbackBestOf, series, round, position }: SeriesBoxProps) {
  const decided = Boolean(series?.winnerTeamId);
  const bestOf = series?.bestOf ?? fallbackBestOf;
  const label = series?.name?.trim() || roundLabel;
  const showSeriesScore = bestOf > 1 && series && (series.teamAWins > 0 || series.teamBWins > 0 || decided);

  return (
    <div className="glass-card w-full rounded-3xl p-5 md:w-64">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-400">Best of {bestOf}</p>
      <div className="mt-3 space-y-2">
        <SlotRow
          name={series?.teamAName ?? null}
          fixedSeedNumber={fixedSeed(round, position, "a")}
          wins={series ? series.teamAWins : null}
          isWinner={decided && series?.winnerTeamId === series?.teamAId}
          isDecided={decided}
        />
        <SlotRow
          name={series?.teamBName ?? null}
          fixedSeedNumber={fixedSeed(round, position, "b")}
          wins={series ? series.teamBWins : null}
          isWinner={decided && series?.winnerTeamId === series?.teamBId}
          isDecided={decided}
        />
      </div>

      {showSeriesScore ? (
        <p className="mt-3 text-xs font-semibold text-neutral-500">
          Series {series!.teamAWins}–{series!.teamBWins}
        </p>
      ) : null}

      {series && series.games.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {series.games.map((g, i) => (
            <Link
              key={g.id}
              href={`/games/${g.id}`}
              className="rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-600 transition hover:border-black/20 hover:text-neutral-900"
            >
              G{i + 1} · {formatChipDate(g.date)}
              {g.status === "final" ? ` ${g.awayScore}–${g.homeScore}` : ""}
            </Link>
          ))}
        </div>
      ) : null}

      {series?.winnerTeamId ? (
        <p className="mt-3 text-xs font-semibold text-amber-700">{series.winnerTeamName} wins</p>
      ) : null}
    </div>
  );
}

// --- Champion column ------------------------------------------------------------

// Takes the round-3 (final) series directly rather than bracket.champion —
// that field is derived from the DB's *highest existing round*, which is
// round 2 (semis) until an admin creates the round-3 series row. Keying off
// the final directly means the Champion column can only ever go gold once
// the championship series itself has a winner_team_id, per spec.
function ChampionBox({ final }: { final: PlayoffSeriesView | null }) {
  const championName = final?.winnerTeamId ? final.winnerTeamName : null;
  const colors = championName ? getTeamColors(championName) : null;

  return (
    <div
      className={`glass-card w-full rounded-3xl p-5 text-center md:w-64 ${
        championName ? "bg-gradient-to-br from-amber-50 to-white" : ""
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${championName ? "text-amber-700" : "text-neutral-500"}`}>
        Champion
      </p>
      <div className="mt-4 flex items-center justify-center">
        {championName && colors ? (
          <span
            className="inline-flex items-center rounded-full border px-4 py-2 text-base font-semibold"
            style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
          >
            {championName}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-400">
            TBD
          </span>
        )}
      </div>
    </div>
  );
}

// --- Fixed fall-format bracket (play-in → semis → championship → champion) --

function FixedBracket({ bracket }: { bracket: PlayoffBracket | null }) {
  const playIn = findSeries(bracket, 1, 1);
  const semi1 = findSeries(bracket, 2, 1);
  const semi2 = findSeries(bracket, 2, 2);
  const final = findSeries(bracket, 3, 1);

  const line = <span className="absolute inset-x-0 top-1/2 h-px bg-black/10" aria-hidden />;

  return (
    <>
      {/* Desktop / tablet: 4 columns joined by connector lines on a shared grid. */}
      <div
        className="hidden md:grid md:items-stretch md:gap-x-0 md:gap-y-6"
        style={{ gridTemplateColumns: "16rem 2rem 16rem 2rem 16rem 2rem 16rem", gridTemplateRows: "auto auto" }}
      >
        <div className="col-start-1 row-start-1 space-y-4 self-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Play-In</p>
          <SeriesBox roundLabel="Play-In" fallbackBestOf={1} series={playIn} round={1} position={1} />
        </div>
        <div className="relative col-start-2 row-start-1 row-span-1 self-stretch">
          {/* Aims into semifinal 1's second (lower) slot, not the box's vertical center. */}
          <span className="absolute inset-x-0 top-2/3 h-px bg-black/10" aria-hidden />
        </div>

        <div className="col-start-3 row-start-1 space-y-4 self-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Semifinals</p>
          <SeriesBox roundLabel="Semifinal 1" fallbackBestOf={1} series={semi1} round={2} position={1} />
        </div>
        <div className="col-start-3 row-start-2 self-center">
          <SeriesBox roundLabel="Semifinal 2" fallbackBestOf={1} series={semi2} round={2} position={2} />
        </div>
        <div className="relative col-start-4 row-start-1 row-span-2 self-stretch">
          <span className="absolute left-0 top-1/4 h-px w-1/2 bg-black/10" aria-hidden />
          <span className="absolute left-1/2 top-1/4 bottom-1/4 w-px bg-black/10" aria-hidden />
          <span className="absolute left-1/2 top-1/2 h-px w-1/2 bg-black/10" aria-hidden />
          <span className="absolute left-0 bottom-1/4 h-px w-1/2 bg-black/10" aria-hidden />
        </div>

        <div className="col-start-5 row-start-1 row-span-2 space-y-4 self-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Championship</p>
          <SeriesBox roundLabel="Championship" fallbackBestOf={3} series={final} round={3} position={1} />
        </div>
        <div className="relative col-start-6 row-start-1 row-span-2 self-stretch">{line}</div>

        <div className="col-start-7 row-start-1 row-span-2 space-y-4 self-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Champion</p>
          <ChampionBox final={final} />
        </div>
      </div>

      {/* Mobile: stacked rounds, no connector lines, no horizontal scroll. */}
      <div className="space-y-8 md:hidden">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Play-In</p>
          <SeriesBox roundLabel="Play-In" fallbackBestOf={1} series={playIn} round={1} position={1} />
        </div>
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Semifinals</p>
          <div className="space-y-4">
            <SeriesBox roundLabel="Semifinal 1" fallbackBestOf={1} series={semi1} round={2} position={1} />
            <SeriesBox roundLabel="Semifinal 2" fallbackBestOf={1} series={semi2} round={2} position={2} />
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Championship</p>
          <SeriesBox roundLabel="Championship" fallbackBestOf={3} series={final} round={3} position={1} />
        </div>
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Champion</p>
          <ChampionBox final={final} />
        </div>
      </div>
    </>
  );
}

// --- Generic fallback (arbitrary round shapes that don't fit the fixed format) --

function GenericSeriesCard({ series }: { series: PlayoffSeriesView }) {
  const decided = Boolean(series.winnerTeamId);
  return (
    <div className="glass-card w-72 shrink-0 rounded-3xl p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Best of {series.bestOf}</p>
      <div className="mt-3 space-y-2">
        <SlotRow
          name={series.teamAName}
          fixedSeedNumber={null}
          wins={series.teamAWins}
          isWinner={decided && series.winnerTeamId === series.teamAId}
          isDecided={decided}
        />
        <SlotRow
          name={series.teamBName}
          fixedSeedNumber={null}
          wins={series.teamBWins}
          isWinner={decided && series.winnerTeamId === series.teamBId}
          isDecided={decided}
        />
      </div>

      {series.games.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {series.games.map((g, i) => (
            <Link
              key={g.id}
              href={`/games/${g.id}`}
              className="rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-600 transition hover:border-black/20 hover:text-neutral-900"
            >
              G{i + 1} · {formatChipDate(g.date)}
              {g.status === "final" ? ` ${g.awayScore}–${g.homeScore}` : ""}
            </Link>
          ))}
        </div>
      ) : null}

      {series.winnerTeamId ? <p className="mt-3 text-xs font-semibold text-amber-700">{series.winnerTeamName} wins</p> : null}
    </div>
  );
}

function GenericBracket({ bracket }: { bracket: PlayoffBracket }) {
  return (
    <div className="-mx-6 overflow-x-auto px-6 md:-mx-8 md:px-8">
      <div className="flex gap-6" style={{ minWidth: "max-content" }}>
        {bracket.rounds.map((round) => (
          <div key={round.round} className="w-72 shrink-0 space-y-4">
            <h2 className="text-lg font-semibold text-neutral-900">{round.name}</h2>
            <div className="space-y-4">
              {round.series.map((s) => (
                <GenericSeriesCard key={s.id} series={s} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Entry point ------------------------------------------------------------

export function PlayoffBracketView({ bracket }: { bracket: PlayoffBracket | null }) {
  if (fitsFixedFormat(bracket)) {
    return <FixedBracket bracket={bracket} />;
  }
  return <GenericBracket bracket={bracket!} />;
}
