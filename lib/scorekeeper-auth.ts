import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "./supabase-admin";

const COOKIE_NAME = "ohl_scorekeeper";
const SESSION_SUBJECT = "outlaw-scorekeeper-session-v1";

function secret(): string {
  const value = process.env.ADMIN_PASSWORD;
  if (!value) throw new Error("ADMIN_PASSWORD is not set");
  return value;
}

function expectedToken(): string {
  return createHmac("sha256", secret()).update(SESSION_SUBJECT).digest("hex");
}

export const SCOREKEEPER_COOKIE_NAME = COOKIE_NAME;

/** The cookie value a successful /api/scorekeeper/login sets — proves this device holds a valid session. */
export function scorekeeperSessionToken(): string {
  return expectedToken();
}

/** Checks a typed or linked code against access_codes. */
export async function scorekeeperCodeIsValid(
  raw: string | undefined | null,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const code = raw?.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter the scorekeeper code", status: 400 };
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("access_codes").select("code").eq("role", "scorekeeper").maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!data || data.code !== code) return { ok: false, error: "Invalid code", status: 401 };
  return { ok: true };
}

/** Resolves a manager's team code (team_codes) to its team id, or null. */
export async function teamIdForCode(raw: string | undefined | null): Promise<string | null> {
  const code = raw?.trim().toUpperCase();
  if (!code) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.from("team_codes").select("team_id").eq("code", code).maybeSingle();
  return data?.team_id ?? null;
}

/**
 * A device is in if it holds the session cookie OR presents the code itself
 * (?code= on a page, x-scorekeeper-code on an API call). The second path
 * exists for rink tablets whose browsers drop cookies — the link the
 * commissioner hands out carries the code, so nothing has to persist.
 */
export async function isScorekeeperAuthed(presentedCode?: string | null): Promise<boolean> {
  if (presentedCode) {
    const check = await scorekeeperCodeIsValid(presentedCode);
    if (check.ok) return true;
  }
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const expected = expectedToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
