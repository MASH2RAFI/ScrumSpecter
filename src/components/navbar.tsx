"use client"

import { UserButton } from "@/features/auth/components/user-button";
import { MobileSidebar } from "./mobile-sidebar";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { ThemeSwitch } from "./theme-switch";
import { usePathname } from "next/navigation";
import { SearchIcon } from "lucide-react";

import { HeadingReveal } from "./motion";
import { openQuickJump } from "./command-palette";

const pathnameMap =  {
    "tasks": {
        title: "My Tasks",
        description: "View all of your tasks here",
    },
    "projects": {
        title: "My Project",
        description: "View tasks of your project here"
    },
    "members": {
        title: "Members",
        description: "Manage who is in this workspace",
    },
    "settings": {
        title: "Settings",
        description: "Workspace details, invites, days off and bulk input",
    },
    "routines": {
        title: "Routines",
        description: "Set up tasks that repeat every week",
    },
    "requests": {
        title: "Change requests",
        description: "Task changes waiting for an admin or supervisor",
    },
    "analytics": {
        title: "Analytics Dashboard",
        description: "View analytics and reports here"
    },
};

const defaultMap = {
    title: "Home",
    description: "Monitor all of your projects and tasks here",
}

export const Navbar = () => {
    const pathname = usePathname();
    const pathnameParts = pathname.split("/");
    const pathnameKey = pathnameParts[3] as keyof typeof pathnameMap;
    const { title, description } = pathnameMap[pathnameKey] || defaultMap;

    return (
        <nav className="sticky top-0 z-40 pt-4 pb-3 px-4 sm:px-6 flex items-center justify-between gap-3 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <MobileSidebar />
                <div className="flex-col flex min-w-0 flex-1">
                    <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate">
                        <HeadingReveal key={title}>{title}</HeadingReveal>
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                        {description}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button
                    type="button"
                    onClick={openQuickJump}
                    className="hidden md:flex h-10 w-64 items-center gap-2 whitespace-nowrap rounded-full border border-border/70 bg-card px-4 text-sm text-muted-foreground shadow-soft transition-colors duration-200 ease-out hover:border-primary/40 hover:text-foreground"
                >
                    <SearchIcon className="size-4" />
                    <span className="flex-1 text-left">Search or jump to…</span>
                    <kbd className="rounded-md border bg-muted px-1.5 font-sans text-[11px]">Ctrl K</kbd>
                </button>
                <ThemeSwitch />
                <NotificationBell />
                <UserButton />
            </div>
        </nav>
    );
};
