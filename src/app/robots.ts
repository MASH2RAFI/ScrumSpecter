import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://scrumspecter.vercel.app";

// Search engines may index the public pages; everything behind sign-in and the API stays out
export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/workspaces/", "/account", "/reset-password", "/verify-email"] },
        sitemap: `${SITE}/sitemap.xml`,
    };
}
