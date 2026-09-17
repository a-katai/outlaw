import { cache } from "react";
import { createBrowserClient } from "./supabase";

export type Chirp = {
  id: string;
  handle: string | null;
  body: string;
  createdAt: string;
};

/** How many chirps the box shows before it stops growing. */
export const CHIRP_FEED_LIMIT = 30;
export const CHIRP_MAX_LENGTH = 280;
export const CHIRP_HANDLE_MAX_LENGTH = 24;

type ChirpRow = { id: string; handle: string | null; body: string; created_at: string };

function toChirp(row: ChirpRow): Chirp {
  return { id: row.id, handle: row.handle, body: row.body, createdAt: row.created_at };
}

/** The visible board, newest first. RLS already filters the hidden ones out. */
export const getChirps = cache(async (limit = CHIRP_FEED_LIMIT): Promise<Chirp[]> => {
  const supabase = createBrowserClient();
  const { data, error } = await supabase
    .from("chirps")
    .select("id, handle, body, created_at")
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as ChirpRow[]).map(toChirp);
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
