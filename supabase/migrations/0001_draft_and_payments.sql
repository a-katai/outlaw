-- Outlaw Hockey League: live draft + payments ledger
-- Project: outlaw (cqltfdekmfxlsgrvxtlr)

create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position text check (position in ('F', 'D', 'G')),
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  captain_player_id uuid references players(id),
  draft_order int,
  created_at timestamptz not null default now()
);

-- Captain pick codes live apart from teams so RLS can expose teams publicly
-- without ever exposing a code.
create table team_codes (
  team_id uuid primary key references teams(id) on delete cascade,
  code text not null unique
);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Draft',
  format text not null default 'snake' check (format in ('snake', 'linear')),
  status text not null default 'setup' check (status in ('setup', 'live', 'paused', 'complete')),
  current_pick int not null default 1,
  total_rounds int not null default 10,
  created_at timestamptz not null default now()
);

create table draft_picks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts(id) on delete cascade,
  pick_number int not null,
  round int not null,
  team_id uuid not null references teams(id),
  player_id uuid not null references players(id),
  made_at timestamptz not null default now(),
  unique (draft_id, pick_number),
  unique (draft_id, player_id)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id),
  payer_name text,
  amount_cents int not null check (amount_cents > 0),
  method text not null default 'cash'
    check (method in ('cash', 'venmo', 'zelle', 'card', 'check', 'other')),
  season text,
  note text,
  paid_on date not null default current_date,
  created_at timestamptz not null default now(),
  check (player_id is not null or payer_name is not null)
);

-- Whose turn is it: derives the team on the clock from pick number + format.
create or replace function team_on_clock(p_draft_id uuid)
returns uuid
language sql stable as $$
  with d as (select format, current_pick from drafts where id = p_draft_id),
  n as (select count(*)::int as team_count from teams where draft_order is not null),
  pos as (
    select
      ((d.current_pick - 1) / n.team_count) + 1 as round,
      ((d.current_pick - 1) % n.team_count) + 1 as slot,
      d.format, n.team_count
    from d, n
  )
  select t.id from pos
  join teams t on t.draft_order =
    case
      when pos.format = 'snake' and pos.round % 2 = 0
        then pos.team_count - pos.slot + 1
      else pos.slot
    end;
$$;

-- Atomic pick: validates code + turn, inserts, advances the clock.
create or replace function make_pick(p_draft_id uuid, p_code text, p_player_id uuid)
returns json
language plpgsql security definer as $$
declare
  v_team uuid;
  v_on_clock uuid;
  v_draft drafts%rowtype;
  v_round int;
  v_team_count int;
begin
  select * into v_draft from drafts where id = p_draft_id for update;
  if v_draft.status <> 'live' then
    return json_build_object('ok', false, 'error', 'Draft is not live');
  end if;

  select team_id into v_team from team_codes where code = p_code;
  if v_team is null then
    return json_build_object('ok', false, 'error', 'Invalid code');
  end if;

  v_on_clock := team_on_clock(p_draft_id);
  if v_team <> v_on_clock then
    return json_build_object('ok', false, 'error', 'Not your pick');
  end if;

  if exists (select 1 from draft_picks where draft_id = p_draft_id and player_id = p_player_id) then
    return json_build_object('ok', false, 'error', 'Player already drafted');
  end if;

  select count(*)::int into v_team_count from teams where draft_order is not null;
  v_round := ((v_draft.current_pick - 1) / v_team_count) + 1;

  insert into draft_picks (draft_id, pick_number, round, team_id, player_id)
  values (p_draft_id, v_draft.current_pick, v_round, v_team, p_player_id);

  update drafts set
    current_pick = current_pick + 1,
    status = case
      when current_pick + 1 > total_rounds * v_team_count then 'complete'
      else status end
  where id = p_draft_id;

  return json_build_object('ok', true, 'pick', v_draft.current_pick);
end;
$$;

-- Commissioner undo: removes the last pick and rolls the clock back.
create or replace function undo_last_pick(p_draft_id uuid)
returns json
language plpgsql security definer as $$
declare
  v_last draft_picks%rowtype;
begin
  select * into v_last from draft_picks
  where draft_id = p_draft_id order by pick_number desc limit 1 for update;
  if v_last.id is null then
    return json_build_object('ok', false, 'error', 'No picks to undo');
  end if;
  delete from draft_picks where id = v_last.id;
  update drafts set current_pick = v_last.pick_number, status = 'live'
  where id = p_draft_id;
  return json_build_object('ok', true, 'undone_pick', v_last.pick_number);
end;
$$;

-- RLS: public read for draft-board data; codes and payments are server-only.
alter table players enable row level security;
alter table teams enable row level security;
alter table team_codes enable row level security;
alter table drafts enable row level security;
alter table draft_picks enable row level security;
alter table payments enable row level security;

create policy "public read players" on players for select using (true);
create policy "public read teams" on teams for select using (true);
create policy "public read drafts" on drafts for select using (true);
create policy "public read picks" on draft_picks for select using (true);
-- team_codes, payments: no policies — service-role only.

-- Functions execute via server routes only; block direct anon/authed calls.
revoke execute on function make_pick(uuid, text, uuid) from anon, authenticated;
revoke execute on function undo_last_pick(uuid) from anon, authenticated;
revoke execute on function team_on_clock(uuid) from anon, authenticated;

-- Realtime for the live board.
alter publication supabase_realtime add table drafts, draft_picks;
