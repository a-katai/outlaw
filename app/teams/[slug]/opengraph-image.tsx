import { ImageResponse } from "next/og";
import { getActiveSeasonLive } from "@/lib/live-season";
import { teamNameFromSlug } from "@/lib/team-logos";
import { DefaultLeagueCard, OG_COLORS, OG_CONTENT_TYPE, OG_SIZE, OhlWordmark, teamLogoDataUri } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "Team — Outlaw Hockey League";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const teamName = teamNameFromSlug(slug);
  if (!teamName) {
    return new ImageResponse(<DefaultLeagueCard />, { ...size });
  }

  const season = await getActiveSeasonLive();
  const record = season?.standings.find((s) => s.team === teamName) ?? null;
  const hasFinals = season?.standings.some((s) => s.gp > 0) ?? false;
  const recordLine =
    hasFinals && record ? `${record.wins}-${record.losses}-${record.ties} · ${record.points} PTS` : "First game September 9";

  const logo = teamLogoDataUri(teamName);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: OG_COLORS.bg,
          padding: "56px 80px",
        }}
      >
        <div style={{ display: "flex" }}>
          <OhlWordmark height={40} />
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {logo ? (
            <img src={logo} alt="" width={260} height={260} style={{ objectFit: "contain" }} />
          ) : null}
          <div style={{ marginTop: 32, fontSize: 68, fontWeight: 700, color: OG_COLORS.text, letterSpacing: -1 }}>
            {teamName}
          </div>
          <div style={{ marginTop: 18, fontSize: 30, fontWeight: 500, color: OG_COLORS.muted }}>{recordLine}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
