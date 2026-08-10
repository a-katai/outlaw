import Image from "next/image";

// Normalized (trimmed, lowercased) team name -> transparent-background PNG in
// public/teams/. Only the five teams with real logo assets on file get an
// entry — everything else (Krushers, "Sub", archive-only names) resolves to
// null and every call site must fall back to what it rendered before this
// file existed (a color dot or a plain text pill), never a broken <img>.
const TEAM_LOGOS: Record<string, string> = {
  "wednesday knights": "/teams/wednesday-knights.png",
  "toe dragons": "/teams/toe-dragons.png",
  "ghost pirates": "/teams/ghost-pirates.png",
  "tank fillers": "/teams/tank-fillers.png",
  trashers: "/teams/trashers.png",
};

/** Path to a team's logo asset, or null when the team has no logo on file. */
export function teamLogo(name: string | null | undefined): string | null {
  if (!name) return null;
  return TEAM_LOGOS[name.trim().toLowerCase()] ?? null;
}

// Canonical display name by /teams/[slug] route slug — the same five teams
// that have logo assets on file. Order here is the display order used by the
// /teams index and the video team-filter chips.
const TEAM_NAMES_BY_SLUG: Record<string, string> = {
  "wednesday-knights": "Wednesday Knights",
  "toe-dragons": "Toe Dragons",
  "ghost-pirates": "Ghost Pirates",
  "tank-fillers": "Tank Fillers",
  trashers: "Trashers",
};

/** Ordered list of every routable team slug — the fixed five, display order. */
export const TEAM_SLUG_LIST: string[] = Object.keys(TEAM_NAMES_BY_SLUG);

/** Route slug for a team name, or null when the team has no team page (e.g. "Sub", "Krushers"). */
export function teamSlug(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim().toLowerCase();
  for (const [slug, canonicalName] of Object.entries(TEAM_NAMES_BY_SLUG)) {
    if (canonicalName.toLowerCase() === trimmed) return slug;
  }
  return null;
}

/** Canonical team name for a /teams/[slug] route slug, or null when the slug isn't one of the five teams. */
export function teamNameFromSlug(slug: string): string | null {
  return TEAM_NAMES_BY_SLUG[slug] ?? null;
}

/**
 * Fixed square box, logo centered with object-contain (the source PNGs are
 * non-square). Renders nothing when the team has no logo — callers decide
 * the fallback (dot, pill-only, etc.), this component never shows a broken
 * image for an unknown team.
 */
export function TeamLogo({
  name,
  size,
  className = "",
}: {
  name: string;
  size: number;
  className?: string;
}) {
  const src = teamLogo(name);
  if (!src) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={`${name} logo`}
        width={size}
        height={size}
        sizes={`${size}px`}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
