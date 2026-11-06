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
import { CACHE_BUSTER, CACHE_MAX_AGE, CACHE_REFRESH_AFTER, CACHE_STORAGE_KEY, cacheStorage } from '@/lib/query-cache'
import { checkAfterOwnChange } from '@/features/workspaces/hooks/use-data-versions'

function makeQueryClient() {
  const queryClient: QueryClient = new QueryClient({
    // Our own edits bump the workspace version too; check soon after, so anyone else's change
    // that landed with ours is picked up (see checkAfterOwnChange)
    mutationCache: new MutationCache({
      onSuccess: () => checkAfterOwnChange(queryClient),
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

// How old the saved copy is as found, before restoring it starts saving over it (0 when there is none)
const savedCopyAge = () => {
  try {
    const head = window.localStorage.getItem(CACHE_STORAGE_KEY)?.slice(0, 400)
    const stamp = head?.match(/"timestamp":(\d+)/)
    return stamp ? Date.now() - Number(stamp[1]) : 0
  } catch {
    return 0
  }
}

// Read when this code loads, which is before anything is restored or saved
const foundAge = typeof window === 'undefined' ? 0 : savedCopyAge()

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
      // The copy is shown at once; an old one is then refreshed behind it
      onSuccess={() => {
        if (foundAge > CACHE_REFRESH_AFTER) void queryClient.invalidateQueries()
      }}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        buster: CACHE_BUSTER,
        dehydrateOptions: {
          // Never "signed out": restored after a sign-in that skips useLogin (Google, a new
          // session cookie), it would hide the user until the next refetch
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' && !(query.queryKey[0] === 'current' && query.state.data === null),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
