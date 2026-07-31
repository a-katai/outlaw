export type SeasonStatus = "upcoming" | "active" | "complete";

export type SeasonRow = {
  id: string;
  label: string;
  status: SeasonStatus;
  created_at: string;
};

export type SeasonAdminTeam = {
  id: string;
  name: string;
  color: string | null;
  captain_player_id: string | null;
  draft_order: number | null;
  season_id: string | null;
  created_at: string;
};

export type SeasonAdminPlayer = { id: string; name: string };

export type SeasonAdminPick = { team_id: string; player_id: string };

export type SeasonAdminGame = {
  id: string;
  season_id: string;
  game_date: string;
  game_time: string | null;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "live" | "final";
  note: string | null;
  game_type: "regular" | "playoff";
  series_id: string | null;
  created_at: string;
};

export type SeasonAdminGameStat = {
  id: string;
  game_id: string;
  player_id: string;
  team_id: string;
  goals: number;
  assists: number;
};

export type SeasonAdminSeries = {
  id: string;
  season_id: string;
  round: number;
  name: string;
  position: number;
  team_a: string | null;
  team_b: string | null;
  best_of: number;
  winner_team_id: string | null;
  created_at: string;
};

export type SeasonAdminState = {
  ok: true;
  seasons: SeasonRow[];
  activeSeason: SeasonRow | null;
  teams: SeasonAdminTeam[];
  players: SeasonAdminPlayer[];
  draftPicks: SeasonAdminPick[];
  games: SeasonAdminGame[];
  gameStats: SeasonAdminGameStat[];
  playoffSeries: SeasonAdminSeries[];
};

export async function fetchSeasonAdminState(): Promise<SeasonAdminState | null> {
  const res = await fetch("/api/admin/season", { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.ok) return null;
  return data as SeasonAdminState;
}
