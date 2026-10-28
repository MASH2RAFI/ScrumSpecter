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
    return useMutation<ChangeRequest, Error, { id: string; decision: "approve" | "decline"; note?: string }>({
        mutationFn: async ({ id, decision, note }) => {
            const route = client.api["change-requests"][":requestId"][decision];
            const response = await route.$post({ param: { requestId: id }, json: { note } });
            if (!response.ok) throw await readError(response, "Couldn't review the request");
            const { data } = await response.json();
            return data as ChangeRequest;
        },
        onSuccess: (request) => {
            toast.success(request.status === "approved" ? "Approved and applied" : "Declined");
            queryClient.invalidateQueries({ queryKey: ["change-requests", request.workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["task"] });
        },
        onError: (error) => toast.error(error.message),
    });
};

export const useWithdrawChangeRequest = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, { id: string; workspaceId: string }>({
        mutationFn: async ({ id }) => {
            const response = await client.api["change-requests"][":requestId"].$delete({ param: { requestId: id } });
            if (!response.ok) throw await readError(response, "Couldn't withdraw the request");
        },
        onSuccess: (_, { workspaceId }) => {
            toast.success("Request withdrawn");
            queryClient.invalidateQueries({ queryKey: ["change-requests", workspaceId] });
        },
        onError: (error) => toast.error(error.message),
    });
};
