-- OHL Chirp — the anonymous chirp box under the Wall of Shame.
--
-- Anyone can read the board; nobody writes to it directly. Inserts go through
-- /api/chirp with the service role so the rate limit and the length caps can't
-- be skipped by talking to PostgREST with the anon key (this repo is public).
create table chirps (
  id uuid primary key default gen_random_uuid(),
  handle text,
  body text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint chirps_body_len check (char_length(body) between 1 and 280),
  constraint chirps_handle_len check (handle is null or char_length(handle) between 1 and 24)
);
create index chirps_visible_time on chirps (hidden, created_at desc);

alter table chirps enable row level security;

-- Public read of the visible board only. No insert/update/delete policy, so
-- every write is service-role (the API route + the admin hide lever).
create policy "chirps are publicly readable" on chirps
  for select using (hidden = false);

-- Rate-limit ledger, same shape as charge_attempts. The caller's IP is stored
-- hashed — the board is anonymous and the raw address never needs to exist.
create table chirp_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index chirp_attempts_ip_time on chirp_attempts (ip_hash, created_at);
alter table chirp_attempts enable row level security;
-- No policies: service-role only.
