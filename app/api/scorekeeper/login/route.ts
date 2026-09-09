import { NextRequest, NextResponse } from "next/server";
import { SCOREKEEPER_COOKIE_NAME, scorekeeperSessionToken } from "@/lib/scorekeeper-auth";
import { createAdminClient } from "@/lib/supabase-admin";

async function codeIsValid(raw: string | undefined | null): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const code = raw?.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter the scorekeeper code", status: 400 };
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("access_codes").select("code").eq("role", "scorekeeper").maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!data || data.code !== code) return { ok: false, error: "Invalid code", status: 401 };
  return { ok: true };
}

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
  const check = await codeIsValid(url.searchParams.get("code"));
  const next = url.searchParams.get("next") ?? "/scorekeeper";
  const safeNext = next.startsWith("/scorekeeper") ? next : "/scorekeeper";
  if (!check.ok) {
    return NextResponse.redirect(new URL(`/scorekeeper?error=${encodeURIComponent(check.error)}`, url.origin));
  }
  return setSession(NextResponse.redirect(new URL(safeNext, url.origin)));
}

export async function POST(req: NextRequest) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const check = await codeIsValid(body.code);
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
  return setSession(NextResponse.json({ ok: true }));
}
