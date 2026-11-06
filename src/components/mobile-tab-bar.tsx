"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { usePrefetchPage } from "@/features/workspaces/hooks/use-prefetch-page";

import { routes, useWaitingRequests } from "./navigation";

// Phones: the pages people switch between most, one tap away at the bottom of the screen. Everything
// else (Members, Settings, Analytics, projects, workspaces) stays in the menu at the top.
export const MobileTabBar = () => {
    const workspaceId = useWorkspaceId();
    const pathname = usePathname();
    // Not rendered at all on wider screens, where the sidebar shows the same pages and badge
    const phone = useMediaQuery("(max-width: 767px)", false);
    const { isViewer, waiting } = useWaitingRequests(phone ? workspaceId : "");
    const prefetch = usePrefetchPage();
    if (!workspaceId || !phone) return null;

    const hrefs = ["", "/tasks", "/routines", isViewer ? "/analytics" : "/requests"];
    const tabs = hrefs.map((href) => routes.find((route) => route.href === href)!);

    return (
        <nav
            aria-label="Main pages"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
            <ul className="grid grid-cols-4">
                {tabs.map(({ label, href, icon: Icon }) => {
                    const fullHref = `/workspaces/${workspaceId}${href}`;
                    // A task's own page still counts as My Tasks
                    const active = href ? pathname.startsWith(fullHref) : pathname === fullHref;
                    return (
                        <li key={href}>
                            <Link
                                href={fullHref}
                                aria-current={active ? "page" : undefined}
                                // A touch starts the page's data loading before the finger lifts
                                onPointerEnter={() => prefetch(workspaceId, href)}
                                className={cn(
                                    "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-200 ease-out",
                                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                <Icon className="size-5" />
                                {label}
                                {href === "/requests" && waiting > 0 && (
                                    <span className="absolute left-1/2 top-2 ml-2 rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold leading-4 text-white" aria-label={`${waiting} waiting for review`}>
                                        {waiting}
                                    </span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
};
