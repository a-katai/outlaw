import type { MetadataRoute } from "next";

/**
 * Nothing to hide any more — /shame is gone and 404s, which is what actually
 * gets it dropped from an index. A Disallow would have blocked the recrawl
 * that discovers the 404, so the rule came off with the page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    host: "https://www.outlawhl.com",
  };
}
