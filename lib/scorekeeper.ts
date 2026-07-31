import "server-only";
import { createAdminClient } from "./supabase-admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * goal_events is the single source of truth for a scorekeeper-run game.
 * Call this after every goal_events mutation (add/remove) and around
 * start/end/reopen for safety: recomputes games.home_score/away_score and
 * rebuilds that game's game_stats aggregate rows (goals = scorer count,
 * assists = assist count per player), dropping rows for players no longer
 * referenced by any remaining goal_events.
 */
export async function recomputeGame(
  supabase: AdminClient,
  gameId: string,
): Promise<{ homeScore: number; awayScore: number } | null> {
  const { data: game } = await supabase
    .from("games")
    .select("id,home_team_id,away_team_id")
    .eq("id", gameId)
    .maybeSingle();
  if (!game) return null;

  const { data: eventsData } = await supabase
    .from("goal_events")
    .select("team_id,scorer_id,assist_id")
    .eq("game_id", gameId);
  const events = eventsData ?? [];

  const homeScore = events.filter((e) => e.team_id === game.home_team_id).length;
  const awayScore = events.filter((e) => e.team_id === game.away_team_id).length;

  await supabase.from("games").update({ home_score: homeScore, away_score: awayScore }).eq("id", gameId);

  type Agg = { teamId: string; goals: number; assists: number };
  const aggByPlayer = new Map<string, Agg>();
  for (const e of events) {
    if (e.scorer_id) {
      const cur = aggByPlayer.get(e.scorer_id) ?? { teamId: e.team_id, goals: 0, assists: 0 };
      cur.goals += 1;
      cur.teamId = e.team_id;
      aggByPlayer.set(e.scorer_id, cur);
    }
    if (e.assist_id) {
      const cur = aggByPlayer.get(e.assist_id) ?? { teamId: e.team_id, goals: 0, assists: 0 };
      cur.assists += 1;
      cur.teamId = e.team_id;
      aggByPlayer.set(e.assist_id, cur);
    }
  }

  const { data: existingStats } = await supabase.from("game_stats").select("player_id").eq("game_id", gameId);
  const keepIds = new Set(aggByPlayer.keys());
  const toDelete = (existingStats ?? []).map((r) => r.player_id).filter((id) => !keepIds.has(id));
  if (toDelete.length) {
    await supabase.from("game_stats").delete().eq("game_id", gameId).in("player_id", toDelete);
  }
  if (aggByPlayer.size) {
    await supabase.from("game_stats").upsert(
      Array.from(aggByPlayer.entries()).map(([playerId, agg]) => ({
        game_id: gameId,
        player_id: playerId,
        team_id: agg.teamId,
        goals: agg.goals,
        assists: agg.assists,
      })),
      { onConflict: "game_id,player_id" },
    );
  }

  return { homeScore, awayScore };
}
