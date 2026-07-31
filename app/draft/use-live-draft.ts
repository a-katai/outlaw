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
  error: string | null;
  refetch: () => void;
};

const POLL_MS = 15000;

/**
 * Shared client-side data source for /draft and /draft/pick: fetches the
 * latest draft + teams + players + picks over the anon (RLS-limited) client,
 * subscribes to realtime changes on drafts/draft_picks, and falls back to a
 * 15s poll in case realtime is unavailable.
 */
export function useLiveDraft(): LiveDraftData {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef(createBrowserClient());

  const fetchAll = useCallback(async () => {
    const supabase = clientRef.current;
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
        supabase.from("players").select("*").order("name", { ascending: true }),
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
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the draft.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const supabase = clientRef.current;

    const channel = supabase
      .channel("draft-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "drafts" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_picks" }, () => fetchAll())
      .subscribe();

    const interval = setInterval(fetchAll, POLL_MS);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchAll]);

  return { draft, teams, players, picks, loading, error, refetch: fetchAll };
}
