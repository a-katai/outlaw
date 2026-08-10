import fs from "node:fs";
import path from "node:path";
import { teamLogo } from "./team-logos";

// Shared building blocks for every app/**/opengraph-image.tsx route. These
// run on the node runtime so they can read public/ assets straight off disk
// (ImageResponse can't fetch its own origin) and inline them as base64 data
// URIs — the only way satori can render an <img>.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const dataUriCache = new Map<string, string>();

/** Reads a public/ asset (path relative to public/, e.g. "ohl_logo_2.png") and returns a base64 data URI. Cached per warm server instance. */
export function publicImageDataUri(relPath: string): string {
  const cached = dataUriCache.get(relPath);
  if (cached) return cached;
  const buf = fs.readFileSync(path.join(PUBLIC_DIR, relPath));
  const uri = `data:image/png;base64,${buf.toString("base64")}`;
  dataUriCache.set(relPath, uri);
  return uri;
}

/** Data URI for a team's logo asset, or null when the team has no logo on file (mirrors lib/team-logos' teamLogo). */
export function teamLogoDataUri(name: string | null | undefined): string | null {
  const src = teamLogo(name);
  if (!src) return null;
  return publicImageDataUri(src.replace(/^\//, ""));
}

// Light aesthetic matching app/globals.css — #f5f5f7 bg, neutral-900 text.
export const OG_COLORS = {
  bg: "#f5f5f7",
  card: "#ffffff",
  text: "#1d1d1f",
  muted: "#6e6e73",
  dim: "#a1a1a6",
  border: "#d2d2d7",
  live: "#e11d48",
  liveBg: "#fff1f2",
  liveBorder: "#fecdd3",
};

/** Small top-of-card brand mark used across every OG route for a consistent system. */
export function OhlWordmark({ height = 40 }: { height?: number }) {
  const src = publicImageDataUri("ohl_logo_letters.png");
  const width = Math.round(height * (1640 / 589));
  // ImageResponse (satori) only understands raw <img> — next/image doesn't render here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={width} height={height} style={{ objectFit: "contain" }} />;
}

/**
 * League default card — the site's root OG image, and the fallback every
 * dynamic route (bad game id, unknown team/player) renders instead of
 * crashing on missing data.
 */
export function DefaultLeagueCard() {
  const badge = publicImageDataUri("ohl_logo_2.png");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: OG_COLORS.bg,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- satori requires raw <img> */}
      <img src={badge} alt="" width={200} height={200} style={{ objectFit: "contain" }} />
      <div style={{ marginTop: 40, fontSize: 58, fontWeight: 700, color: OG_COLORS.text, letterSpacing: -1.5 }}>
        Outlaw Hockey League
      </div>
      <div style={{ marginTop: 16, fontSize: 28, fontWeight: 500, color: OG_COLORS.muted }}>Est. 2022</div>
    </div>
  );
}
