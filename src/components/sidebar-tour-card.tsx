"use client";

import { useEffect, useState } from "react";
import { CompassIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { startTour } from "@/features/onboarding/tour-store";

import { SIDEBAR_FADE, useSidebar } from "./sidebar-context";

const DISMISSED_KEY = "scrumspecter-tour-card-dismissed";

// The bottom of the sidebar: a way back into the welcome tour, until it's closed
export const SidebarTourCard = () => {
    const { collapsed } = useSidebar();
    const [dismissed, setDismissed] = useState(true);

    // Read after mount so the server and the first client render agree
    useEffect(() => {
        try {
            setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
        } catch {
            setDismissed(false);
        }
    }, []);

    if (dismissed) return null;

    const dismiss = () => {
        setDismissed(true);
        try {
            localStorage.setItem(DISMISSED_KEY, "1");
        } catch {
            // Hidden for this visit only
        }
    };

    return (
        <div className={cn("relative mt-auto pt-6", SIDEBAR_FADE)} aria-hidden={collapsed || undefined}>
            <div className="rounded-card bg-primary p-4 text-primary-foreground">
                <button
                    type="button"
                    onClick={dismiss}
                    tabIndex={collapsed ? -1 : 0}
                    aria-label="Hide this card"
                    className="absolute right-2 top-8 rounded-md p-1 text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground"
                >
                    <XIcon className="size-4" />
                </button>
                <CompassIcon className="size-6" aria-hidden />
                <p className="mt-3 font-semibold">New around here?</p>
                <p className="mt-1 text-sm text-primary-foreground/80">A one-minute tour of where everything is.</p>
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    tabIndex={collapsed ? -1 : 0}
                    onClick={startTour}
                    className="mt-3 w-full"
                >
                    Take the tour
                </Button>
            </div>
        </div>
    );
};
