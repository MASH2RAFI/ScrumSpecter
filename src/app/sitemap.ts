import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://scrumspecter.vercel.app";

// Only the public pages; the app itself needs an account
export default function sitemap(): MetadataRoute.Sitemap {
    return ["/about", "/sign-up", "/sign-in", "/privacy", "/terms"].map((path) => ({
        url: `${SITE}${path}`,
        changeFrequency: "monthly",
        priority: path === "/about" ? 1 : 0.5,
    }));
}
