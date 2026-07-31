import { NextRequest, NextResponse } from "next/server";
import { getGameDetail } from "@/lib/live-season";

/** Public, unauthenticated poll target for the live game score/goal feed on /games/[id]. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGameDetail(id);
  if (!game) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    status: game.status,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    goalEvents: game.goalEvents,
  });
}
