import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";
import { useAppQuery } from "@/lib/use-app-query";

import { createChangeRequestSchema } from "../schemas";
import { ChangeRequest } from "../types";

const readError = async (response: Response, fallback: string) => {
    const body = await response.json().catch(() => ({})) as { error?: string };
    return new ApiError(body.error ?? fallback, response.status);
};

export const useGetChangeRequests = ({ workspaceId }: { workspaceId: string }) =>
    useAppQuery({
        queryKey: ["change-requests", workspaceId],
        enabled: Boolean(workspaceId),
        queryFn: async () => {
            const response = await client.api["change-requests"].$get({ query: { workspaceId } });
            if (!response.ok) throw await readError(response, "Couldn't load change requests");
            const { data } = await response.json();
            return data.documents as ChangeRequest[];
        },
    });

export const useCreateChangeRequest = () => {
    const queryClient = useQueryClient();
    return useMutation<ChangeRequest, Error, z.input<typeof createChangeRequestSchema>>({
        mutationFn: async (json) => {
            const response = await client.api["change-requests"].$post({ json });
            if (!response.ok) throw await readError(response, "Couldn't send the request");
            const { data } = await response.json();
            return data as ChangeRequest;
        },
        onSuccess: (request) => {
            toast.success("Request sent. An admin or supervisor will review it.");
            queryClient.invalidateQueries({ queryKey: ["change-requests", request.workspaceId] });
        },
        onError: (error) => toast.error(error.message),
    });
};

export const useReviewChangeRequest = () => {
    const queryClient = useQueryClient();
    return useMutation<ChangeRequest, Error, { id: string; decision: "approve" | "decline"; note?: string }, { snapshot: [readonly unknown[], ChangeRequest[] | undefined][] }>({
        mutationFn: async ({ id, decision, note }) => {
            const route = client.api["change-requests"][":requestId"][decision];
            const response = await route.$post({ param: { requestId: id }, json: { note } });
            if (!response.ok) throw await readError(response, "Couldn't review the request");
            const { data } = await response.json();
            return data as ChangeRequest;
        },
        // The card shows the decision at once (who decided and the reply included); the refetch
        // confirms it, and a refusal puts it back
        onMutate: async ({ id, decision, note }) => {
            await queryClient.cancelQueries({ queryKey: ["change-requests"] });
            const snapshot = queryClient.getQueriesData<ChangeRequest[]>({ queryKey: ["change-requests"] });
            const me = queryClient.getQueryData<{ name: string } | null>(["current"]);
            queryClient.setQueriesData<ChangeRequest[]>({ queryKey: ["change-requests"] }, (list) =>
                list?.map((request) => request.$id === id
                    ? { ...request, status: decision === "approve" ? "approved" : "declined", reviewerName: me?.name ?? request.reviewerName, reviewNote: note ?? null }
                    : request));
            return { snapshot };
        },
        onSuccess: (request) => {
            toast.success(request.status === "approved" ? "Approved and applied" : "Declined");
            queryClient.invalidateQueries({ queryKey: ["change-requests", request.workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["task"] });
        },
        onError: (error, _variables, context) => {
            for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data);
            toast.error(error.message);
            // (the request may have been decided or withdrawn meanwhile: show what the server says)
            queryClient.invalidateQueries({ queryKey: ["change-requests"] });
        },
    });
};

export const useWithdrawChangeRequest = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, { id: string; workspaceId: string }, { previous: ChangeRequest[] | undefined }>({
        mutationFn: async ({ id }) => {
            const response = await client.api["change-requests"][":requestId"].$delete({ param: { requestId: id } });
            if (!response.ok) throw await readError(response, "Couldn't withdraw the request");
        },
        // Gone from the list at once; a refusal puts it back
        onMutate: async ({ id, workspaceId }) => {
            await queryClient.cancelQueries({ queryKey: ["change-requests", workspaceId] });
            const previous = queryClient.getQueryData<ChangeRequest[]>(["change-requests", workspaceId]);
            queryClient.setQueryData<ChangeRequest[]>(["change-requests", workspaceId], (list) => list?.filter((request) => request.$id !== id));
            return { previous };
        },
        onSuccess: (_, { workspaceId }) => {
            toast.success("Request withdrawn");
            queryClient.invalidateQueries({ queryKey: ["change-requests", workspaceId] });
        },
        onError: (error, { workspaceId }, context) => {
            if (context?.previous) queryClient.setQueryData(["change-requests", workspaceId], context.previous);
            toast.error(error.message);
        },
    });
};
