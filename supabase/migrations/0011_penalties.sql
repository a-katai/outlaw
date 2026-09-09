-- Penalties, logged live by the scorekeeper alongside goals.
create table penalty_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id),
  player_id uuid references players(id),
  infraction text not null,
  minutes smallint not null default 2 check (minutes between 1 and 30),
  created_at timestamptz not null default now()
);

alter table penalty_events enable row level security;
create policy "public read penalty_events" on penalty_events for select using (true);
-- Writes: service-role only via scorekeeper routes.
alter publication supabase_realtime add table penalty_events;
