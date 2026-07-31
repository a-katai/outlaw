import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "outlaw_admin_session";
const SESSION_SUBJECT = "outlaw-admin-session-v1";

function secret(): string {
  const value = process.env.ADMIN_PASSWORD;
  if (!value) throw new Error("ADMIN_PASSWORD is not set");
  return value;
}

function expectedToken(): string {
  return createHmac("sha256", secret()).update(SESSION_SUBJECT).digest("hex");
}

export function checkPassword(candidate: string): boolean {
  const expected = secret();
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function sessionToken(): string {
  return expectedToken();
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const expected = expectedToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
