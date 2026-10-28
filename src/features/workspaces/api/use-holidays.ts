import { useAppQuery } from "@/lib/use-app-query";
import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-error";
import { client } from "@/lib/rpc";

export type Holiday = {
    date: string;
    name: string;
    source: "public" | "custom";
    hidden?: boolean;
};

export type HolidayData = {
    holidays: Holiday[];
    // JS day numbers (0 = Sunday)
    weekend: number[];
    country: string | null;
};

// Holidays and weekend days for [from, to] (YYYY-MM-DD)
export const useGetHolidays = ({ workspaceId, from, to, includeHidden = false }: {
    workspaceId: string;
    from: string;
    to: string;
    includeHidden?: boolean;
}) =>
    useAppQuery({
        queryKey: ["holidays", workspaceId, from, to, includeHidden],
        enabled: Boolean(workspaceId),
        placeholderData: keepPreviousData,
        queryFn: async (): Promise<HolidayData> => {
            const response = await client.api.workspaces[":workspaceId"].holidays.$get({
                param: { workspaceId },
                query: { from, to, ...(includeHidden ? { includeHidden: "true" as const } : {}) },
            });
            if (!response.ok) {
                throw new ApiError("Failed to load holidays", response.status);
            }
            return (await response.json()).data;
        },
    });

export const useGetHolidayCountries = () =>
    useAppQuery({
        queryKey: ["holiday-countries"],
        queryFn: async () => {
            const response = await client.api.workspaces["holiday-countries"].$get();
            if (!response.ok) {
                throw new ApiError("Failed to load countries", response.status);
            }
            return (await response.json()).data;
        },
    });

type HolidayChange = { date: string; name: string; kind: "custom" | "hidden" };

const errorMessage = async (response: Response, fallback: string) =>
    ((await response.json().catch(() => ({}))) as { error?: string }).error ?? fallback;

// Holiday changes also add or remove routine tasks, so tasks are refreshed too
const useHolidayMutation = <Input,>(request: (workspaceId: string, input: Input) => Promise<Response>, success: string) => {
    const queryClient = useQueryClient();
    return useMutation<unknown, Error, { workspaceId: string } & Input>({
        mutationFn: async ({ workspaceId, ...input }) => {
            const response = await request(workspaceId, input as Input);
            if (!response.ok) {
                throw new ApiError(await errorMessage(response, "Couldn't update holidays"), response.status);
            }
            return response.json();
        },
        onSuccess: () => {
            toast.success(success);
            queryClient.invalidateQueries({ queryKey: ["holidays"] });
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["workspace"] });
        },
        onError: (error) => toast.error(error.message),
    });
};

export const useAddHoliday = () =>
    useHolidayMutation((workspaceId, json: HolidayChange) =>
        client.api.workspaces[":workspaceId"].holidays.$post({ param: { workspaceId }, json }), "Holidays updated");

export const useRemoveHoliday = () =>
    useHolidayMutation((workspaceId, json: Pick<HolidayChange, "date" | "kind">) =>
        client.api.workspaces[":workspaceId"].holidays.$delete({ param: { workspaceId }, json }), "Holidays updated");

export const useSetHolidayCountry = () =>
    useHolidayMutation((workspaceId, { holidayCountry }: { holidayCountry: string }) =>
        client.api.workspaces[":workspaceId"].$patch({ param: { workspaceId }, form: { holidayCountry } }), "Holiday country saved");

// "16 Dec is Victory Day, a holiday" for a YYYY-MM-DD date, or null
export const holidayNotice = (holidays: Holiday[] | undefined, date: string) => {
    const holiday = holidays?.find((h) => h.date === date && !h.hidden);
    if (!holiday) return null;
    const [year, month, day] = date.split("-").map(Number);
    const label = new Date(year, month - 1, day).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    return `${label} is ${holiday.name}, a holiday`;
};
