import { VideoGallery, type VideoItem } from "@/app/components/video-gallery";

const CHANNEL_VIDEOS_URL = "https://www.youtube.com/@outlawhockeyleague9642/videos";

function parseVideoTitle(rawTitle: string): Pick<VideoItem, "matchup" | "gameDate" | "subtitle"> {
  // Expected pattern:
  // OHL 04-22-2026 Trashers vs Tankfillers (Stands facing Trashers bench)
  const clean = rawTitle.replace(/^OHL\s+/i, "").trim();
  const firstSpace = clean.indexOf(" ");
  const maybeDate = firstSpace > -1 ? clean.slice(0, firstSpace) : "";
  const rest = firstSpace > -1 ? clean.slice(firstSpace + 1).trim() : clean;
  let date = "Date TBD";
  if (/^\d{2}-\d{2}-\d{4}$/.test(maybeDate)) {
    const [mm, dd, yyyy] = maybeDate.split("-").map((part) => Number(part));
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const month = monthNames[mm - 1];
    if (month) date = `${dd} ${month} ${yyyy}`;
  }

  const parenStart = rest.lastIndexOf("(");
  const parenEnd = rest.endsWith(")") ? rest.length - 1 : -1;
  const subtitle =
    parenStart > -1 && parenEnd > parenStart ? rest.slice(parenStart + 1, parenEnd).trim() : "Game Coverage";
  const matchup = (parenStart > -1 ? rest.slice(0, parenStart) : rest).trim() || "OHL Matchup";

  return { matchup, gameDate: date, subtitle };
}

function extractJsonBlock(source: string, marker: string): unknown | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;
  const start = source.indexOf("{", markerIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const raw = source.slice(start, i + 1);
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function collectVideosFromJsonNode(node: unknown, unique: Map<string, VideoItem>) {
  if (!node || typeof node !== "object") return;

  const maybe = node as Record<string, unknown>;
  if (typeof maybe.videoId === "string" && !unique.has(maybe.videoId)) {
    const titleNode = maybe.title as
      | { runs?: Array<{ text?: string }>; simpleText?: string }
      | undefined;
    const title =
      titleNode?.runs?.[0]?.text?.trim() ??
      titleNode?.simpleText?.trim() ??
      "";
    if (title && title.toLowerCase() !== "keyboard shortcuts") {
      const parsed = parseVideoTitle(title);
      unique.set(maybe.videoId, {
        id: maybe.videoId,
        title,
        matchup: parsed.matchup,
        gameDate: parsed.gameDate,
        subtitle: parsed.subtitle,
        url: `https://www.youtube.com/watch?v=${maybe.videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${maybe.videoId}/hqdefault.jpg`,
      });
    }
  }

  for (const value of Object.values(maybe)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => collectVideosFromJsonNode(entry, unique));
    } else if (value && typeof value === "object") {
      collectVideosFromJsonNode(value, unique);
    }
  }
}

function findContinuationToken(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const maybe = node as Record<string, unknown>;
  if (typeof maybe.token === "string") return maybe.token;
  for (const value of Object.values(maybe)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = findContinuationToken(entry);
        if (found) return found;
      }
    } else if (value && typeof value === "object") {
      const found = findContinuationToken(value);
      if (found) return found;
    }
  }
  return null;
}

async function getChannelVideos(): Promise<VideoItem[]> {
  try {
    const response = await fetch(CHANNEL_VIDEOS_URL, {
      next: { revalidate: 60 * 60 * 12 },
      headers: {
        // Helps ensure we receive renderable HTML from YouTube.
        "User-Agent": "Mozilla/5.0",
      },
    });
    const html = await response.text();
    const unique = new Map<string, VideoItem>();
    const initialData = extractJsonBlock(html, "var ytInitialData = ");
    const ytcfg = extractJsonBlock(html, "ytcfg.set(") as
      | {
          INNERTUBE_API_KEY?: string;
          INNERTUBE_CLIENT_VERSION?: string;
          INNERTUBE_CONTEXT?: unknown;
        }
      | null;

    collectVideosFromJsonNode(initialData, unique);

    const apiKey = ytcfg?.INNERTUBE_API_KEY;
    const context = ytcfg?.INNERTUBE_CONTEXT;
    let continuationToken = findContinuationToken(initialData);
    let safety = 0;

    while (continuationToken && apiKey && context && safety < 20) {
      safety += 1;
      const continuationRes = await fetch(
        `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}&prettyPrint=false`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
          },
          body: JSON.stringify({
            context,
            continuation: continuationToken,
          }),
          next: { revalidate: 60 * 60 * 12 },
        },
      );

      if (!continuationRes.ok) break;
      const continuationJson = (await continuationRes.json()) as unknown;
      collectVideosFromJsonNode(continuationJson, unique);

      const nextToken = findContinuationToken(continuationJson);
      if (!nextToken || nextToken === continuationToken) break;
      continuationToken = nextToken;
    }

    return Array.from(unique.values());
  } catch {
    return [];
  }
}

export default async function VideosPage() {
  const videos = await getChannelVideos();

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">League Hub</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-900">Videos</h1>
        <p className="mt-3 text-neutral-600">Latest videos from your Outlaw Hockey League YouTube channel.</p>
      </div>

      {videos.length > 0 ? (
        <VideoGallery videos={videos} />
      ) : (
        <div className="glass-card rounded-3xl p-6 text-sm text-neutral-600">
          Could not load videos right now. Please try again in a moment.
        </div>
      )}
    </section>
  );
}
