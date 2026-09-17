import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/shame/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, noimageindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/shame",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, noimageindex, nofollow, noarchive" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
  },
};

export default nextConfig;
