// Row shapes mirroring supabase/migrations/0001_draft_and_payments.sql.
// Hand-written (no generated types) — keep in sync with the migration.

export type PlayerPosition = "F" | "D" | "G" | "F/D";

export type Player = {
  id: string;
  name: string;
  position: PlayerPosition | null;
  rank: number | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export type Team = {
  id: string;
  name: string;
  color: string | null;
  captain_player_id: string | null;
  draft_order: number | null;
  created_at: string;
};

export type TeamCode = {
  team_id: string;
  code: string;
};

export type DraftFormat = "snake" | "linear";
export type DraftStatus = "setup" | "live" | "paused" | "complete";

export type Draft = {
  id: string;
  name: string;
  format: DraftFormat;
  status: DraftStatus;
  current_pick: number;
  total_rounds: number;
  created_at: string;
};

export type DraftPick = {
  id: string;
  draft_id: string;
  pick_number: number;
  round: number;
  team_id: string;
  player_id: string;
  made_at: string;
};

export type PaymentMethod = "cash" | "venmo" | "zelle" | "card" | "check" | "other";

export type Payment = {
  id: string;
  player_id: string | null;
  payer_name: string | null;
  amount_cents: number;
  method: PaymentMethod;
  season: string | null;
  note: string | null;
  paid_on: string;
  created_at: string;
};

export type RpcResult<T extends Record<string, unknown> = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };
