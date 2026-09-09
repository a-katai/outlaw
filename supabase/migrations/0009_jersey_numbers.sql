-- Jersey numbers, claimed per player for the season. Drives stat sheets
-- and gives the scorekeeper a number to match against what the refs call.
alter table players add column if not exists jersey_number smallint
  check (jersey_number between 0 and 99);
