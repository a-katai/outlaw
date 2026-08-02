-- Undo was silently un-pausing the draft: undo_last_pick set status='live'
-- unconditionally. Preserve 'paused'; only 'complete' rolls back to 'live'.
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
  update drafts set
    current_pick = v_last.pick_number,
    status = case when status = 'complete' then 'live' else status end
  where id = p_draft_id;
  return json_build_object('ok', true, 'undone_pick', v_last.pick_number);
end;
$$;
revoke execute on function undo_last_pick(uuid) from anon, authenticated;
