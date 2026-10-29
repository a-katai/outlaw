import { ImageResponse } from "next/og";
import { getRecap, shortDate, weekLabel } from "@/lib/recap";
import { computeStandings, getActiveSeasonLive } from "@/lib/live-season";
import { DefaultLeagueCard, loadBarlowFonts, OG_COLORS, publicImageDataUri, teamAccent, teamLogoDataUri } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = { width: 1080, height: 1350 }; // Facebook 4:5, same as the finals card
const NAMEPLATE = "Barlow Condensed";
const GREY = "#86868b";
const COLS = [
  { key: "gp", label: "GP" },
  { key: "wins", label: "W" },
  { key: "losses", label: "L" },
  { key: "ties", label: "T" },
  { key: "diff", label: "Diff" },
  { key: "points", label: "Pts" },
] as const;
const COL_W = 72;

// Standings through the recap night — later finals never leak into an older week's card.
export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const [recap, season] = await Promise.all([getRecap(date), getActiveSeasonLive()]);
  if (!recap || !season) {
    return new ImageResponse(<DefaultLeagueCard />, { width: 1200, height: 630 });
  }

  const standings = computeStandings(season.teams, season.games.filter((g) => g.date <= date));
  const kicker = [weekLabel(recap), shortDate(recap.date)].filter(Boolean).join(" · ");
  const logo = publicImageDataUri("ohl_logo.png");

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
            <div style={{ display: "flex", fontWeight: 800, fontSize: 64, lineHeight: 1, letterSpacing: 1, textTransform: "uppercase", color: OG_COLORS.text }}>Standings</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            background: "rgba(255,255,255,0.72)",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 36,
            padding: "30px 44px",
            marginBottom: 24,
            boxShadow: "0 10px 40px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", paddingBottom: 14, borderBottom: "1px solid rgba(0,0,0,0.08)", fontFamily: NAMEPLATE, fontWeight: 700, fontSize: 24, letterSpacing: 3.5, textTransform: "uppercase", color: GREY }}>
            <div style={{ display: "flex", flex: 1 }}>Team</div>
            {COLS.map((c) => (
              <div key={c.key} style={{ display: "flex", justifyContent: "center", width: COL_W }}>{c.label}</div>
            ))}
          </div>

          {standings.map((t, i) => {
            const teamLogo = teamLogoDataUri(t.team);
            return (
              <div
                key={t.team}
                style={{ display: "flex", alignItems: "center", flex: 1, borderBottom: i === standings.length - 1 ? "none" : "1px solid rgba(0,0,0,0.06)" }}
              >
                <div style={{ display: "flex", alignItems: "center", flex: 1, paddingRight: 16 }}>
                  <div style={{ display: "flex", width: 40, fontFamily: NAMEPLATE, fontWeight: 800, fontSize: 36, color: "#aeaeb2" }}>{String(i + 1)}</div>
                  {teamLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- satori requires raw <img>
                    <img src={teamLogo} alt="" width={56} height={56} style={{ objectFit: "contain", marginRight: 16 }} />
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      fontFamily: NAMEPLATE,
                      fontWeight: 800,
                      fontSize: 34,
                      whiteSpace: "nowrap",
                      lineHeight: 1,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      borderLeft: `8px solid ${teamAccent(t.team)}`,
                      paddingLeft: 16,
                      color: OG_COLORS.text,
                    }}
                  >
                    {t.team}
                  </div>
                </div>
                {COLS.map((c) => {
                  const v = t[c.key];
                  const text = c.key === "diff" && v > 0 ? `+${v}` : String(v);
                  const strong = c.key === "points";
                  return (
                    <div
                      key={c.key}
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        width: COL_W,
                        ...(strong ? { fontFamily: NAMEPLATE } : {}),
                        fontWeight: strong ? 800 : 500,
                        fontSize: strong ? 48 : 30,
                        color: strong ? OG_COLORS.text : GREY,
                      }}
                    >
                      {text}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "center", fontFamily: NAMEPLATE, fontWeight: 700, fontSize: 24, letterSpacing: 5, textTransform: "uppercase", color: GREY }}>
          outlawhl.com
        </div>
      </div>
    ),
    { ...SIZE, fonts: loadBarlowFonts(), headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
