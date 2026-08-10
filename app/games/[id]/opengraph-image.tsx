import { ImageResponse } from "next/og";
import { getGameDetail, type GameDetail } from "@/lib/live-season";
import { getTeamColors } from "@/lib/league-data";
import { DefaultLeagueCard, OG_COLORS, OG_CONTENT_TYPE, OG_SIZE, OhlWordmark, teamLogoDataUri } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "Game — Outlaw Hockey League";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

function formatGameDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function TeamBlock({ name, dim }: { name: string; dim: boolean }) {
  const logo = teamLogoDataUri(name);
  const colors = getTeamColors(name);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: dim ? 0.4 : 1 }}>
      {logo ? (
        <img src={logo} alt="" width={220} height={220} style={{ objectFit: "contain" }} />
      ) : (
        <div style={{ display: "flex", width: 220, height: 220, borderRadius: 110, background: colors.border }} />
      )}
      <div style={{ marginTop: 24, fontSize: 32, fontWeight: 600, color: OG_COLORS.text, textAlign: "center" }}>
        {name}
      </div>
    </div>
  );
}

/**
 * Pure render of the game card from a GameDetail — no data fetching. Split
 * out from the default export so it's directly testable (e.g. simulating a
 * FINAL card, which the pre-season DB has none of, from a hand-built
 * GameDetail) without needing a real DB row.
 */
export function GameOgCard({ game }: { game: GameDetail }) {
  const isFinal = game.status === "final" && game.homeScore !== null && game.awayScore !== null;
  const isLive = game.status === "live";
  const homeWins = isFinal && (game.homeScore as number) > (game.awayScore as number);
  const awayWins = isFinal && (game.awayScore as number) > (game.homeScore as number);

  const metaLine = isFinal
    ? `Final · ${formatGameDate(game.date)}`
    : [formatGameDate(game.date), game.time].filter(Boolean).join(" · ");

  // Note: every leaf <div> below whose only child is a number (a score, not
  // literal text) needs an explicit `display` — satori throws on a non-string
  // child otherwise, even when there's just the one.
  let center: React.ReactNode;
  if (isFinal) {
    center = (
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <div
          style={{
            display: "flex",
            fontSize: 128,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: awayWins ? OG_COLORS.text : OG_COLORS.dim,
          }}
        >
          {game.awayScore}
        </div>
        <div style={{ display: "flex", fontSize: 48, color: OG_COLORS.dim }}>–</div>
        <div
          style={{
            display: "flex",
            fontSize: 128,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: homeWins ? OG_COLORS.text : OG_COLORS.dim,
          }}
        >
          {game.homeScore}
        </div>
      </div>
    );
  } else if (isLive) {
    center = (
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{ display: "flex", fontSize: 84, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: OG_COLORS.text }}
        >
          {game.awayScore ?? 0}
        </div>
        <div style={{ display: "flex", fontSize: 40, color: OG_COLORS.dim }}>–</div>
        <div
          style={{ display: "flex", fontSize: 84, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: OG_COLORS.text }}
        >
          {game.homeScore ?? 0}
        </div>
      </div>
    );
  } else {
    center = <div style={{ fontSize: 34, fontWeight: 500, color: OG_COLORS.muted }}>at</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: OG_COLORS.bg,
        padding: "56px 80px",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <OhlWordmark height={40} />
        {isLive ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: OG_COLORS.liveBg,
              border: `1px solid ${OG_COLORS.liveBorder}`,
              borderRadius: 999,
              padding: "10px 22px",
            }}
          >
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: OG_COLORS.live }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: "#be123c", letterSpacing: 2 }}>LIVE</div>
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 56 }}>
        <TeamBlock name={game.awayTeam} dim={isFinal && homeWins} />
        {center}
        <TeamBlock name={game.homeTeam} dim={isFinal && awayWins} />
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 500, color: OG_COLORS.muted }}>{metaLine}</div>
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGameDetail(id);

  if (!game) {
    return new ImageResponse(<DefaultLeagueCard />, { ...size });
  }

  return new ImageResponse(<GameOgCard game={game} />, { ...size });
}
