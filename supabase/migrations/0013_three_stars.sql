-- Three stars of the week, picked by the league after each Wednesday night.
create table three_stars (
  id uuid primary key default gen_random_uuid(),
  season_id text not null references seasons(id) on delete cascade,
  week_date date not null,
  rank smallint not null check (rank between 1 and 3),
  player_id uuid not null references players(id) on delete cascade,
  game_id uuid references games(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (season_id, week_date, rank)
);

alter table three_stars enable row level security;
create policy "public read three_stars" on three_stars for select using (true);
-- Writes: service-role only.
