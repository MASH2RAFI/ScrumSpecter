import { useAppQuery } from "@/lib/use-app-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-error";
import { stopPersistingCache } from "@/lib/query-cache";
import { resumeVersionChecks, stopVersionChecks } from "@/features/workspaces/hooks/use-data-versions";
import { client } from "@/lib/rpc";
import type { UserPreferences } from "@/features/auth/preferences";

// Throws the server's own message (e.g. "Current password is incorrect") so forms can show it
const unwrap = async <T,>(response: Response): Promise<T> => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new ApiError((body as { error?: string }).error ?? "Something went wrong", response.status);
    }
    return (body as { data: T }).data;
};

export type AccountInfo = {
    name: string;
    email: string;
    hasPassword: boolean;
    googleLinked: boolean;
    googleEnabled: boolean;
    activeSessions: number;
    preferences: UserPreferences;
};

export const useGetAccount = () =>
    useAppQuery({
        queryKey: ["account"],
        queryFn: async () => unwrap<AccountInfo>(await client.api.account.$get()),
        // Session counts change on other devices; always check when the dialog opens
        staleTime: 0,
        refetchOnMount: "always",
    });

const useAccountMutation = <Input, Output>(
    request: (input: Input) => Promise<Response>,
    success: string | ((output: Output) => string) | null,
) => {
    const queryClient = useQueryClient();
    return useMutation<Output, Error, Input>({
        mutationFn: async (input) => unwrap<Output>(await request(input)),
        onSuccess: (output) => {
            if (success) toast.success(typeof success === "string" ? success : success(output));
            queryClient.invalidateQueries({ queryKey: ["account"] });
            queryClient.invalidateQueries({ queryKey: ["account-devices"] });
            queryClient.invalidateQueries({ queryKey: ["current"] });
        },
        onError: (error) => toast.error(error.message),
    });
};

export const useUpdateProfile = () =>
    useAccountMutation((json: { name?: string; email?: string; currentPassword?: string }) =>
        client.api.account.profile.$patch({ json }), "Profile updated");

export const useChangePassword = () =>
    useAccountMutation((json: { currentPassword?: string; newPassword: string }) =>
        client.api.account.password.$post({ json }), "Password saved. Other devices were signed out.");

export const useRevokeOtherSessions = () =>
    useAccountMutation(() => client.api.account.sessions["revoke-others"].$post(),
        ({ revoked }: { revoked: number }) => revoked ? `Signed out ${revoked} other ${revoked === 1 ? "session" : "sessions"}` : "No other sessions");

export const useUnlinkGoogle = () =>
    useAccountMutation(() => client.api.account.google.$delete(), "Google sign-in removed");

// silent: background saves (the time zone) don't show a toast
export const useUpdatePreferences = ({ silent = false } = {}) =>
    useAccountMutation((json: Partial<UserPreferences>) =>
        client.api.account.preferences.$patch({ json }), silent ? null : "Preferences saved");

export const useDeleteAccount = () =>
    useMutation<unknown, Error, { confirmEmail: string; password?: string }>({
        mutationFn: async (json) => {
            stopVersionChecks();
            return unwrap(await client.api.account.$delete({ json }));
        },
        onSuccess: () => {
            stopPersistingCache();
            window.location.replace("/about");
        },
        onError: (error) => {
            resumeVersionChecks();
            toast.error(error.message);
        },
    });

export type SignedInDevice = {
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    location: string | null;
    createdAt: string;
    lastSeenAt: string;
    current: boolean;
};

export const useGetDevices = () =>
    useAppQuery({
        queryKey: ["account-devices"],
        queryFn: async () => unwrap<SignedInDevice[]>(await client.api.account.sessions.$get()),
        // Other devices sign in and out without this tab knowing
        staleTime: 0,
        refetchOnMount: "always",
    });

export const useSignOutDevice = () => {
    const queryClient = useQueryClient();
    return useMutation<unknown, Error, string>({
        mutationFn: async (sessionId) =>
            unwrap(await client.api.account.sessions[":sessionId"].$delete({ param: { sessionId } })),
        onSuccess: () => {
            toast.success("Device signed out");
            queryClient.invalidateQueries({ queryKey: ["account-devices"] });
            queryClient.invalidateQueries({ queryKey: ["account"] });
        },
        onError: (error) => toast.error(error.message),
    });
};
