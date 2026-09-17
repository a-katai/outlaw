import { cache } from "react";
import { createBrowserClient } from "./supabase";

export type Chirp = {
  id: string;
  handle: string | null;
  body: string;
  createdAt: string;
  replies: Chirp[];
};

/** How many top-level chirps the box shows before it stops growing. */
export const CHIRP_FEED_LIMIT = 30;
export const CHIRP_MAX_LENGTH = 280;
export const CHIRP_HANDLE_MAX_LENGTH = 24;

type ChirpRow = {
  id: string;
  handle: string | null;
  body: string;
  created_at: string;
  parent_id: string | null;
};

function toChirp(row: ChirpRow): Chirp {
  return { id: row.id, handle: row.handle, body: row.body, createdAt: row.created_at, replies: [] };
}

/**
 * Thread a flat list: newest chirp first, each one's replies oldest first so a
 * back-and-forth reads top to bottom. A reply whose parent is hidden or gone
 * drops out with it — RLS only filters the reply's own row.
 */
export function threadChirps(rows: ChirpRow[], limit = CHIRP_FEED_LIMIT): Chirp[] {
  const tops = rows
    .filter((r) => !r.parent_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map(toChirp);
  const byId = new Map(tops.map((c) => [c.id, c]));
  for (const row of rows.filter((r) => r.parent_id).sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    byId.get(row.parent_id!)?.replies.push(toChirp(row));
  }
  return tops;
}

/** The visible board, newest first, replies threaded under their parent. */
export const getChirps = cache(async (limit = CHIRP_FEED_LIMIT): Promise<Chirp[]> => {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from("chirps")
    .select("id, handle, body, created_at, parent_id")
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit * 8);
  if (error || !data) return [];
  return threadChirps(data as ChirpRow[], limit);
});

/** "2m", "4h", "Sep 16" — short enough to sit inline with the handle. */
export function chirpAge(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);
  if (!Number.isFinite(mins) || mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
