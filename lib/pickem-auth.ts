import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "./supabase-admin";

/**
 * Pick'em identity. No accounts: a picker is a player who claimed their name
 * with a 4-digit PIN. Same secret pattern as scorekeeper-auth / payments-auth
 * (ADMIN_PASSWORD), but every value is HMAC'd under its own derived key so a
 * pick'em hash or cookie can never stand in for anything else.
 *
 * The PIN hash is HMAC(key, "pin:<playerId>:<pin>") — only the server can
 * compute it, so a leaked table can't be brute-forced offline. The cookie is
 * "<pickerId>.<HMAC(key, "session:<pickerId>:<pinHash>")>": it dies if the
 * PIN row is ever reset.
 */
export const PICKEM_COOKIE_NAME = "ohl_pickem";
export const PICKEM_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function key(): string {
  const value = process.env.ADMIN_PASSWORD;
  if (!value) throw new Error("ADMIN_PASSWORD is not set");
  return createHmac("sha256", value).update("outlaw-pickem-v1").digest("hex");
}

function mac(message: string): string {
  return createHmac("sha256", key()).update(message).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const PIN_RE = /^\d{4}$/;

export function hashPin(playerId: string, pin: string): string {
  return mac(`pin:${playerId}:${pin}`);
}

export function pinMatches(playerId: string, pin: string, storedHash: string): boolean {
  return safeEqual(hashPin(playerId, pin), storedHash);
}

/** Raw IPs never touch the ledger. */
export function hashIp(ip: string): string {
  return mac(`ip:${ip}`);
}

export function sessionValue(pickerId: string, pinHash: string): string {
  return `${pickerId}.${mac(`session:${pickerId}:${pinHash}`)}`;
}

/** The picker this device is signed in as, or null. Never throws (missing table/env = signed out). */
export async function currentPicker(): Promise<{ id: string; playerId: string } | null> {
  try {
    const token = (await cookies()).get(PICKEM_COOKIE_NAME)?.value;
    if (!token) return null;
    const [pickerId] = token.split(".");
    if (!pickerId) return null;
    const { data } = await createAdminClient()
      .from("pickers")
      .select("id,player_id,pin_hash")
      .eq("id", pickerId)
      .maybeSingle();
    if (!data || !safeEqual(token, sessionValue(data.id, data.pin_hash))) return null;
    return { id: data.id, playerId: data.player_id };
  } catch {
    return null;
  }
}
