import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { client } from "@/lib/rpc";
import { clearPersistedCache } from "@/lib/query-cache";

type ResponseType = InferResponseType<typeof client.api.auth.login["$post"]>;
type RequestType = InferRequestType<typeof client.api.auth.login["$post"]>;

export const useLogin = (next?: string | null) => {
    const router = useRouter();
    const queryClient = useQueryClient();

    return useMutation<ResponseType, Error, RequestType>({
        mutationFn: async ({ json }) => {
            const response = await client.api.auth.login["$post"]({ json });
            if (!response.ok) {
                const body = await response.json().catch(() => ({})) as { error?: string };
                throw new Error(body.error === "Invalid credentials" ? "Wrong email or password" : body.error ?? "Login failed");
            }
            return await response.json();
        },
        onSuccess: () => {
            // Start clean: nothing cached from whoever used this browser before
            clearPersistedCache();
            queryClient.clear();
            toast.success("Login successful");
            if (next) {
                router.replace(next);
            } else {
                // The sign-in page sends a signed-in visitor home
                router.refresh();
            }
            queryClient.invalidateQueries({ queryKey: ["current"] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
};
