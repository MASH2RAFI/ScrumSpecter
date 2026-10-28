"use client";

import { useEffect, useState } from "react";
import { BellRingIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNotificationSettings } from "../hooks/use-notification-settings";

import { usePush } from "../hooks/use-push";

const DISMISSED_KEY = "scrumspecter-reminders-prompt-dismissed";

// One-time nudge on Home until this device has notifications on (or the user says no)
export const EnableRemindersCard = () => {
    const { state, busy, enable } = usePush();
    const { open: openSettings } = useNotificationSettings();
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        try {
            setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
        } catch {
            setDismissed(false);
        }
    }, []);

    const dismiss = () => {
        setDismissed(true);
        try {
            localStorage.setItem(DISMISSED_KEY, "1");
        } catch {
            // Shows again next visit
        }
    };

    if (dismissed || (state !== "off" && state !== "ios-needs-install")) return null;

    return (
        <Card role="region" aria-label="Get reminders on this device">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <BellRingIcon className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Get reminders on this device</p>
                    <p className="text-xs text-muted-foreground">
                        {state === "ios-needs-install"
                            ? "Add ScrumSpecter to your home screen (Share → Add to Home Screen), then turn notifications on there."
                            : "At 6 PM about tomorrow's tasks, and 30 minutes before a task ends, even with ScrumSpecter closed."}
                    </p>
                </div>
                {state === "off" ? (
                    <Button size="sm" disabled={busy} onClick={() => void enable().then((on) => on && dismiss())}>Turn on</Button>
                ) : (
                    <Button size="sm" variant="outline" onClick={() => openSettings()}>How</Button>
                )}
                <Button variant="ghost" size="icon" className="size-8" aria-label="Not now" onClick={dismiss}>
                    <XIcon className="size-4" />
                </Button>
            </CardContent>
        </Card>
    );
};
