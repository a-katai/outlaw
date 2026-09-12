import "server-only";
import { createAdminClient } from "@/lib/supabase-admin";
import { SUB_FEE_CENTS } from "@/lib/dues";

/** One spot in the sub line. Paid subs come first, in the order they paid. */
export type SubLineEntry = {
  /** players.id when the sub is in the system; a name key otherwise. */
  key: string;
  playerId: string | null;
  name: string;
  paid: boolean;
  /** Earliest sub-fee payment, ISO date. */
  firstPaidOn: string | null;
  /** Games covered = total sub fees ÷ the per-game fee. */
  gamesCovered: number;
};

function nameKey(name: string): string {
  return `name:${name.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

/**
 * Standing subs (players.is_sub) plus anyone who has paid a sub fee.
 * Order: paid, by first payment (date, then ledger insert); then unpaid, A–Z.
 */
export async function getSubLine(): Promise<SubLineEntry[]> {
  const supabase = createAdminClient();
  const [subsRes, feesRes] = await Promise.all([
    supabase.from("players").select("id,name").eq("is_sub", true),
    supabase
      .from("payments")
      .select("player_id,payer_name,amount_cents,paid_on,created_at,players(name)")
      .eq("kind", "sub")
      .order("paid_on", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  type FeeRow = {
    player_id: string | null;
    payer_name: string | null;
    amount_cents: number;
    paid_on: string;
    created_at: string;
    players: { name: string } | null;
  };

  const entries = new Map<string, SubLineEntry & { firstCreatedAt: string | null }>();

  for (const p of subsRes.data ?? []) {
    entries.set(p.id, {
      key: p.id,
      playerId: p.id,
      name: p.name,
      paid: false,
      firstPaidOn: null,
      gamesCovered: 0,
      firstCreatedAt: null,
    });
  }

  for (const fee of (feesRes.data ?? []) as unknown as FeeRow[]) {
    const name = fee.players?.name ?? fee.payer_name ?? "Unknown";
    const key = fee.player_id ?? nameKey(name);
    const entry = entries.get(key) ?? {
      key,
      playerId: fee.player_id,
      name,
      paid: false,
      firstPaidOn: null,
      gamesCovered: 0,
      firstCreatedAt: null,
    };
    entry.paid = true;
    if (!entry.firstPaidOn) {
      entry.firstPaidOn = fee.paid_on;
      entry.firstCreatedAt = fee.created_at;
    }
    entry.gamesCovered += fee.amount_cents / SUB_FEE_CENTS;
    entries.set(key, entry);
  }

  return Array.from(entries.values())
    .sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? -1 : 1;
      if (a.paid && b.paid) {
        const byDate = (a.firstPaidOn ?? "").localeCompare(b.firstPaidOn ?? "");
        if (byDate !== 0) return byDate;
        return (a.firstCreatedAt ?? "").localeCompare(b.firstCreatedAt ?? "");
      }
      return a.name.localeCompare(b.name);
    })
    .map((entry) => ({
      key: entry.key,
      playerId: entry.playerId,
      name: entry.name,
      paid: entry.paid,
      firstPaidOn: entry.firstPaidOn,
      gamesCovered: Math.floor(entry.gamesCovered),
    }));
}

/** 1-based position in the paid line, keyed by players.id. Unpaid subs are absent. */
export async function paidSubRankById(): Promise<Map<string, number>> {
  const line = await getSubLine();
  const ranks = new Map<string, number>();
  let rank = 0;
  for (const entry of line) {
    if (!entry.paid) break;
    rank += 1;
    if (entry.playerId) ranks.set(entry.playerId, rank);
  }
  return ranks;
}
