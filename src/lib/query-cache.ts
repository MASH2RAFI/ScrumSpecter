// Browser copy of fetched data (TanStack Query, persisted to localStorage)

export const CACHE_STORAGE_KEY = "scrumspecter-cache";

// Bump when the shape of cached API data changes (e.g. a new column), so old copies are discarded.
// A schema change alone doesn't move any workspace's data_version, so caches wouldn't refresh.
// Change this whenever a saved copy from before would be wrong now, including when a preference's allowed values
// change (see preferences-core.ts: the browser doesn't re-validate preferences)
export const CACHE_BUSTER = "2026-11-04.no-signed-out-copy";

// How long the saved copy may be shown. It opens instantly while it is checked in the background
// (the data versions say whether anything changed), so a longer life means fewer cold opens. Signing
// out always removes it.
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// A copy older than this is refreshed in the background right after it is shown: some answers
// depend on the time, not only on edits (Home's overdue count), and no version change tells of those.
export const CACHE_REFRESH_AFTER = 60 * 60 * 1000;

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
