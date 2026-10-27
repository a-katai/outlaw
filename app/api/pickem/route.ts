import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  PICKEM_COOKIE_MAX_AGE,
  PICKEM_COOKIE_NAME,
  PIN_RE,
  currentPicker,
  hashIp,
  hashPin,
  pinMatches,
  sessionValue,
} from "@/lib/pickem-auth";
import { isLocked, isPickChoice, type PickChoice } from "@/lib/pickem";

// Rate limits (hashed IP; ledger = pickem_attempts, same idea as chirp_attempts).
// Per-name failure cap stops a guesser rotating IPs against one 4-digit PIN.
const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_MAX_REQUESTS = 60;
const IP_FAILED_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX_FAILED = 8;
const PICKER_FAILED_WINDOW_MS = 60 * 60 * 1000;
const PICKER_MAX_FAILED = 10;
const MAX_PICKS_PER_REQUEST = 8;

type Body = { playerId?: unknown; pin?: unknown; picks?: unknown };

function callerIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

function fail(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function setSession(res: NextResponse, pickerId: string, pinHash: string) {
  res.cookies.set(PICKEM_COOKIE_NAME, sessionValue(pickerId, pinHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PICKEM_COOKIE_MAX_AGE,
  });
}

/**
 * Sign in and/or submit picks.
 *   { playerId, pin, picks? }  first time: claims the name with this PIN. After: checks it.
 *   { picks }                  this device already holds a valid cookie.
 * `picks` is [{ gameId, pick }]; locked or final games reject the whole request.
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid request.", 400);
  }

  const rawPicks = body.picks === undefined ? [] : body.picks;
  if (!Array.isArray(rawPicks) || rawPicks.length > MAX_PICKS_PER_REQUEST) return fail("Invalid picks.", 400);
  const picks: { gameId: string; pick: PickChoice }[] = [];
  for (const item of rawPicks) {
    const rec = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (typeof rec.gameId !== "string" || !isPickChoice(rec.pick)) return fail("Invalid picks.", 400);
    picks.push({ gameId: rec.gameId, pick: rec.pick });
  }

  const supabase = createAdminClient();
  const ipHash = hashIp(callerIp(req));

  // Log first, then judge off the ledger (this request counts toward its own window).
  const { data: attemptRow, error: attemptError } = await supabase
    .from("pickem_attempts")
    .insert({ ip_hash: ipHash })
    .select("id")
    .single();
  if (attemptError) {
    console.error("pickem: failed to log attempt:", attemptError.message);
    return fail("Pick'em isn't open yet.", 503);
  }
  const attemptId = attemptRow.id as string;

  const [reqCount, failCount] = await Promise.all([
    supabase
      .from("pickem_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(Date.now() - IP_WINDOW_MS).toISOString()),
    supabase
      .from("pickem_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .eq("failed", true)
      .gte("created_at", new Date(Date.now() - IP_FAILED_WINDOW_MS).toISOString()),
  ]);
  if ((reqCount.count ?? 0) > IP_MAX_REQUESTS || (failCount.count ?? 0) >= IP_MAX_FAILED) {
    return fail("Too many tries. Try again later.", 429);
  }

  // --- Who is this? ---
  let pickerId: string;
  let pinHash: string;
  let newlyClaimed = false;
  const session = await currentPicker();
  const wantsPlayer = typeof body.playerId === "string" ? body.playerId : null;

  if (session && (!wantsPlayer || wantsPlayer === session.playerId) && body.pin === undefined) {
    pickerId = session.id;
    const { data } = await supabase.from("pickers").select("pin_hash").eq("id", pickerId).single();
    pinHash = data?.pin_hash ?? "";
  } else {
    const pin = typeof body.pin === "string" ? body.pin : "";
    if (!wantsPlayer) return fail("Pick your name.", 400);
    if (!PIN_RE.test(pin)) return fail("PIN is 4 digits.", 400);

    // Must be on this season's roster or the sub list.
    const eligible = await eligiblePlayerIds(supabase);
    if (!eligible.has(wantsPlayer)) return fail("That name isn't on this season's list.", 400);

    const { data: existing } = await supabase
      .from("pickers")
      .select("id,pin_hash")
      .eq("player_id", wantsPlayer)
      .maybeSingle();

    if (existing) {
      const since = new Date(Date.now() - PICKER_FAILED_WINDOW_MS).toISOString();
      const { count } = await supabase
        .from("pickem_attempts")
        .select("id", { count: "exact", head: true })
        .eq("picker_id", existing.id)
        .eq("failed", true)
        .gte("created_at", since);
      if ((count ?? 0) >= PICKER_MAX_FAILED) return fail("Too many tries on that name. Try again later.", 429);

      if (!pinMatches(wantsPlayer, pin, existing.pin_hash)) {
        await supabase.from("pickem_attempts").update({ failed: true, picker_id: existing.id }).eq("id", attemptId);
        return fail("Wrong PIN.", 401);
      }
      pickerId = existing.id;
      pinHash = existing.pin_hash;
    } else {
      pinHash = hashPin(wantsPlayer, pin);
      const { data: created, error: createError } = await supabase
        .from("pickers")
        .insert({ player_id: wantsPlayer, pin_hash: pinHash })
        .select("id")
        .single();
      if (createError || !created) {
        // Unique violation = someone claimed it a moment ago. Never reveal more than that.
        return fail("That name was just claimed. Enter its PIN.", 409);
      }
      pickerId = created.id;
      newlyClaimed = true;
    }
  }

  // --- Picks ---
  if (picks.length) {
    const gameIds = Array.from(new Set(picks.map((p) => p.gameId)));
    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("id,game_date,game_time,status,seasons!inner(status)")
      .in("id", gameIds)
      .eq("seasons.status", "active");
    if (gamesError) return fail("Couldn't check those games.", 500);
    const byId = new Map((games ?? []).map((g) => [g.id as string, g]));
    const now = new Date();
    const locked: string[] = [];
    for (const id of gameIds) {
      const g = byId.get(id);
      if (!g) return fail("Unknown game.", 400);
      if (g.status !== "scheduled" || isLocked(g.game_date, g.game_time, now)) locked.push(id);
    }
    if (locked.length) return fail("That game has already started.", 409, { locked });

    const stamp = now.toISOString();
    const { error: upsertError } = await supabase.from("picks").upsert(
      picks.map((p) => ({ picker_id: pickerId, game_id: p.gameId, pick: p.pick, updated_at: stamp })),
      { onConflict: "picker_id,game_id" },
    );
    if (upsertError) {
      console.error("pickem: upsert failed:", upsertError.message);
      return fail("Couldn't save that pick.", 500);
    }
  }

  const res = NextResponse.json({ ok: true, claimed: newlyClaimed });
  setSession(res, pickerId, pinHash);
  return res;
}

/** Sign out this device. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PICKEM_COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

/** Players on this season's rosters (draft_picks) plus the standing sub list. */
async function eligiblePlayerIds(supabase: ReturnType<typeof createAdminClient>): Promise<Set<string>> {
  const { data: season } = await supabase.from("seasons").select("id").eq("status", "active").maybeSingle();
  const ids = new Set<string>();
  if (season) {
    const { data: teams } = await supabase.from("teams").select("id").eq("season_id", season.id);
    const teamIds = (teams ?? []).map((t) => t.id);
    if (teamIds.length) {
      const { data: drafted } = await supabase.from("draft_picks").select("player_id").in("team_id", teamIds);
      for (const d of drafted ?? []) ids.add(d.player_id);
    }
  }
  const { data: subs } = await supabase.from("players").select("id").eq("is_sub", true);
  for (const s of subs ?? []) ids.add(s.id);
  return ids;
}
