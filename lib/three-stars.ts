import { createBrowserClient } from "./supabase";

export type Star = {
  rank: number;
  playerId: string;
  playerName: string;
  team: string;
  goals: number;
  assists: number;
  /** Goalie star: goals against in that game (null for skaters). */
  goalsAgainst: number | null;
};

type StarRow = {
  rank: number;
  game_id: string | null;
  player: { id: string; name: string; position: string | null } | null;
  game: { id: string; home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null } | null;
};

/**
 * Three stars for each of the given games, keyed by game id and ordered 1→3.
 * Stars are awarded per game; a star's line comes from that game's stats and
 * a goalie (no scoring line) is placed on a team by the game roster.
 */
export async function getStarsForGames(gameIds: string[]): Promise<Map<string, Star[]>> {
  const out = new Map<string, Star[]>();
  if (!gameIds.length) return out;
  const supabase = createBrowserClient();

  const { data } = await supabase
    .from("three_stars")
    .select("rank,game_id,player:players(id,name,position),game:games(id,home_team_id,away_team_id,home_score,away_score)")
    .in("game_id", gameIds)
    .order("rank", { ascending: true });
  const rows = ((data ?? []) as unknown as StarRow[]).filter((r) => r.player && r.game_id && r.game);
  if (!rows.length) return out;

  const teamIds = Array.from(new Set(rows.flatMap((r) => [r.game!.home_team_id, r.game!.away_team_id])));
  const [teamsRes, rostersRes, statsRes] = await Promise.all([
    supabase.from("teams").select("id,name").in("id", teamIds),
    supabase.from("game_rosters").select("game_id,player_id,team_id").in("game_id", gameIds),
    supabase.from("game_stats").select("game_id,player_id,team_id,goals,assists").in("game_id", gameIds),
  ]);
  const teamName = new Map((teamsRes.data ?? []).map((t) => [t.id, t.name]));

  for (const r of rows) {
    const player = r.player!;
    const game = r.game!;
    const line = (statsRes.data ?? []).find((s) => s.game_id === r.game_id && s.player_id === player.id);
    const dressed = (rostersRes.data ?? []).find((g) => g.game_id === r.game_id && g.player_id === player.id);
    const teamId = line?.team_id ?? dressed?.team_id ?? null;
    const isGoalie = player.position === "G";
    const goalsAgainst = isGoalie && teamId ? (game.home_team_id === teamId ? game.away_score : game.home_score) : null;
    const star: Star = {
      rank: r.rank,
      playerId: player.id,
      playerName: player.name,
      team: (teamId && teamName.get(teamId)) || "",
      goals: line?.goals ?? 0,
      assists: line?.assists ?? 0,
      goalsAgainst,
    };
    const list = out.get(r.game_id!) ?? [];
    list.push(star);
    out.set(r.game_id!, list);
  }
  return out;
}
