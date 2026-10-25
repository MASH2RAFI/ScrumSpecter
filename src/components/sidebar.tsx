"use client";

import Link from "next/link";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DottedSeparator } from "./dotted-separator";
import { LogoMark } from "./logo";
import { Navigation } from "./navigation";
import { Projects } from "./projects";
import { useSidebar } from "./sidebar-context";
import { ThemeLogo } from "./theme-logo";
import { WorkspaceSwitcher } from "./workspace-switcher";

export const Sidebar = () => {
    const { collapsed, toggle } = useSidebar();
    const ToggleIcon = collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon;

    return (
        <aside className={cn("h-full bg-background w-full transition-unified", collapsed ? "p-3" : "p-4 sm:p-6")}>
            <div className={cn("flex items-center mb-6", collapsed ? "flex-col gap-3" : "justify-between")}>
                <Link href="/" className="block" aria-label="ScrumSpecter home">
                    {collapsed ? <LogoMark size={40} /> : <ThemeLogo width={100} height={50} />}
                </Link>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggle}
                    className="hidden lg:inline-flex size-8 text-muted-foreground"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    title={`${collapsed ? "Expand" : "Collapse"} sidebar ( [ )`}
                >
                    <ToggleIcon className="size-4" />
                </Button>
            </div>
            <DottedSeparator className="my-4" />
            <div className="space-y-6">
                {!collapsed && (
                    <>
                        <WorkspaceSwitcher />
                        <DottedSeparator className="my-4" />
                    </>
                )}
                <Navigation />
                <DottedSeparator className="my-4" />
                <Projects />
            </div>
        </aside>
    );
};
