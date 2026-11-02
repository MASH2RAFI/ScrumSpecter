import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Plus_Jakarta_Sans } from "next/font/google";

import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { QueryProvider } from "@/components/query-providor";
import { ThemeProvider } from "@/components/theme-provider";
import { MotionProvider } from "@/components/motion";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-sans",
  fallback: ["system-ui", "arial"],
});

export const metadata: Metadata = {
  title: "ScrumSpecter - Project Management Tool",
  description: "A modern project management and task tracking application",
  keywords: ["project management", "task tracking", "scrum", "kanban"],
  authors: [{ name: "ScrumSpecter Team" }],
  robots: "index, follow",
  // Added to an iPhone's home screen, it opens like an app (and can get push notifications)
  appleWebApp: {
    capable: true,
    title: "ScrumSpecter",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    title: "ScrumSpecter",
    description: "A modern project management and task tracking application",
  },
  twitter: {
    card: "summary_large_image",
    title: "ScrumSpecter",
    description: "A modern project management and task tracking application",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout(
  {
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>
) {
  // Set by src/proxy.ts; reading it renders every page per request, which a nonce needs
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <body className={cn("antialiased min-h-screen")}>
        <ThemeProvider
          nonce={nonce}
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="scrumspecter-theme"
        >
          {/* nuqs 2: URL state (filters, tabs, views) needs the App Router adapter */}
          <NuqsAdapter>
          <QueryProvider>
            <MotionProvider>
              <Toaster />
              {children}
            </MotionProvider>
          </QueryProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
