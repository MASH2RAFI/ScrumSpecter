"use client";

import { formatDistanceToNow } from "date-fns";
import { MonitorIcon, SmartphoneIcon, TabletIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useGetDevices, useSignOutDevice } from "../api/use-account";
import { describeDevice, type DeviceKind } from "../device";
import { RowsSkeleton } from "@/components/page-skeletons";

const KIND_ICON: Record<DeviceKind, typeof MonitorIcon> = {
    phone: SmartphoneIcon,
    tablet: TabletIcon,
    desktop: MonitorIcon,
};

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// Account settings → Security: every signed-in device, each with its own Log out
export const DeviceList = () => {
    const { data: devices, isLoading } = useGetDevices();
    const signOut = useSignOutDevice();

    if (isLoading || !devices) {
        return <RowsSkeleton rows={2} />;
    }

    return (
        <ul className="divide-y rounded-md border" aria-label="Signed-in devices">
            {devices.map((device) => {
                const { label, kind } = describeDevice(device.userAgent);
                const Icon = KIND_ICON[kind];
                const details = [
                    device.current ? "Active now" : `Active ${formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true })}`,
                    device.location,
                    device.ipAddress,
                    `signed in ${shortDate(device.createdAt)}`,
                ].filter(Boolean).join(" · ");

                return (
                    <li key={device.id} className="flex items-center gap-3 px-3 py-2.5">
                        <Icon className="size-5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <span className="truncate">{label}</span>
                                {device.current && <Badge variant="secondary">This device</Badge>}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{details}</p>
                        </div>
                        {!device.current && (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={signOut.isPending}
                                aria-label={`Log out ${label}`}
                                onClick={() => signOut.mutate(device.id)}
                            >
                                Log out
                            </Button>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};
