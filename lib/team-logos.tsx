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
