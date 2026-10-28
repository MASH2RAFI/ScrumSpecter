"use client";

import { cn } from "@/lib/utils";
import { useDataVersions } from "@/features/workspaces/hooks/use-data-versions";

import { WelcomeTour } from "@/features/onboarding/components/welcome-tour";

import { CommandPalette } from "./command-palette";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";
import { SidebarProvider, useSidebar } from "./sidebar-context";

const Shell = ({ children }: { children: React.ReactNode }) => {
    const { collapsed, pinned, reveal, conceal } = useSidebar();
    useDataVersions();

    return (
        <div className="flex w-full h-full">
            {/* Auto-hide: icons only until hovered, then it slides out over the page.
                The contents keep their full width and are clipped, so nothing reflows. */}
            <div
                className={cn(
                    // An inset panel floating on the page
                    "fixed left-3 top-3 bottom-3 z-50 hidden lg:block overflow-hidden rounded-panel border border-border/70 bg-panel shadow-soft",
                    "transition-[width,box-shadow] duration-500 ease-out motion-reduce:transition-none",
                    collapsed ? "lg:w-[76px]" : "lg:w-[264px]",
                    !collapsed && !pinned && "shadow-lift",
                )}
                onMouseEnter={reveal}
                // Folded while the pointer stayed on it (another window took focus): no new
                // mouseenter comes, so the next movement opens it
                onMouseMove={collapsed ? reveal : undefined}
                onMouseLeave={conceal}
                // Keyboard focus only: coming back to the window refocuses the link last
                // clicked, which shouldn't unfold the sidebar again
                onFocus={(e) => {
                    if (e.target.matches(":focus-visible")) reveal();
                }}
                onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) conceal();
                }}
            >
                <div className="h-full w-[264px] overflow-hidden">
                    <Sidebar />
                </div>
            </div>
            <div className={cn("w-full transition-[padding] duration-500 ease-out motion-reduce:transition-none", pinned ? "lg:pl-[276px]" : "lg:pl-[88px]")}>
                <div className="mx-auto max-w-screen-2xl h-full">
                    <Navbar />
                    <main className="h-full py-4 sm:py-6 lg:py-8 px-4 sm:px-6 flex flex-col mobile-scroll">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
};

export const DashboardShell = ({ children }: { children: React.ReactNode }) => (
    <SidebarProvider>
        <CommandPalette />
        <WelcomeTour />
        <Shell>{children}</Shell>
    </SidebarProvider>
);
