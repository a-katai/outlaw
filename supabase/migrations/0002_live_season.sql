-- Live season system: seasons, games, per-game player stats.
-- Standings are computed in the app from final games (W=2, T=1, pct = pts / 2GP,
-- matching the league's 2025-26 math).

create table seasons (
  id text primary key,
  label text not null,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'active', 'complete')),
  created_at timestamptz not null default now()
);

insert into seasons (id, label, status) values ('2026-27', '2026–27', 'active');

alter table teams add column season_id text references seasons(id);

create table games (
  id uuid primary key default gen_random_uuid(),
  season_id text not null references seasons(id),
  game_date date not null,
  game_time text,
  home_team_id uuid not null references teams(id),
  away_team_id uuid not null references teams(id),
  home_score int,
  away_score int,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'final')),
  note text,
  created_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  check (status <> 'final' or (home_score is not null and away_score is not null))
);

-- One row per player per game they appeared in; 0/0 counts as games played.
create table game_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id),
  team_id uuid not null references teams(id),
  goals int not null default 0 check (goals >= 0),
  assists int not null default 0 check (assists >= 0),
  unique (game_id, player_id)
);

alter table seasons enable row level security;
alter table games enable row level security;
alter table game_stats enable row level security;

create policy "public read seasons" on seasons for select using (true);
create policy "public read games" on games for select using (true);
create policy "public read game_stats" on game_stats for select using (true);
-- Writes: service-role only (admin API routes), same as the rest of the schema.
