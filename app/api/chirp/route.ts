import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { CHIRP_HANDLE_MAX_LENGTH, CHIRP_MAX_LENGTH, getChirps, type Chirp } from "@/lib/chirps";

// Rate-limit thresholds. The board is anonymous and unauthenticated, so the
// per-IP windows are what keep one bored skater from owning the whole page,
// and the global breaker catches a flood spread across addresses.
const IP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const IP_MAX_CHIRPS = 4;
const IP_DAY_WINDOW_MS = 24 * 60 * 60 * 1000;
const IP_MAX_PER_DAY = 25;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_MAX_CHIRPS = 200;

type ChirpBody = { body?: unknown; handle?: unknown; parentId?: unknown };

function callerIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/**
 * The ledger stores a hash, never the address — the board promises anonymity
 * and the rate limiter only ever needs to compare one caller against itself.
 */
function hashIp(ip: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "outlaw-chirp";
  return createHmac("sha256", secret).update(`chirp:${ip}`).digest("hex");
}

// Control characters a paste can drag in; stripped before anything is stored.
const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

/** Collapse the whitespace a paste drags in; drop control characters outright. */
function clean(value: string, max: number): string {
  return value
    .replace(CONTROL_CHARS, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export async function GET() {
  // Reads go through getChirps(), which uses the anon client — so RLS, not a
  // filter in this file, is what keeps a hidden chirp hidden.
  try {
    return NextResponse.json({ chirps: await getChirps() });
  } catch {
    return NextResponse.json({ error: "Could not load the board." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let payload: ChirpBody;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const body = typeof payload.body === "string" ? clean(payload.body, CHIRP_MAX_LENGTH) : "";
  if (!body) return NextResponse.json({ error: "Say something first." }, { status: 400 });

  const parentId = typeof payload.parentId === "string" && payload.parentId ? payload.parentId : null;

  const rawHandle = typeof payload.handle === "string" ? clean(payload.handle, CHIRP_HANDLE_MAX_LENGTH) : "";
  const handle = rawHandle ? rawHandle.replace(/^@+/, "").slice(0, CHIRP_HANDLE_MAX_LENGTH) || null : null;

  const supabase = createAdminClient();

  if (parentId) {
    // One level only, and you can't reply to a chirp that's been taken down.
    const { data: parent } = await supabase
      .from("chirps")
      .select("id, parent_id, hidden")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent || parent.hidden || parent.parent_id) {
      return NextResponse.json({ error: "That chirp isn't there any more." }, { status: 400 });
    }
  }

  const ipHash = hashIp(callerIp(req));
  const now = Date.now();

  const [recent, daily, global] = await Promise.all([
    supabase
      .from("chirp_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(now - IP_WINDOW_MS).toISOString()),
    supabase
      .from("chirp_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(now - IP_DAY_WINDOW_MS).toISOString()),
    supabase
      .from("chirp_attempts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(now - GLOBAL_WINDOW_MS).toISOString()),
  ]);

  if ((recent.count ?? 0) >= IP_MAX_CHIRPS || (daily.count ?? 0) >= IP_MAX_PER_DAY) {
    return NextResponse.json({ error: "Easy, killer. Give it a few minutes." }, { status: 429 });
  }
  if ((global.count ?? 0) >= GLOBAL_MAX_CHIRPS) {
    return NextResponse.json({ error: "The board is busy. Try again shortly." }, { status: 429 });
  }

  await supabase.from("chirp_attempts").insert({ ip_hash: ipHash });

  const { data, error } = await supabase
    .from("chirps")
    .insert({ body, handle, parent_id: parentId })
    .select("id, handle, body, created_at")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "That didn't post. Try again." }, { status: 500 });
  }
  const chirp: Chirp = {
    id: data.id, handle: data.handle, body: data.body, createdAt: data.created_at, replies: [],
  };
  return NextResponse.json({ chirp, parentId }, { status: 201 });
}
