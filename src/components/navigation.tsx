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
        color: "text-blue-600",
        activeColor: "text-blue-700",
    },
    {
        label: "My Tasks",
        href: "/tasks",
        icon: GoCheckCircle,
        activeIcon: GoCheckCircleFill,
        color: "text-emerald-600",
        activeColor: "text-emerald-700",
    },
    {
        label: "Members",
        href: "/members",
        icon: UsersIcon,
        activeIcon: UsersIcon,
        color: "text-purple-600",
        activeColor: "text-purple-700",
    },
    {
        label: "Analytics",
        href: "/analytics",
        icon: BarChart3Icon,
        activeIcon: BarChart3Icon,
        color: "text-amber-600",
        activeColor: "text-amber-700",
    },
    {
        label: "Settings",
        href: "/settings",
        icon: SettingsIcon,
        activeIcon: SettingsIcon,
        color: "text-slate-600",
        activeColor: "text-slate-700",
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
                const iconColor = isActive ? item.activeColor : item.color;
                return (
                    <Link key={item.href} href={fullHref}>
                        <div className={cn(
                            "flex items-center gap-2.5 p-2.5 rounded-md font-medium transition-colors text-muted-foreground hover:bg-accent",
                            isActive && "bg-primary/10 text-primary shadow-sm"
                        )}>
                            <Icon className={cn("size-5", iconColor)} />
                            {item.label}
                        </div>
                    </Link>
                )
            })}
        </ul>
    );
};