import { ImageResponse } from "next/og";
import { getRecap, shortDate, weekLabel } from "@/lib/recap";
import type { Milestone } from "@/lib/milestones";
import { DefaultLeagueCard, loadBarlowFonts, OG_COLORS, publicImageDataUri, teamAccent } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = { width: 1080, height: 1350 }; // Facebook 4:5, same as the finals card
const NAMEPLATE = "Barlow Condensed";
const GREY = "#86868b";

// Every milestone of the night on one card, one row per label ("Hat trick", "7-game point streak", ...).
// getRecap already sorts strongest first, so first-seen order is the row order.
function groupByLabel(milestones: Milestone[]) {
  const rows = new Map<string, Milestone[]>();
  for (const m of milestones) rows.set(m.label, [...(rows.get(m.label) ?? []), m]);
  return Array.from(rows, ([label, players]) => ({ label, players }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const recap = await getRecap(date);
  if (!recap || !recap.milestones.length) {
    return new ImageResponse(<DefaultLeagueCard />, { width: 1200, height: 630 });
  }

  const rows = groupByLabel(recap.milestones);
  const kicker = [weekLabel(recap), shortDate(recap.date)].filter(Boolean).join(" · ");
  const logo = publicImageDataUri("ohl_logo.png");
  // Long nights shrink to fit rather than spill.
  const nameSize = rows.length > 8 ? 30 : 34;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "56px 64px 44px",
          background:
            "radial-gradient(1200px 500px at 10% -10%, rgba(0,113,227,0.12), rgba(0,113,227,0) 60%), radial-gradient(900px 420px at 100% 0%, rgba(245,99,58,0.10), rgba(245,99,58,0) 60%), linear-gradient(180deg, #fbfbfd 0%, #f5f5f7 45%, #f5f5f7 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- satori requires raw <img> */}
          <img src={logo} alt="" width={84} height={84} style={{ objectFit: "contain" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontFamily: NAMEPLATE }}>
            <div style={{ display: "flex", fontWeight: 700, fontSize: 30, letterSpacing: 4, textTransform: "uppercase", color: "#6e6e73" }}>{kicker}</div>
            <div style={{ display: "flex", fontWeight: 800, fontSize: 64, lineHeight: 1, letterSpacing: 1, textTransform: "uppercase", color: OG_COLORS.text }}>Milestones</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "space-around",
            background: "rgba(255,255,255,0.72)",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 36,
            padding: "24px 44px",
            marginBottom: 24,
            boxShadow: "0 10px 40px rgba(0,0,0,0.05)",
          }}
        >
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "14px 0",
                borderBottom: i === rows.length - 1 ? "none" : "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", fontFamily: NAMEPLATE, fontWeight: 700, fontSize: 24, letterSpacing: 3.5, textTransform: "uppercase", color: GREY }}>
                {row.label}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", marginTop: 4 }}>
                {row.players.map((m) => (
                  <div key={m.playerId} style={{ display: "flex", alignItems: "center", marginRight: 30 }}>
                    <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: teamAccent(m.team), marginRight: 10 }} />
                    <div style={{ display: "flex", fontSize: nameSize, fontWeight: 700, letterSpacing: -0.3, color: OG_COLORS.text, whiteSpace: "nowrap" }}>
                      {m.playerName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "center", fontFamily: NAMEPLATE, fontWeight: 700, fontSize: 24, letterSpacing: 5, textTransform: "uppercase", color: GREY }}>
          outlawhl.com
        </div>
      </div>
    ),
    { ...SIZE, fonts: loadBarlowFonts(), headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
