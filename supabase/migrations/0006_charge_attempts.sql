-- Rate-limit ledger for the public card endpoint (card-testing defense).
create table charge_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);
create index charge_attempts_ip_time on charge_attempts (ip, created_at);
alter table charge_attempts enable row level security;
-- No policies: service-role only.
