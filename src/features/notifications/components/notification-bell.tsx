"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { BellIcon, CalendarClockIcon, ClockIcon, GitPullRequestArrowIcon } from "lucide-react";

import { m } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNotificationSettings } from "../hooks/use-notification-settings";

import { type AppNotification, useGetNotifications, useMarkNotificationsRead } from "../api/use-notifications";

const KindIcon = ({ kind }: { kind: AppNotification["kind"] }) =>
    kind === "day_before"
        ? <CalendarClockIcon className="size-4 text-primary" />
        : kind === "before_end"
            ? <ClockIcon className="size-4 text-amber-500" />
            : kind === "change_request" || kind === "change_reviewed"
                ? <GitPullRequestArrowIcon className="size-4 text-rose-600" />
                : <BellIcon className="size-4 text-muted-foreground" />;

// Reminder history; push notifications show the same items on the device
export const NotificationBell = () => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const { data } = useGetNotifications();
    const { mutate: markRead } = useMarkNotificationsRead();
    const { open: openSettings } = useNotificationSettings();
    const unread = data?.unread ?? 0;

    const onOpenChange = (next: boolean) => {
        setOpen(next);
        // Seen once the list has been opened
        if (next && unread > 0) markRead(undefined);
    };

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-tour="notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
                    <BellIcon className="size-5 text-muted-foreground" />
                    {unread > 0 && (
                        // Keyed by the count, so each new notification pops it again
                        <m.span
                            key={unread}
                            initial={{ scale: 0.6 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 520, damping: 14 }}
                            className="absolute right-1 top-1 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground"
                        >
                            {unread > 9 ? "9+" : unread}
                        </m.span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b px-3 py-2">
                    <p className="text-sm font-semibold">Reminders</p>
                    <button
                        type="button"
                        className="text-xs text-primary hover:underline min-h-0 min-w-0"
                        aria-label="Notification settings"
                        onClick={() => { setOpen(false); openSettings(); }}
                    >
                        Settings
                    </button>
                </div>
                <ul className="max-h-96 overflow-y-auto" aria-label="Reminders">
                    {data?.documents.length === 0 && (
                        <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                            No reminders yet. You&apos;ll get one at 6 PM about tomorrow&apos;s tasks and 30 minutes before a task ends.
                        </li>
                    )}
                    {data?.documents.map((notification) => (
                        <li key={notification.$id}>
                            <button
                                type="button"
                                disabled={!notification.url}
                                onClick={() => {
                                    setOpen(false);
                                    if (notification.url) router.push(notification.url);
                                }}
                                className={cn(
                                    "flex w-full gap-2.5 px-3 py-2.5 text-left hover:bg-accent min-h-0",
                                    !notification.read && "bg-primary/5",
                                )}
                            >
                                <span className="mt-0.5 shrink-0"><KindIcon kind={notification.kind} /></span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">{notification.title}</span>
                                    <span className="block truncate text-xs text-muted-foreground">{notification.body}</span>
                                    <span className="block text-[11px] text-muted-foreground">
                                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                    </span>
                                </span>
                                {!notification.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                            </button>
                        </li>
                    ))}
                </ul>
            </PopoverContent>
        </Popover>
    );
};
