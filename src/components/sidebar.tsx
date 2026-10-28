"use client";

import Link from "next/link";
import { PinIcon, PinOffIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DottedSeparator } from "./dotted-separator";
import { LogoMark } from "./logo";
import { Navigation } from "./navigation";
import { Projects } from "./projects";
import { SIDEBAR_FADE, useSidebar } from "./sidebar-context";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { SidebarTourCard } from "./sidebar-tour-card";

export const Sidebar = () => {
    const { collapsed, pinned, toggle } = useSidebar();
    const PinToggleIcon = pinned ? PinOffIcon : PinIcon;

    return (
        <aside data-collapsed={collapsed} className="group/sidebar flex h-full w-full flex-col px-4 pt-5">
            <div className="flex items-center justify-between mb-6">
                <Link href="/" className="inline-flex items-center gap-2.5" aria-label="ScrumSpecter home">
                    <LogoMark size={40} />
                    <span className={cn("text-xl font-bold tracking-tight text-foreground", SIDEBAR_FADE)}>
                        ScrumSpecter
                    </span>
                </Link>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggle}
                    tabIndex={collapsed ? -1 : 0}
                    className={cn("hidden lg:inline-flex size-8 text-muted-foreground", SIDEBAR_FADE)}
                    aria-label={pinned ? "Auto-hide sidebar" : "Keep sidebar open"}
                    title={`${pinned ? "Auto-hide sidebar" : "Keep sidebar open"} (shortcut: [ key)`}
                >
                    <PinToggleIcon className="size-4" />
                </Button>
            </div>
            <DottedSeparator className={cn("my-4", SIDEBAR_FADE)} />
            {/* Stays put: the logo, the workspace and the line under it */}
            <div className="space-y-6">
                <WorkspaceSwitcher />
                <DottedSeparator className={cn("mb-0", SIDEBAR_FADE)} />
            </div>
            {/* Everything below that line scrolls. The scrollbar sits in the right-hand padding,
                so the rows keep the width the folded (icon-only) layout depends on. */}
            <div className="scrollbar-on-hover -mr-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable]">
                <div className="flex min-h-full flex-col pb-5 pt-6">
                    <div className="space-y-6">
                        <Navigation />
                        <DottedSeparator className={cn("my-4", SIDEBAR_FADE)} />
                        <Projects />
                    </div>
                    <SidebarTourCard />
                </div>
            </div>
        </aside>
    );
};
