"use client";

import { cn } from "@/lib/utils";
import { SettingsIcon, UsersIcon, BarChart3Icon } from "lucide-react";
import Link from "next/link";
import { GoHome, GoHomeFill, GoCheckCircle, GoCheckCircleFill } from "react-icons/go";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { usePathname } from "next/navigation";

const routes = [
    {
        label: "Home",
        href: "",
        icon: GoHome,
        activeIcon: GoHomeFill,
    },
    {
        label: "My Tasks",
        href: "/tasks",
        icon: GoCheckCircle,
        activeIcon: GoCheckCircleFill,
    },
    {
        label: "Members",
        href: "/members",
        icon: UsersIcon,
        activeIcon: UsersIcon,
    },
    {
        label: "Analytics",
        href: "/analytics",
        icon: BarChart3Icon,
        activeIcon: BarChart3Icon,
    },
    {
        label: "Settings",
        href: "/settings",
        icon: SettingsIcon,
        activeIcon: SettingsIcon,
    },
];

export const Navigation = () => {
    
    const workspaceId = useWorkspaceId();
    const pathname = usePathname();

    // Show all routes - members and settings are visible to all users
    const filteredRoutes = routes;

    return (
        <ul className="flex flex-col">
            {filteredRoutes.map( (item) => {
                const fullHref = `/workspaces/${workspaceId}${item.href}`
                const isActive = pathname === fullHref;

                const Icon = isActive ? item.activeIcon : item.icon;
                return (
                    <Link key={item.href} href={fullHref}>
                        <div className={cn(
                            "flex items-center gap-2.5 p-2.5 rounded-md font-medium transition-colors text-muted-foreground hover:text-primary hover:bg-accent",
                            isActive && "bg-primary/10 text-primary shadow-sm"
                        )}>
                            <Icon className="size-5" />
                            {item.label}
                        </div>
                    </Link>
                )
            })}
        </ul>
    );
};