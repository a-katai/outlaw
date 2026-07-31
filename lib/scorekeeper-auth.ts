import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

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

export async function isScorekeeperAuthed(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const expected = expectedToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
