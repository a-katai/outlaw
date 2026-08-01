-- Draft prep: ranking tiers (1 = best) and hybrid F/D position.
alter table players drop constraint players_position_check;
alter table players add constraint players_position_check
  check (position in ('F', 'D', 'G', 'F/D'));
alter table players add column rank int check (rank between 1 and 20);
