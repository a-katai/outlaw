-- OHL Pick'em — weekly, free picks on each game: home, away, or tie.
--
-- No accounts. A picker is a player who claimed their name with a 4-digit PIN.
-- Nothing here is written by the browser: every insert/update goes through
-- /api/pickem with the service role, so the lock time, the PIN check and the
-- rate limit can't be skipped by talking to PostgREST with the anon key (this
-- repo is public).
create table pickers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references players(id),
  pin_hash text not null,
  created_at timestamptz not null default now()
);
alter table pickers enable row level security;
-- No policies: service-role only. pin_hash never leaves the server.

create table picks (
  id uuid primary key default gen_random_uuid(),
  picker_id uuid not null references pickers(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  pick text not null check (pick in ('home', 'away', 'tie')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (picker_id, game_id)
);
create index picks_game on picks (game_id);
alter table picks enable row level security;

-- Public read, but only once a game is final: the leaderboard is public, and
-- nobody should be able to read a teammate's pick before the result is in.
-- Writes: service-role only.
create policy "final picks are publicly readable" on picks
  for select using (
    exists (select 1 from games g where g.id = picks.game_id and g.status = 'final')
  );

-- Rate-limit ledger, same shape as chirp_attempts. One row per request; the IP
-- is stored hashed. `failed` marks a wrong PIN, and picker_id lets a distributed
-- guesser be stopped per name, not just per address.
create table pickem_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  picker_id uuid references pickers(id) on delete cascade,
  failed boolean not null default false,
  created_at timestamptz not null default now()
);
create index pickem_attempts_ip_time on pickem_attempts (ip_hash, created_at);
create index pickem_attempts_picker_time on pickem_attempts (picker_id, created_at) where failed;
alter table pickem_attempts enable row level security;
-- No policies: service-role only.
