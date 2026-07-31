import { getCurrentSeason, getSeason } from "@/lib/league-data";
import { StatsView } from "./stats-view";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const season = (params.season && getSeason(params.season)) || getCurrentSeason();

  return <StatsView season={season} />;
}
