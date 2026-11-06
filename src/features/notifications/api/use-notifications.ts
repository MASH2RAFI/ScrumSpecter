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
        // The bell's badge clears at once; the list's own markers follow with the refetch
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: ["notifications"] });
            const previous = queryClient.getQueryData<{ documents: AppNotification[]; unread: number }>(["notifications"]);
            if (previous) {
                const cleared = ids ? previous.documents.filter((n) => ids.includes(n.$id) && !n.read).length : previous.unread;
                queryClient.setQueryData(["notifications"], { ...previous, unread: Math.max(0, previous.unread - cleared) });
            }
            return { previous };
        },
        onError: (_error, _ids, context) => {
            if (context?.previous) queryClient.setQueryData(["notifications"], context.previous);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
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
            return (await response.json()).data;
        },
        staleTime: 0,
    });

export const useRemovePushDevice = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const response = await client.api.notifications.subscriptions[":id"].$delete({ param: { id } });
            if (!response.ok) {
                throw new ApiError("Failed to remove the device", response.status);
            }
        },
        onSuccess: () => {
            toast.success("Device removed");
            queryClient.invalidateQueries({ queryKey: ["push-devices"] });
        },
        onError: (error) => toast.error(error.message),
    });
};

export const useSendTestNotification = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const response = await client.api.notifications.test.$post();
            if (!response.ok) {
                throw new ApiError("Failed to send a test notification", response.status);
            }
            return (await response.json()).data;
        },
        onSuccess: ({ pushed, failed }) => {
            const devices = (n: number) => `${n} ${n === 1 ? "device" : "devices"}`;
            if (!pushed && !failed) toast.success("Added to the bell. No device has notifications turned on yet.");
            // Failed devices are forgotten by the server; turning notifications on again resubscribes them
            else if (!pushed) toast.error(`Couldn't reach ${devices(failed)}. Turn notifications off and on again.`);
            else if (failed) toast.warning(`Test sent to ${devices(pushed)}. Couldn't reach ${devices(failed)}; turn notifications off and on there.`);
            else toast.success(`Test sent to ${devices(pushed)}`);
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["push-devices"] });
        },
        onError: (error) => toast.error(error.message),
    });
};
