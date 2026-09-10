import { cache } from "react";
import { createBrowserClient } from "./supabase";

export type Star = {
  rank: number;
  playerId: string;
  playerName: string;
  team: string;
  opponent: string | null;
  gameId: string | null;
  goals: number;
  assists: number;
};

export type ThreeStars = { weekDate: string; stars: Star[] };

type StarRow = {
  rank: number;
  week_date: string;
  game_id: string | null;
  player: { id: string; name: string } | null;
  game: { id: string; home_team_id: string; away_team_id: string } | null;
};

/** The most recent week's three stars for a season, with each star's line from that game. */
export const getThreeStars = cache(async (seasonId: string): Promise<ThreeStars | null> => {
  const supabase = createBrowserClient();
  const { data: latest } = await supabase
    .from("three_stars")
    .select("week_date")
    .eq("season_id", seasonId)
    .order("week_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return null;

  const { data } = await supabase
    .from("three_stars")
    .select("rank,week_date,game_id,player:players(id,name),game:games(id,home_team_id,away_team_id)")
    .eq("season_id", seasonId)
    .eq("week_date", latest.week_date)
    .order("rank", { ascending: true });
  const rows = (data ?? []) as unknown as StarRow[];
  if (!rows.length) return null;

  const gameIds = rows.map((r) => r.game_id).filter((id): id is string => Boolean(id));
  const [teamsRes, statsRes] = await Promise.all([
    supabase.from("teams").select("id,name").eq("season_id", seasonId),
    gameIds.length
      ? supabase.from("game_stats").select("game_id,player_id,team_id,goals,assists").in("game_id", gameIds)
      : Promise.resolve({ data: [] as { game_id: string; player_id: string; team_id: string; goals: number; assists: number }[] }),
  ]);
  const teamName = new Map((teamsRes.data ?? []).map((t) => [t.id, t.name]));

  const stars: Star[] = rows
    .filter((r) => r.player)
    .map((r) => {
      const line = (statsRes.data ?? []).find((s) => s.game_id === r.game_id && s.player_id === r.player!.id);
      const teamId = line?.team_id ?? null;
      const opponentId = r.game && teamId ? (r.game.home_team_id === teamId ? r.game.away_team_id : r.game.home_team_id) : null;
      return {
        rank: r.rank,
        playerId: r.player!.id,
        playerName: r.player!.name,
        team: (teamId && teamName.get(teamId)) || "",
        opponent: (opponentId && teamName.get(opponentId)) || null,
        gameId: r.game_id,
        goals: line?.goals ?? 0,
        assists: line?.assists ?? 0,
      };
    });
  return { weekDate: latest.week_date, stars };
});
