import { VideoGallery, type VideoItem } from "@/app/components/video-gallery";
import videosData from "@/videos-data.json";

export default async function VideosPage() {
  const videos = [...(videosData as VideoItem[])].reverse();

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
