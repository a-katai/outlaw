import { getSeason } from "@/lib/league-data";
import { getActiveSeasonLive, getSeasonCatalogue } from "@/lib/live-season";
import { StatsView, type StatsSeasonViewModel } from "./stats-view";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const [catalogue, live] = await Promise.all([getSeasonCatalogue(), getActiveSeasonLive()]);

  const selectedId = params.season ?? catalogue[0]?.id ?? "2025-26";
  const isLiveSelected = Boolean(live && selectedId === live.id);

  let season: StatsSeasonViewModel;
  if (isLiveSelected && live) {
    season = {
      id: live.id,
      label: live.label,
      standings: live.standings,
      skaters: live.skaters,
      teams: live.teams,
      rosters: live.rosters,
      hasFinalGames: live.games.some((g) => g.status === "final" && g.gameType === "regular"),
    };
  } else {
    const staticSeason = getSeason(selectedId);
    season = staticSeason ?? {
      id: live?.id ?? "2025-26",
      label: live?.label ?? "2025–26",
      standings: live?.standings ?? [],
      skaters: live?.skaters ?? [],
      teams: live?.teams,
      rosters: live?.rosters,
      hasFinalGames: live ? live.games.some((g) => g.status === "final" && g.gameType === "regular") : undefined,
    };
  }

  return <StatsView season={season} catalogue={catalogue} />;
}
