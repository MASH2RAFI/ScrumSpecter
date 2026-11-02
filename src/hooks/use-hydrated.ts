import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

// False on the server and in the first client render, true after hydration
export const useHydrated = () => useSyncExternalStore(noSubscribe, () => true, () => false);
