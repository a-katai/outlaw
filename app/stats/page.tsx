import type { Metadata } from "next";
import { getSeason } from "@/lib/league-data";
import { getSeasonCatalogue, getSeasonLive } from "@/lib/live-season";
import { StatsView, type StatsSeasonViewModel } from "./stats-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stats — Outlaw Hockey League",
  description: "Standings, skater stats, and rosters for every Outlaw Hockey League season.",
};

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const catalogue = await getSeasonCatalogue();

  // Default order matches getSeasonCatalogue: active DB season, else newest
  // DB season, else newest static entry.
  const selectedId = params.season ?? catalogue[0]?.id ?? "2025-26";

  // Resolve against DB seasons first (any status — active/complete/upcoming
  // all render), then fall back to the static archive.
  const dbSeason = await getSeasonLive(selectedId);

  let season: StatsSeasonViewModel;
  if (dbSeason) {
    season = {
      id: dbSeason.id,
      label: dbSeason.label,
      standings: dbSeason.standings,
      skaters: dbSeason.skaters,
      goalies: dbSeason.goalies,
      teams: dbSeason.teams,
      rosters: dbSeason.rosters,
      hasFinalGames: dbSeason.games.some((g) => g.status === "final" && g.gameType === "regular"),
    };
  } else {
    const staticSeason = getSeason(selectedId);
    // Unknown/garbage ?season= (neither a DB season nor a static one) —
    // don't reflect the raw query string into the page; label it plainly.
    season = staticSeason ?? {
      id: selectedId,
      label: "Season not found",
      standings: [],
      skaters: [],
      teams: undefined,
      rosters: undefined,
      hasFinalGames: undefined,
    };
  }

  return <StatsView season={season} catalogue={catalogue} />;
}
