"use client";

import { useStoredFlag } from "@/hooks/use-stored-flag";
import { BellRingIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNotificationSettings } from "../hooks/use-notification-settings";

import { usePush } from "../hooks/use-push";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { clockLabel } from "@/features/tasks/task-time";

const DISMISSED_KEY = "scrumspecter-reminders-prompt-dismissed";

// One-time nudge on Home until this device has notifications on (or the user says no)
export const EnableRemindersCard = () => {
    const { state, busy, enable } = usePush();
    const { open: openSettings } = useNotificationSettings();
    const { summaryTime, beforeEndMinutes, timeFormat } = usePreferences();
    // Hidden until hydrated, so the server and the first client render agree
    const [dismissed, setDismissed] = useStoredFlag(DISMISSED_KEY, true);

    const dismiss = () => {
        setDismissed(true);
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
                            : `At ${clockLabel(summaryTime, timeFormat)} about tomorrow's tasks, and ${beforeEndMinutes} minutes before a task ends, even with ScrumSpecter closed.`}
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
