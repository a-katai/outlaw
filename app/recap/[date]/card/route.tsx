import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getRecap, shortDate, weekLabel, type RecapGame } from "@/lib/recap";
import { getTeamColors } from "@/lib/league-data";
import type { Star } from "@/lib/three-stars";
import { DefaultLeagueCard, OG_COLORS, publicImageDataUri, teamLogoDataUri } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = { width: 1080, height: 1350 }; // Facebook 4:5

// Barlow Condensed is vendored as TTF (satori can't read next/font's woff2).
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

// Brand accents for the five teams (the approved card spec); anything else
// falls back to the site's team palette.
const ACCENT: Record<string, string> = {
  trashers: "#2E5AAC",
  "toe dragons": "#E03227",
  "ghost pirates": "#10B981",
  "tank fillers": "#111111",
  "wednesday knights": "#F59E0B",
};
const accent = (team: string) => ACCENT[team.trim().toLowerCase()] ?? getTeamColors(team).border;

const ROW_H = 92;
const HDR_H = 30;
const PER_W = 60;

function GameCard({ game }: { game: RecapGame }) {
  const tie = game.awayScore === game.homeScore;
  const sides = [
    { team: game.awayTeam, score: game.awayScore, per: game.lineScore?.away ?? null, won: tie || game.awayScore > game.homeScore },
    { team: game.homeTeam, score: game.homeScore, per: game.lineScore?.home ?? null, won: tie || game.homeScore > game.awayScore },
  ];
  const labels = game.lineScore?.labels ?? [];
  const meta = [game.rink, game.time].filter(Boolean).join(" · ");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: "rgba(255,255,255,0.72)",
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: 36,
        padding: "30px 44px 28px",
        marginBottom: 24,
        boxShadow: "0 10px 40px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: NAMEPLATE, fontWeight: 700, fontSize: 24, letterSpacing: 3.5, textTransform: "uppercase", color: GREY }}>
        <div style={{ display: "flex" }}>{meta}</div>
        <div style={{ display: "flex" }}>{tie ? "Final · Tie" : "Final"}</div>
      </div>

      <div style={{ display: "flex", marginTop: 8 }}>
        {/* Teams column */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", height: HDR_H }} />
          {sides.map((s) => {
            const logo = teamLogoDataUri(s.team);
            return (
              <div key={s.team} style={{ display: "flex", alignItems: "center", height: ROW_H }}>
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- satori requires raw <img>
                  <img src={logo} alt="" width={72} height={72} style={{ objectFit: "contain", marginRight: 22 }} />
                ) : null}
                <div
                  style={{
                    display: "flex",
                    fontFamily: NAMEPLATE,
                    fontWeight: 800,
                    fontSize: 50,
                    lineHeight: 1,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    borderLeft: `8px solid ${accent(s.team)}`,
                    paddingLeft: 18,
                    color: s.won ? OG_COLORS.text : GREY,
                  }}
                >
                  {s.team}
                </div>
              </div>
            );
          })}
        </div>

        {/* One column per period: its label sits above its own numbers. */}
        {labels.map((label, i) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: PER_W }}>
            <div style={{ display: "flex", alignItems: "center", height: HDR_H, fontFamily: NAMEPLATE, fontWeight: 700, fontSize: 22, letterSpacing: 2, color: "#aeaeb2" }}>
              {label}
            </div>
            {sides.map((s) => (
              <div key={s.team} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: ROW_H, fontSize: 28, fontWeight: 500, color: GREY }}>
                {String(s.per?.[i] ?? 0)}
              </div>
            ))}
          </div>
        ))}

        {/* Score column */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: 130, marginLeft: 12 }}>
          <div style={{ display: "flex", height: HDR_H }} />
          {sides.map((s) => (
            <div key={s.team} style={{ display: "flex", alignItems: "center", height: ROW_H }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: NAMEPLATE,
                  fontWeight: 800,
                  fontSize: 80,
                  lineHeight: 1,
                  color: s.won ? OG_COLORS.text : GREY,
                  paddingBottom: 4,
                  borderBottom: `6px solid ${s.won ? accent(s.team) : "transparent"}`,
                }}
              >
                {String(s.score)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {game.stars.length ? (
        <div style={{ display: "flex", marginTop: "auto", borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 20 }}>
          {game.stars.map((st, i) => (
            <StarCell key={st.rank} star={st} last={i === game.stars.length - 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const ORD = ["1st", "2nd", "3rd"];

function StarCell({ star, last }: { star: Star; last: boolean }) {
  const line = star.goalsAgainst !== null ? `${star.goalsAgainst} GA` : [star.goals ? `${star.goals}G` : "", star.assists ? `${star.assists}A` : ""].filter(Boolean).join(" ") || "0 P";
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, marginRight: last ? 0 : 18 }}>
      <div style={{ display: "flex", fontFamily: NAMEPLATE, fontWeight: 700, fontSize: 21, letterSpacing: 3.5, textTransform: "uppercase", color: GREY }}>
        {`${ORD[star.rank - 1] ?? star.rank} star`}
      </div>
      <div style={{ display: "flex", marginTop: 6, fontSize: 28, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.15, color: OG_COLORS.text, whiteSpace: "nowrap" }}>
        {star.playerName}
      </div>
      <div style={{ display: "flex", alignItems: "center", marginTop: 4, fontSize: 22, fontWeight: 500, color: OG_COLORS.muted }}>
        <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: accent(star.team), marginRight: 8 }} />
        <div style={{ display: "flex" }}>{line}</div>
      </div>
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const recap = await getRecap(date);
  if (!recap) {
    return new ImageResponse(<DefaultLeagueCard />, { width: 1200, height: 630 });
  }

  const week = weekLabel(recap);
  const kicker = [week, shortDate(recap.date)].filter(Boolean).join(" · ");
  const streaks = recap.milestones.filter((m) => m.kind === "streak");
  const milestones = recap.milestones.filter((m) => m.kind !== "streak").slice(0, 4);
  // Longest active streak only: "6-game point streak · A, B, C + 3 more"
  const longest = streaks.filter((m) => m.label === streaks[0]?.label);
  const named = longest.slice(0, 3).map((m) => m.playerName).join(", ");
  const extra = longest.length - 3;
  const streakChip = longest.length
    ? `${longest[0].label}${longest.length > 1 ? "s" : ""} · ${named}${extra > 0 ? ` + ${extra} more` : ""}`
    : null;
  const logo = publicImageDataUri("ohl_logo.png");
  // Two games fill the card; shrink to fit if a night ever runs three.
  const crowded = recap.games.length > 2;

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
            <div style={{ display: "flex", fontWeight: 800, fontSize: 64, lineHeight: 1, letterSpacing: 1, textTransform: "uppercase", color: OG_COLORS.text }}>Finals</div>
          </div>
        </div>

        {recap.games.slice(0, crowded ? 3 : 2).map((g) => (
          <GameCard key={g.id} game={g} />
        ))}

        {milestones.length || streakChip ? (
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 16, padding: "0 12px" }}>
            <div style={{ display: "flex", fontFamily: NAMEPLATE, fontWeight: 700, fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color: GREY }}>Milestones</div>
            <div style={{ display: "flex", flexWrap: "wrap", marginTop: 6 }}>
              {milestones.map((m, i) => (
                <div key={`${m.kind}-${m.playerId}-${i}`} style={{ display: "flex", fontSize: 22, fontWeight: 600, color: OG_COLORS.text, marginRight: 28, marginTop: 2 }}>
                  {`${m.playerName} · ${m.label}`}
                </div>
              ))}
              {streakChip ? (
                <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: OG_COLORS.text, marginRight: 28, marginTop: 2 }}>{streakChip}</div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "center", fontFamily: NAMEPLATE, fontWeight: 700, fontSize: 24, letterSpacing: 5, textTransform: "uppercase", color: GREY }}>
          outlawhl.com
        </div>
      </div>
    ),
    { ...SIZE, fonts: loadFonts(), headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
