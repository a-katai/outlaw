import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getRecap, shortDate, weekLabel } from "@/lib/recap";
import { getMilestoneCardsFor } from "@/lib/milestones";
import { OG_COLORS, publicImageDataUri, teamAccent, teamLogoDataUri } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = { width: 1080, height: 1350 };

let fonts: { name: string; data: Buffer; weight: 700 | 800; style: "normal" }[] | null = null;
function loadFonts() {
  if (!fonts) {
    const dir = path.join(process.cwd(), "public", "fonts");
    fonts = ([700, 800] as const).map((weight) => ({
      name: "Barlow Condensed",
      data: fs.readFileSync(path.join(dir, `BarlowCondensed-${weight}.ttf`)),
      weight,
      style: "normal" as const,
    }));
  }
  return fonts;
}

const NAMEPLATE = "Barlow Condensed";
const GREY = "#86868b";

export async function GET(_req: Request, { params }: { params: Promise<{ date: string; playerId: string }> }) {
  const { date, playerId } = await params;
  const recap = await getRecap(date);
  if (!recap) return new Response("Not found", { status: 404 });
  const card = (await getMilestoneCardsFor(recap.milestones, date)).find((c) => c.playerId === playerId);
  if (!card) return new Response("Not found", { status: 404 });

  const kicker = [weekLabel(recap), shortDate(recap.date)].filter(Boolean).join(" · ");
  const color = teamAccent(card.team);
  const teamLogo = teamLogoDataUri(card.team);
  const logo = publicImageDataUri("ohl_logo.png");
  const { big, sub } = card.hero;
  const isNumber = /^\d+$/.test(big);
  const bigSize = isNumber ? (big.length > 2 ? 340 : 440) : big.length > 6 ? 190 : 300;
  const nameSize = card.playerName.length > 16 ? 92 : 108;
  const line = [card.line, card.opponent ? `vs ${card.opponent}` : ""].filter(Boolean).join(" ");

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
          <div style={{ display: "flex", fontFamily: NAMEPLATE, fontWeight: 700, fontSize: 30, letterSpacing: 4, textTransform: "uppercase", color: "#6e6e73" }}>{kicker}</div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            background: "rgba(255,255,255,0.72)",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 36,
            padding: "48px 56px 52px",
            marginBottom: 28,
            boxShadow: "0 10px 40px rgba(0,0,0,0.05)",
            fontFamily: NAMEPLATE,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {teamLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- satori requires raw <img>
              <img src={teamLogo} alt="" width={72} height={72} style={{ objectFit: "contain", marginRight: 22 }} />
            ) : null}
            <div
              style={{
                display: "flex",
                fontWeight: 800,
                fontSize: 50,
                lineHeight: 1,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                borderLeft: `8px solid ${color}`,
                paddingLeft: 18,
                color: OG_COLORS.text,
              }}
            >
              {card.team}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", alignItems: "center" }}>
            <div style={{ display: "flex", fontWeight: 800, fontSize: bigSize, lineHeight: 0.9, textTransform: "uppercase", color: OG_COLORS.text, letterSpacing: 1, whiteSpace: "nowrap" }}>{big}</div>
            {sub ? (
              <div style={{ display: "flex", marginTop: 20, fontWeight: 700, fontSize: 64, letterSpacing: 8, textTransform: "uppercase", color: color }}>{sub}</div>
            ) : null}
            {card.others.length ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 44 }}>
                {card.others.map((o) => (
                  <div key={o} style={{ display: "flex", fontWeight: 700, fontSize: 34, letterSpacing: 4, textTransform: "uppercase", color: GREY, marginTop: 6 }}>
                    {`+ ${o}`}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 32 }}>
            <div style={{ display: "flex", fontWeight: 800, fontSize: nameSize, lineHeight: 1, textTransform: "uppercase", letterSpacing: 0.5, color: OG_COLORS.text, whiteSpace: "nowrap" }}>
              {card.playerName}
            </div>
            <div style={{ display: "flex", marginTop: 14, fontWeight: 700, fontSize: 36, letterSpacing: 3.5, textTransform: "uppercase", color: GREY }}>{line}</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", fontFamily: NAMEPLATE, fontWeight: 700, fontSize: 24, letterSpacing: 5, textTransform: "uppercase", color: GREY }}>
          outlawhl.com
        </div>
      </div>
    ),
    { ...SIZE, fonts: loadFonts(), headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
