-- Three stars are awarded per game, not per week: each game gets its own 1–3.
alter table three_stars drop constraint if exists three_stars_season_id_week_date_rank_key;
alter table three_stars add constraint three_stars_game_id_rank_key unique (game_id, rank);
