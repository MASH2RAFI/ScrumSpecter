'use client'

import {
  isServer,
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'

import { isClientError } from '@/lib/api-error'
import { CACHE_BUSTER, CACHE_MAX_AGE, CACHE_STORAGE_KEY, cacheStorage } from '@/lib/query-cache'
import { absorbOwnChanges } from '@/features/workspaces/hooks/use-data-versions'

function makeQueryClient() {
  const queryClient: QueryClient = new QueryClient({
    // Our own edits bump the workspace version too; record it so the next check doesn't refetch
    mutationCache: new MutationCache({
      onSuccess: () => absorbOwnChanges(queryClient),
    }),
    defaultOptions: {
      queries: {
        // Data stays fresh until the server says otherwise: useDataVersions invalidates
        // a workspace's queries when its data_version changes. Mutations invalidate directly.
        staleTime: isServer ? 60 * 1000 : Infinity,
        // Kept long enough to be persisted and restored on the next visit
        gcTime: CACHE_MAX_AGE,
        // 4xx won't change on retry; network errors and 5xx get two more tries
        retry: (failureCount, error) => !isClientError(error) && failureCount < 2,
        refetchOnWindowFocus: false,
        // With staleTime Infinity these only refetch queries that were invalidated
        // (by a mutation or a data-version change) while no page was showing them
        refetchOnReconnect: true,
        refetchOnMount: true,
      },
      mutations: {
        // Retrying a create after a lost response could insert it twice
        retry: false,
      },
    },
  })
  return queryClient
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient()
  }
  // Browser: reuse one client, so React suspending on first render doesn't drop it
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

// Storage can be unavailable (private mode); the app then simply runs without the copy
const persister = typeof window === 'undefined'
  ? undefined
  : createSyncStoragePersister({
      storage: cacheStorage(),
      key: CACHE_STORAGE_KEY,
      throttleTime: 1000,
    })

interface QueryProviderProps {
  children: React.ReactNode;
}

export const QueryProvider = ({ children }: QueryProviderProps) => {
  const queryClient = getQueryClient()

  if (!persister) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        buster: CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === 'success',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
