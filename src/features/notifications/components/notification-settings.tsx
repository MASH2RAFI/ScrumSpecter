"use client";

import { BellIcon, BellOffIcon, SendIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useUpdatePreferences } from "@/features/account/api/use-account";
import type { UserPreferences } from "@/features/auth/preferences";

import { useGetPushDevices, useSendTestNotification } from "../api/use-notifications";
import { usePush } from "../hooks/use-push";

const DEVICE_HELP: Record<string, string> = {
    "ios-needs-install": "On iPhone and iPad, notifications only work from the home screen app: tap Share, then Add to Home Screen, open ScrumSpecter from there and turn notifications on.",
    unsupported: "This browser can't receive notifications. Try Chrome, Edge, Firefox or Safari.",
    blocked: "Notifications are blocked for this site. Allow them in your browser's site settings, then reload.",
};

// Account settings → Notifications
export const NotificationSettings = ({ preferences }: { preferences: UserPreferences }) => {
    const { state, busy, enable, disable } = usePush();
    const { data: devices } = useGetPushDevices();
    const sendTest = useSendTestNotification();
    const { mutate: updatePreferences, isPending } = useUpdatePreferences();

    const toggle = (key: "remindDayBefore" | "remindBeforeEnd", label: string, description: string) => (
        <div className="flex items-start gap-3">
            <Checkbox
                id={`pref-${key}`}
                checked={preferences[key]}
                disabled={isPending}
                onCheckedChange={(checked) => updatePreferences({ [key]: checked === true })}
                className="mt-0.5 size-4 min-h-0 min-w-0"
            />
            <div>
                <Label htmlFor={`pref-${key}`}>{label}</Label>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-4 pt-2">
            <section className="space-y-3 rounded-lg border p-4">
                <div>
                    <h3 className="font-semibold">This device</h3>
                    <p className="text-sm text-muted-foreground">
                        {state === "on"
                            ? "Reminders show up here even when ScrumSpecter is closed."
                            : "Turn on to get reminders here even when ScrumSpecter is closed."}
                    </p>
                </div>
                {state && DEVICE_HELP[state] && <p className="text-sm text-amber-600 dark:text-amber-400">{DEVICE_HELP[state]}</p>}
                <div className="flex flex-wrap gap-2">
                    {state === "on" ? (
                        <Button variant="outline" disabled={busy} onClick={() => void disable()}>
                            <BellOffIcon className="mr-2 size-4" />
                            Turn off on this device
                        </Button>
                    ) : (
                        <Button disabled={busy || state !== "off"} onClick={() => void enable()}>
                            <BellIcon className="mr-2 size-4" />
                            Turn on notifications
                        </Button>
                    )}
                    <Button variant="outline" disabled={sendTest.isPending} onClick={() => sendTest.mutate()}>
                        <SendIcon className="mr-2 size-4" />
                        Send a test
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    {devices === undefined ? "" : devices === 0 ? "No devices set up yet." : `Set up on ${devices} ${devices === 1 ? "device" : "devices"}.`}
                </p>
            </section>

            <section className="space-y-3 rounded-lg border p-4">
                <h3 className="font-semibold">Remind me</h3>
                {toggle("remindDayBefore", "At 6 PM the day before", "A summary of the tasks assigned to you that are due tomorrow.")}
                {toggle("remindBeforeEnd", "30 minutes before a task ends", "For tasks without a time, 5:30 PM on the day they're due.")}
                <p className="text-xs text-muted-foreground">Times are in {preferences.timeZone}.</p>
            </section>
        </div>
    );
};
