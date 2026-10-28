import { useSyncExternalStore } from "react";

// Whether the welcome tour is showing. Module state, so the quick-jump menu and the account
// menu can replay it without a provider.
let open = false;
const listeners = new Set<() => void>();

const setOpen = (next: boolean) => {
    open = next;
    listeners.forEach((listener) => listener());
};

export const startTour = () => setOpen(true);
export const endTour = () => setOpen(false);

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useTourOpen = () => useSyncExternalStore(subscribe, () => open, () => false);
