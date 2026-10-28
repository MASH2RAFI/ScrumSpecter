// Browser copy of fetched data (TanStack Query, persisted to localStorage)

export const CACHE_STORAGE_KEY = "scrumspecter-cache";

// Bump when the shape of cached API data changes (e.g. a new column), so old copies are discarded.
// A schema change alone doesn't move any workspace's data_version, so caches wouldn't refresh.
export const CACHE_BUSTER = "2026-10-28.roles-assignees";

export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

// Last data_version seen per workspace; see use-data-versions.ts
export const VERSIONS_QUERY_KEY = ["data-versions"] as const;

let persistenceStopped = false;

// localStorage, except that writes are dropped once the user has signed out
export const cacheStorage = (): Storage | undefined => {
    let storage: Storage;
    try {
        storage = window.localStorage;
    } catch {
        return undefined;
    }
    // The persister only needs these three
    return {
        getItem: (key: string) => storage.getItem(key),
        removeItem: (key: string) => storage.removeItem(key),
        setItem: (key: string, value: string) => {
            if (!persistenceStopped) storage.setItem(key, value);
        },
    } as Storage;
};

// Signing out: remove the copy and keep the in-memory cache from writing it back before unload
export const stopPersistingCache = () => {
    persistenceStopped = true;
    clearPersistedCache();
};

// Another person may use this browser next: never leave their data behind
export const clearPersistedCache = () => {
    try {
        window.localStorage.removeItem(CACHE_STORAGE_KEY);
    } catch {
        // Storage unavailable (private mode, blocked): nothing was persisted
    }
};
