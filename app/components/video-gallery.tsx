"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { matchTeamFilm } from "@/lib/game-film";
import { TEAM_SLUG_LIST, TeamLogo, teamNameFromSlug } from "@/lib/team-logos";

export type VideoItem = {
  id: string;
  title: string;
  matchup: string;
  gameDate: string;
  subtitle: string;
  url: string;
  thumbnail: string;
};

const PAGE_SIZE = 12;

function chipClass(active: boolean): string {
  return `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
    active
      ? "border-neutral-900 bg-neutral-900 text-white"
      : "border-black/10 bg-white/80 text-neutral-600 hover:border-black/20 hover:text-neutral-900"
  }`;
}

function TeamFilterChips({
  selectedSlug,
  onSelect,
}: {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => onSelect(null)} className={chipClass(selectedSlug === null)}>
        All
      </button>
      {TEAM_SLUG_LIST.map((slug) => {
        const name = teamNameFromSlug(slug);
        if (!name) return null;
        return (
          <button key={slug} type="button" onClick={() => onSelect(slug)} className={chipClass(selectedSlug === slug)}>
            <TeamLogo name={name} size={18} />
            {name}
          </button>
        );
      })}
    </div>
  );
}

export function VideoGallery({ videos }: { videos: VideoItem[] }) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filteredVideos = useMemo(() => {
    const teamName = selectedSlug ? teamNameFromSlug(selectedSlug) : null;
    if (!teamName) return videos;
    return matchTeamFilm(videos, teamName);
  }, [videos, selectedSlug]);

  // Filter changed — restart pagination from the top of the (possibly
  // shorter) filtered list. Adjusted during render (not an effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [prevSlug, setPrevSlug] = useState(selectedSlug);
  if (selectedSlug !== prevSlug) {
    setPrevSlug(selectedSlug);
    setVisibleCount(PAGE_SIZE);
  }

  const visibleVideos = useMemo(() => filteredVideos.slice(0, visibleCount), [filteredVideos, visibleCount]);
  const hasMore = visibleCount < filteredVideos.length;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        setVisibleCount((count) => Math.min(count + PAGE_SIZE, filteredVideos.length));
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, filteredVideos.length]);

  return (
    <>
      <TeamFilterChips selectedSlug={selectedSlug} onSelect={setSelectedSlug} />

      {filteredVideos.length === 0 ? (
        <div className="glass-card rounded-3xl p-6 text-center text-sm text-neutral-600">
          No videos found for this team yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleVideos.map((video) => (
            <article key={video.id} className="glass-card lift overflow-hidden rounded-3xl">
              <a href={video.url} target="_blank" rel="noreferrer" className="block">
                <div className="relative aspect-video w-full">
                  <Image
                    src={video.thumbnail}
                    alt={video.title}
                    fill
                    sizes="(min-width: 1280px) 352px, (min-width: 768px) 45vw, 100vw"
                    className="object-cover"
                    loading="lazy"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-black/20" />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
                      <span
                        className="ml-1 block h-0 w-0 border-y-[9px] border-y-transparent border-l-[14px] border-l-neutral-900"
                        aria-hidden
                      />
                    </span>
                  </div>
                  <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/80 p-1.5 backdrop-blur">
                    <Image src="/ohl_logo_letters.png" alt="OHL" width={61} height={22} className="h-4 w-auto object-contain" loading="lazy" />
                  </div>
                </div>
                <div className="p-5">
                  <h2 className="line-clamp-2 text-base font-semibold text-neutral-900">{video.matchup}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{video.subtitle}</p>
                  <p className="mt-2 text-sm font-medium text-neutral-500">{video.gameDate}</p>
                </div>
              </a>
            </article>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-8 w-full" aria-hidden />
      <p className="text-center text-xs text-neutral-500">
        Showing {visibleVideos.length} of {filteredVideos.length} videos
      </p>
    </>
  );
}
