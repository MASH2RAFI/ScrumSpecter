"use client";

import { cn } from "@/lib/utils";

import { CommandPalette } from "./command-palette";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";
import { SidebarProvider, useSidebar } from "./sidebar-context";

const Shell = ({ children }: { children: React.ReactNode }) => {
    const { collapsed } = useSidebar();

    return (
        <div className="flex w-full h-full">
            <div className={cn(
                "fixed left-0 top-0 hidden lg:block h-full overflow-y-auto overflow-x-hidden border-r border-border/50 transition-[width] duration-200",
                collapsed ? "lg:w-[76px]" : "lg:w-[264px]"
            )}>
                <Sidebar />
            </div>
            <div className={cn("w-full transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]")}>
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
        <Shell>{children}</Shell>
    </SidebarProvider>
);
