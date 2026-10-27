import type { Metadata } from "next";
import { getActiveSeasonLive } from "@/lib/live-season";
import { createAdminClient } from "@/lib/supabase-admin";
import { currentPicker } from "@/lib/pickem-auth";
import { detroitDateISO, gameLockAt, rankPickers, resultOf, type PickChoice } from "@/lib/pickem";
import { formatGameDate, sortChronological, splitTimeRink } from "@/app/components/next-game-card";
import { PickemClient, type PickemGame, type PickemPlayer } from "./pickem-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pick'em — Outlaw Hockey League",
  description: "Pick every game: home, tie, or away. Free, every week.",
};

type PickerRow = { id: string; player_id: string; created_at: string };
type PickRow = { picker_id: string; game_id: string; pick: PickChoice };

export default async function PickemPage() {
  const season = await getActiveSeasonLive().catch(() => null);
  const today = detroitDateISO();

  const open = sortChronological((season?.games ?? []).filter((g) => g.status !== "final" && g.date >= today));
  const nightDate = open[0]?.date ?? null;
  const night = nightDate ? open.filter((g) => g.date === nightDate) : [];

  // Everything below is best-effort: before migration 0021 runs the tables
  // don't exist, and the page should still render (games, empty board).
  let ready = false;
  let pickers: PickerRow[] = [];
  let finalPicks: PickRow[] = [];
  let myPicks = new Map<string, PickChoice>();
  let playerPool: { id: string; name: string }[] = [];
  const me = await currentPicker();

  try {
    const supabase = createAdminClient();
    const pickersRes = await supabase.from("pickers").select("id,player_id,created_at");
    if (!pickersRes.error) {
      ready = true;
      pickers = pickersRes.data ?? [];

      const finalIds = (season?.games ?? []).filter((g) => g.status === "final").map((g) => g.id);
      if (finalIds.length) {
        const res = await supabase.from("picks").select("picker_id,game_id,pick").in("game_id", finalIds);
        finalPicks = (res.data ?? []) as PickRow[];
      }
      if (me && night.length) {
        const res = await supabase
          .from("picks")
          .select("game_id,pick")
          .eq("picker_id", me.id)
          .in("game_id", night.map((g) => g.id));
        myPicks = new Map((res.data ?? []).map((r) => [r.game_id as string, r.pick as PickChoice]));
      }
    }

    const rostered = Object.values(season?.rosters ?? {}).flat();
    const subsRes = await supabase.from("players").select("id,name").eq("is_sub", true);
    const pool = new Map<string, string>();
    for (const p of rostered) pool.set(p.id, p.name);
    for (const p of subsRes.data ?? []) pool.set(p.id, p.name);
    // Anyone who already picked stays listed even if they've since left the pool.
    if (pickers.length) {
      const missing = pickers.map((p) => p.player_id).filter((id) => !pool.has(id));
      if (missing.length) {
        const res = await supabase.from("players").select("id,name").in("id", missing);
        for (const p of res.data ?? []) pool.set(p.id, p.name);
      }
    }
    playerPool = Array.from(pool, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    ready = false;
  }

  const claimed = new Set(pickers.map((p) => p.player_id));
  const players: PickemPlayer[] = playerPool.map((p) => ({ id: p.id, name: p.name, claimed: claimed.has(p.id) }));
  const nameByPlayer = new Map(playerPool.map((p) => [p.id, p.name]));

  const games: PickemGame[] = night.map((g) => {
    const { time, rink } = splitTimeRink(g.time);
    return {
      id: g.id,
      awayTeam: g.awayTeam,
      homeTeam: g.homeTeam,
      time,
      rink,
      lockAt: gameLockAt(g.date, g.time)?.toISOString() ?? null,
      live: g.status === "live",
      myPick: myPicks.get(g.id) ?? null,
    };
  });

  const finals = new Map<string, PickChoice>();
  for (const g of season?.games ?? []) {
    if (g.status === "final" && g.homeScore !== null && g.awayScore !== null) finals.set(g.id, resultOf(g.homeScore, g.awayScore));
  }
  const board = rankPickers(
    pickers.map((p) => ({ id: p.id, name: nameByPlayer.get(p.player_id) ?? "Player", created_at: p.created_at })),
    finalPicks,
    finals,
  );

  return (
    <section className="space-y-10">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Pick&apos;em</h1>
        <p className="mt-3 text-neutral-600">Call every game. Home, tie, or away. One point each.</p>
      </div>

      <PickemClient
        ready={ready}
        players={players}
        meName={me ? (nameByPlayer.get(me.playerId) ?? "You") : null}
        games={games}
        dateLabel={nightDate ? formatGameDate(nightDate) : null}
      />

      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Leaderboard</h2>
          {season ? <span className="text-xs text-neutral-400">{season.label}</span> : null}
        </div>
        {board.length ? (
          <ol className="mt-2 max-w-3xl divide-y divide-black/[0.06] border-y border-black/[0.07]">
            {board.map((row) => {
              const isMe = me?.id === row.pickerId;
              return (
                <li key={row.pickerId} className="flex items-center gap-4 py-2.5 text-sm">
                  <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-neutral-400">{row.rank}</span>
                  <span className={`min-w-0 flex-1 truncate ${isMe ? "font-semibold text-neutral-900" : "font-medium text-neutral-900"}`}>
                    {row.name}
                    {isMe ? <span className="ml-2 text-xs font-normal text-neutral-400">you</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-500">
                    {row.correct}/{row.total}
                  </span>
                  <span className="w-10 shrink-0 text-right text-base font-semibold tabular-nums text-neutral-900">{row.correct}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">The board fills in after the first final.</p>
        )}
      </div>
    </section>
  );
}
