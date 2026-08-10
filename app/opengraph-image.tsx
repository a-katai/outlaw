import { ImageResponse } from "next/og";
import { DefaultLeagueCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-helpers";

export const runtime = "nodejs";
export const alt = "Outlaw Hockey League";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return new ImageResponse(<DefaultLeagueCard />, { ...size });
}
