-- Pre-game roster submission: who dressed for each game.
-- GP credit derives from these rows (union'd with scoring rows), so
-- non-scoring skaters get games-played once checked in.

create table game_rosters (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id),
  team_id uuid not null references teams(id),
  created_at timestamptz not null default now(),
  unique (game_id, player_id)
);

alter table game_rosters enable row level security;
create policy "public read game_rosters" on game_rosters for select using (true);
-- Writes: service-role only via scorekeeper/admin routes.
