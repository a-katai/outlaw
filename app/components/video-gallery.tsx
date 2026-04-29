"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

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

export function VideoGallery({ videos }: { videos: VideoItem[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const visibleVideos = useMemo(() => videos.slice(0, visibleCount), [videos, visibleCount]);
  const hasMore = visibleCount < videos.length;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        setVisibleCount((count) => Math.min(count + PAGE_SIZE, videos.length));
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, videos.length]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleVideos.map((video) => (
          <article key={video.id} className="glass-card lift overflow-hidden rounded-3xl">
            <a href={video.url} target="_blank" rel="noreferrer" className="block">
              <div className="relative aspect-video w-full">
                <Image src={video.thumbnail} alt={video.title} fill className="object-cover" loading="lazy" />
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
                  <Image src="/ohl_logo_letters.png" alt="OHL" width={80} height={22} className="h-4 w-auto object-contain" loading="lazy" />
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

      <div ref={sentinelRef} className="h-8 w-full" aria-hidden />
      <p className="text-center text-xs text-neutral-500">
        Showing {visibleVideos.length} of {videos.length} videos
      </p>
    </>
  );
}
