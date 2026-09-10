import { NextRequest, NextResponse } from "next/server";
import { SCOREKEEPER_COOKIE_NAME, scorekeeperCodeIsValid, scorekeeperSessionToken } from "@/lib/scorekeeper-auth";

function setSession(res: NextResponse) {
  res.cookies.set(SCOREKEEPER_COOKIE_NAME, scorekeeperSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

/** Magic link: /api/scorekeeper/login?code=ABC123&next=/scorekeeper/<id>.
 *  Signs the device in and lands on `next` — no typing on a rink tablet. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const check = await scorekeeperCodeIsValid(url.searchParams.get("code"));
  const next = url.searchParams.get("next") ?? "/scorekeeper";
  const safeNext = next.startsWith("/scorekeeper") ? next : "/scorekeeper";
  if (!check.ok) {
    return NextResponse.redirect(new URL(`/scorekeeper?error=${encodeURIComponent(check.error)}`, url.origin));
  }
  // Keep the code on the landing URL: if this browser drops the cookie, the
  // page and its API calls still authenticate off the query string.
  const landing = new URL(safeNext, url.origin);
  landing.searchParams.set("code", (url.searchParams.get("code") ?? "").trim().toUpperCase());
  return setSession(NextResponse.redirect(landing));
}

export async function POST(req: NextRequest) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const check = await scorekeeperCodeIsValid(body.code);
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
  return setSession(NextResponse.json({ ok: true }));
}
