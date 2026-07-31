-- Scorekeeper mode: live game status, goal-by-goal event log, rotatable
-- scorekeeper access code. Also removes the three-stars feature.

drop table if exists game_stars;

alter table games drop constraint games_status_check;
alter table games add constraint games_status_check
  check (status in ('scheduled', 'live', 'final'));

-- One row per goal as it happens; games.home/away_score and game_stats
-- aggregates are recomputed from these rows for scorekeeper-run games.
create table goal_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id),
  scorer_id uuid references players(id),
  assist_id uuid references players(id),
  created_at timestamptz not null default now()
);

-- Role-based access codes (scorekeeper today; extensible), admin-managed.
create table access_codes (
  role text primary key,
  code text not null,
  updated_at timestamptz not null default now()
);

alter table goal_events enable row level security;
alter table access_codes enable row level security;
create policy "public read goal_events" on goal_events for select using (true);
-- access_codes: no policies — service-role only.

alter publication supabase_realtime add table games, goal_events;
