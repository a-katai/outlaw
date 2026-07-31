import type { Draft, DraftPick, Payment, Player, Team } from "@/lib/draft-types";

export type AdminTeam = Team & { code: string | null };

export type AdminState = {
  ok: true;
  draft: Draft | null;
  drafts: Draft[];
  teams: AdminTeam[];
  players: Player[];
  picks: DraftPick[];
  payments: Payment[];
};

export async function postJSON<T = Record<string, unknown>>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

export async function fetchAdminState(): Promise<AdminState | null> {
  const res = await fetch("/api/admin/state", { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.ok) return null;
  return data as AdminState;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
