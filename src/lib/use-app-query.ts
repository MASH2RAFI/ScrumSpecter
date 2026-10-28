import { useIsRestoring, useQuery, type QueryKey, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";

// useQuery whose isLoading also covers restoring the browser cache. While the persisted cache
// is read, queries sit idle, so plain isLoading is false and a page would render "no data"
// where the server rendered its loader, a hydration mismatch.
export const useAppQuery = <TQueryFnData, TError = Error, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(
    options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> => {
    const query = useQuery(options);
    const isRestoring = useIsRestoring();
    const enabled = options.enabled !== false;
    const isLoading = query.isPending && enabled && (query.fetchStatus === "fetching" || isRestoring);

    return { ...query, isLoading } as UseQueryResult<TData, TError>;
};
