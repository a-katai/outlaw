-- Second assist. The commissioner's sheet tracks two per goal; so do we.
alter table goal_events add column if not exists assist2_id uuid references players(id);
