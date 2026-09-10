-- Period on every goal and penalty, like the commissioner's sheet. 1–3, 4 = OT. Null = not recorded.
alter table goal_events add column if not exists period smallint check (period between 1 and 4);
alter table penalty_events add column if not exists period smallint check (period between 1 and 4);
