import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "./supabase-admin";

/**
 * Card checkout (/payments, /subs, /api/payments/charge) sits behind one shared
 * code — access_codes row `payments`. The public form was being used for card
 * testing; the gate keeps strangers off the Clover endpoint entirely.
 * The session cookie is an HMAC over the current code, so rotating the code
 * signs every device out. No row = no one gets in (fail closed).
 */
export const PAYMENTS_COOKIE_NAME = "ohl_payments";
const ROLE = "payments";
const SESSION_SUBJECT = "outlaw-payments-session-v1";

function secret(): string {
  const value = process.env.ADMIN_PASSWORD;
  if (!value) throw new Error("ADMIN_PASSWORD is not set");
  return value;
}

async function currentCode(): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("access_codes").select("code").eq("role", ROLE).maybeSingle();
  return data?.code ?? null;
}

function sessionFor(code: string): string {
  return createHmac("sha256", secret()).update(`${SESSION_SUBJECT}:${code}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checks a typed code. Returns the session token to set on success. */
export async function paymentsLogin(raw: string | undefined | null): Promise<string | null> {
  const typed = raw?.trim().toUpperCase();
  if (!typed) return null;
  const code = await currentCode();
  if (!code || !safeEqual(typed, code)) return null;
  return sessionFor(code);
}

/** A device is in if it holds a session cookie minted from the current code. */
export async function isPaymentsAuthed(): Promise<boolean> {
  const token = (await cookies()).get(PAYMENTS_COOKIE_NAME)?.value;
  if (!token) return false;
  const code = await currentCode();
  if (!code) return false;
  return safeEqual(token, sessionFor(code));
}
