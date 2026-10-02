-- Public injury note per player. null = healthy; text (e.g. "Broken leg · out indefinitely") shows an INJURY tag on the roster.
alter table players add column if not exists injury text;
