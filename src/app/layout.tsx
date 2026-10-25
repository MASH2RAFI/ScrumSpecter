import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-providor";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
});

export const metadata: Metadata = {
  title: "ScrumSpecter - Project Management Tool",
  description: "A modern project management and task tracking application",
  keywords: ["project management", "task tracking", "scrum", "kanban"],
  authors: [{ name: "ScrumSpecter Team" }],
  robots: "index, follow",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className={cn("antialiased min-h-screen")}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="scrumspecter-theme"
        >
          <QueryProvider>
            <Toaster />
            {children}
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
