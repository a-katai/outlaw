import type { MetadataRoute } from "next";

/**
 * The Wall of Shame is a joke among teammates and stays out of search results
 * — a guy's name next to a fake charge is funny in the room and not funny in
 * a search for him. `public/shame/*.jpg` serves under the same path prefix as
 * the route, so one rule covers the page and the photos.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/shame" },
    host: "https://www.outlawhl.com",
  };
}
