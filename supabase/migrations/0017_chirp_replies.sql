-- Replies on the chirp board. A reply is a chirp with a parent; one level only,
-- enforced in the API (a reply's parent must itself be top-level).
alter table chirps add column parent_id uuid references chirps(id) on delete cascade;
create index chirps_parent_time on chirps (parent_id, created_at);
