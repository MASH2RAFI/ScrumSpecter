import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";
import { useAppQuery } from "@/lib/use-app-query";

export type AppNotification = {
    $id: string;
    kind: "day_before" | "before_end" | "test" | "change_request" | "change_reviewed";
    title: string;
    body: string;
    url: string | null;
    taskId: string | null;
    workspaceId: string | null;
    createdAt: string;
    read: boolean;
};

// The bell's list; refreshed by the data-version check when a new reminder arrives
export const useGetNotifications = () =>
    useAppQuery({
        queryKey: ["notifications"],
        queryFn: async () => {
            const response = await client.api.notifications.$get();
            if (!response.ok) {
                throw new ApiError("Failed to load notifications", response.status);
            }
            return (await response.json()).data as { documents: AppNotification[]; unread: number };
        },
    });

export const useMarkNotificationsRead = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (ids?: string[]) => {
            const response = await client.api.notifications.read.$post({ json: ids ? { ids } : {} });
            if (!response.ok) {
                throw new ApiError("Failed to mark notifications read", response.status);
            }
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    });
};

export const useGetPushDevices = () =>
    useAppQuery({
        queryKey: ["push-devices"],
        queryFn: async () => {
            const response = await client.api.notifications.subscriptions.$get();
            if (!response.ok) {
                throw new ApiError("Failed to load devices", response.status);
            }
            return (await response.json()).data.devices;
        },
        staleTime: 0,
    });

export const useSendTestNotification = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const response = await client.api.notifications.test.$post();
            if (!response.ok) {
                throw new ApiError("Failed to send a test notification", response.status);
            }
            return (await response.json()).data.pushed;
        },
        onSuccess: (pushed) => {
            toast.success(pushed
                ? `Test sent to ${pushed} ${pushed === 1 ? "device" : "devices"}`
                : "Added to the bell. No device has notifications turned on yet.");
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
        onError: (error) => toast.error(error.message),
    });
};
