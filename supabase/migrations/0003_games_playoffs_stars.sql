-- Game pages, three stars, playoff brackets.
-- Playoff games are excluded from regular-season standings/stats by game_type.

alter table games add column game_type text not null default 'regular'
  check (game_type in ('regular', 'playoff'));
alter table games add column series_id uuid;

create table playoff_series (
  id uuid primary key default gen_random_uuid(),
  season_id text not null references seasons(id),
  round int not null,
  name text not null,
  position int not null default 1,
  team_a uuid references teams(id),
  team_b uuid references teams(id),
  best_of int not null default 3,
  winner_team_id uuid references teams(id),
  created_at timestamptz not null default now()
);

alter table games add constraint games_series_fk
  foreign key (series_id) references playoff_series(id) on delete set null;

create table game_stars (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id),
  star int not null check (star between 1 and 3),
  unique (game_id, star),
  unique (game_id, player_id)
);

alter table playoff_series enable row level security;
alter table game_stars enable row level security;
create policy "public read playoff_series" on playoff_series for select using (true);
create policy "public read game_stars" on game_stars for select using (true);
