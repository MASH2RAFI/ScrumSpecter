"use client";

import { useId } from "react";
import { LayoutGroup } from "motion/react";

import { m } from "@/components/motion";
import { cn } from "@/lib/utils";
import { BarChart3Icon, GitPullRequestArrowIcon, RepeatIcon, SettingsIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { GoHome, GoHomeFill, GoCheckCircle, GoCheckCircleFill } from "react-icons/go";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { usePathname } from "next/navigation";
import { useSidebar } from "./sidebar-context";
import { SIDEBAR_FADE, SIDEBAR_ROW } from "./sidebar-context";
import { useWorkspacePanel, type WorkspacePanel } from "@/features/workspaces/hooks/use-workspace-panel";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { useGetChangeRequests } from "@/features/change-requests/api/use-change-requests";

// Members and Settings open as popups over the current page (workspace-panel-modal.tsx)
const routes: {
    label: string;
    href: string;
    panel?: WorkspacePanel;
    icon: React.ElementType;
    activeIcon: React.ElementType;
    color: string;
    activeColor: string;
}[] = [
    {
        label: "Home",
        href: "",
        icon: GoHome,
        activeIcon: GoHomeFill,
        color: "text-muted-foreground",
        activeColor: "text-primary",
    },
    {
        label: "My Tasks",
        href: "/tasks",
        icon: GoCheckCircle,
        activeIcon: GoCheckCircleFill,
        color: "text-muted-foreground",
        activeColor: "text-primary",
    },
    {
        label: "Routines",
        href: "/routines",
        icon: RepeatIcon,
        activeIcon: RepeatIcon,
        color: "text-muted-foreground",
        activeColor: "text-primary",
    },
    {
        label: "Requests",
        href: "/requests",
        icon: GitPullRequestArrowIcon,
        activeIcon: GitPullRequestArrowIcon,
        color: "text-muted-foreground",
        activeColor: "text-primary",
    },
    {
        label: "Members",
        href: "/members",
        panel: "members",
        icon: UsersIcon,
        activeIcon: UsersIcon,
        color: "text-muted-foreground",
        activeColor: "text-primary",
    },
    {
        label: "Analytics",
        href: "/analytics",
        icon: BarChart3Icon,
        activeIcon: BarChart3Icon,
        color: "text-muted-foreground",
        activeColor: "text-primary",
    },
    {
        label: "Settings",
        href: "/settings",
        panel: "settings",
        icon: SettingsIcon,
        activeIcon: SettingsIcon,
        color: "text-muted-foreground",
        activeColor: "text-primary",
    },
];

export const Navigation = () => {

    const workspaceId = useWorkspaceId();
    const pathname = usePathname();
    const { collapsed } = useSidebar();
    const groupId = useId();
    const { panel, open: openPanel } = useWorkspacePanel();

    // Viewers can't ask for changes, so they have no requests to see
    const { isViewer, canEditWork } = usePermissions({ workspaceId });
    const filteredRoutes = isViewer ? routes.filter((route) => route.href !== "/requests") : routes;
    // Editors see how many requests wait for them
    const { data: requests } = useGetChangeRequests({ workspaceId: isViewer ? "" : workspaceId });
    const waiting = canEditWork ? requests?.filter((request) => request.status === "pending").length ?? 0 : 0;

    const renderItem = (item: (typeof routes)[number]) => {
        const fullHref = `/workspaces/${workspaceId}${item.href}`;
        const isActive = item.panel ? panel === item.panel : pathname === fullHref;

        const Icon = isActive ? item.activeIcon : item.icon;
        const iconColor = isActive ? item.activeColor : item.color;
        const content = (
            // data-tour: what the welcome tour points at (features/onboarding)
            <div data-tour={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`} className={cn(
                "relative flex items-center gap-2.5 p-2.5 rounded-lg font-medium transition-colors duration-200 ease-out text-muted-foreground hover:bg-accent/60 hover:text-foreground overflow-hidden",
                SIDEBAR_ROW,
                isActive && "text-foreground hover:bg-transparent",
            )}>
                {isActive && (
                    // A raised pill that slides from the old page's item to the new one
                    <m.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-lg bg-card shadow-soft"
                        transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                )}
                <Icon className={cn("relative size-5 shrink-0", iconColor)} />
                <span className={cn("relative whitespace-nowrap", SIDEBAR_FADE)}>{item.label}</span>
                {item.href === "/requests" && waiting > 0 && (
                    <span
                        className={cn("relative ml-auto rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white", SIDEBAR_FADE)}
                        aria-label={`${waiting} waiting for review`}
                    >
                        {waiting}
                    </span>
                )}
            </div>
        );
        return (
            <li key={item.href}>
                {item.panel ? (
                    <button
                        type="button"
                        onClick={() => openPanel(item.panel!)}
                        title={collapsed ? item.label : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        className="w-full text-left min-h-0"
                    >
                        {content}
                    </button>
                ) : (
                    <Link href={fullHref} title={collapsed ? item.label : undefined} aria-label={collapsed ? item.label : undefined} aria-current={isActive ? "page" : undefined}>
                        {content}
                    </Link>
                )}
            </li>
        );
    };

    return (
        // Its own group, so the desktop sidebar's pill and the phone menu's never animate between each other
        <LayoutGroup id={groupId}>
            <ul className="flex flex-col gap-0.5">
                {filteredRoutes.filter((route) => !route.panel).map(renderItem)}
            </ul>
            <ul className="mt-3 flex flex-col gap-0.5 border-t border-border/60 pt-3">
                {filteredRoutes.filter((route) => route.panel).map(renderItem)}
            </ul>
        </LayoutGroup>
    );
};