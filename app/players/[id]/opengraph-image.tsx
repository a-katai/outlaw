import { ImageResponse } from "next/og";
import { getPlayerProfile } from "@/lib/players";
import { DefaultLeagueCard, OG_COLORS, OG_CONTENT_TYPE, OG_SIZE, OhlWordmark, publicImageDataUri, teamLogoDataUri } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "Player — Outlaw Hockey League";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getPlayerProfile(id);
  if (!profile) {
    return new ImageResponse(<DefaultLeagueCard />, { ...size });
  }

  const teamLogo = profile.teamName ? teamLogoDataUri(profile.teamName) : null;
  const markSrc = teamLogo ?? publicImageDataUri("ohl_logo_2.png");
  const markSize = teamLogo ? 200 : 160;

  const line = [profile.position, profile.rank ? `Rank ${profile.rank}` : null].filter(Boolean).join(" · ");

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
          <img src={markSrc} alt="" width={markSize} height={markSize} style={{ objectFit: "contain" }} />
          <div style={{ marginTop: 32, fontSize: 68, fontWeight: 700, color: OG_COLORS.text, letterSpacing: -1, textAlign: "center" }}>
            {profile.name}
          </div>
          {line ? (
            <div style={{ marginTop: 18, fontSize: 28, fontWeight: 500, color: OG_COLORS.muted }}>{line}</div>
          ) : null}
        </div>
      </div>
    ),
    { ...size },
  );
}
