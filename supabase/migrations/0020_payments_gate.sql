-- Card checkout is password-gated (access_codes role 'payments').
-- Failed password guesses, per IP, for the login rate limit. Service-role only.
create table if not exists payment_login_failures (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists payment_login_failures_ip_created on payment_login_failures (ip, created_at);
alter table payment_login_failures enable row level security;
-- no policies: service-role only.
