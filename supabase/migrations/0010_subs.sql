-- Standing sub list. A sub is a player who isn't drafted but can dress for
-- any team; their stats aggregate under "Sub" rather than a team.
alter table players add column if not exists is_sub boolean not null default false;
