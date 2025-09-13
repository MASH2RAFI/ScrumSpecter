import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-providor";
import { PerformanceMonitor } from "@/components/performance-monitor";
import { ThemeProvider } from "@/components/theme-provider";
import { NeuralBackground } from "@/components/neural-background";
import { AuthGuard } from "@/components/auth-guard";
import { PersonalTodoWidget } from "@/components/personal-todo-list";

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
  viewport: "width=device-width, initial-scale=1",
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
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={cn("antialiased min-h-screen")}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="scrumspecter-theme"
        >
          <QueryProvider>
            <AuthGuard>
              <NeuralBackground />
              <PerformanceMonitor />
              <Toaster />
              {children}
              <PersonalTodoWidget />
            </AuthGuard>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
