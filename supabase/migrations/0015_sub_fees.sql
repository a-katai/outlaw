-- Sub fees are a separate pool from league dues. One ledger, one column:
-- 'dues' rows count toward a player's season balance; 'sub' rows buy a spot
-- at the front of the sub line (paid subs are called first, in the order
-- they paid). Existing rows are all dues.
alter table payments
  add column if not exists kind text not null default 'dues'
  check (kind in ('dues', 'sub'));

create index if not exists payments_kind_idx on payments (kind);
