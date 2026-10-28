import type { MetadataRoute } from "next";

// Lets ScrumSpecter be installed (needed for push notifications on iPhone/iPad)
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "ScrumSpecter",
        short_name: "ScrumSpecter",
        description: "Sprint planning, tasks and reminders",
        start_url: "/",
        display: "standalone",
        background_color: "#e8ece9",
        theme_color: "#1b6e45",
        icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
