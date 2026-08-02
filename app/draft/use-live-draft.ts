"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import type { Draft, DraftPick, Player, Team } from "@/lib/draft-types";

export type LiveDraftData = {
  draft: Draft | null;
  teams: Team[];
  players: Player[];
  picks: DraftPick[];
  loading: boolean;
  /** Set only on a first-load failure (no good data on screen yet) — render the full error card. */
  error: string | null;
  /** True when a fetch failed AFTER data had already loaded once — keep rendering last-good data, show a quiet pill instead. */
  stale: boolean;
  /** True once the realtime channel has confirmed SUBSCRIBED. */
  connected: boolean;
  /** Epoch ms of the last successful fetch (realtime-triggered, polled, or focus-triggered). */
  lastUpdated: number | null;
  refetch: () => void;
};

const POLL_MS = 15000;

/**
 * Shared client-side data source for /draft and /draft/pick: fetches the
 * latest draft + teams + players + picks over the anon (RLS-limited) client,
 * subscribes to realtime changes on drafts/draft_picks, and falls back to a
 * 15s poll in case realtime is unavailable. Never selects PII columns
 * (players has email/phone) — only what the board/picker actually render.
 */
export function useLiveDraft(): LiveDraftData {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const clientRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);
  clientRef.current ??= createBrowserClient();
  const hasLoadedRef = useRef(false);

  const fetchAll = useCallback(async () => {
    const supabase = clientRef.current!;
    try {
      const { data: drafts, error: draftError } = await supabase
        .from("drafts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      if (draftError) throw draftError;
      const currentDraft = ((drafts as Draft[] | null)?.[0] as Draft | undefined) ?? null;
      setDraft(currentDraft);

      const [teamsRes, playersRes] = await Promise.all([
        supabase.from("teams").select("*").order("draft_order", { ascending: true, nullsFirst: false }),
        supabase.from("players").select("id,name,position,rank").order("name", { ascending: true }),
      ]);
      if (teamsRes.error) throw teamsRes.error;
      if (playersRes.error) throw playersRes.error;
      setTeams((teamsRes.data as Team[] | null) ?? []);
      setPlayers((playersRes.data as Player[] | null) ?? []);

      if (currentDraft) {
        const picksRes = await supabase
          .from("draft_picks")
          .select("*")
          .eq("draft_id", currentDraft.id)
          .order("pick_number", { ascending: true });
        if (picksRes.error) throw picksRes.error;
        setPicks((picksRes.data as DraftPick[] | null) ?? []);
      } else {
        setPicks([]);
      }
      hasLoadedRef.current = true;
      setError(null);
      setStale(false);
      setLastUpdated(Date.now());
    } catch (err) {
      if (hasLoadedRef.current) {
        // Keep last-good data on screen; the board shows a quiet "Reconnecting…" pill instead.
        setStale(true);
      } else {
        setError(err instanceof Error ? err.message : "Couldn't load the draft.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const supabase = clientRef.current!;

    const channel = supabase
      .channel("draft-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "drafts" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_picks" }, () => fetchAll())
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    const interval = setInterval(fetchAll, POLL_MS);

    const onFocus = () => fetchAll();
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchAll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchAll]);

  return { draft, teams, players, picks, loading, error, stale, connected, lastUpdated, refetch: fetchAll };
}
