"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "scrumspecter-sidebar-pinned";

// Text that fades out while the sidebar is folded to icons (see dashboard-shell.tsx)
export const SIDEBAR_FADE = "transition-opacity [transition-duration:350ms] ease-in-out group-data-[collapsed=true]/sidebar:opacity-0";

// Row highlights shrink to the icon while folded (264px panel - 2 x 16px padding - 44px)
export const SIDEBAR_ROW = "transition-[margin] duration-500 ease-in-out group-data-[collapsed=true]/sidebar:mr-[188px]";

// After the pointer leaves, the sidebar stays open this long before folding away
const HOLD_OPEN_MS = 300;

type SidebarState = {
    // Showing icons only
    collapsed: boolean;
    // Kept open (and the page laid out beside it) instead of auto-hiding
    pinned: boolean;
    toggle: () => void;
    // Pointer/focus entering or leaving the sidebar
    reveal: () => void;
    conceal: () => void;
    // A dropdown opened from the sidebar renders outside it; keep the sidebar open meanwhile
    setMenuOpen: (open: boolean) => void;
};

const ALWAYS_OPEN: SidebarState = {
    collapsed: false,
    pinned: true,
    toggle: () => {},
    reveal: () => {},
    conceal: () => {},
    setMenuOpen: () => {},
};

const SidebarContext = createContext<SidebarState>(ALWAYS_OPEN);

// The phone menu (a sheet) shows the sidebar fully open, whatever the desktop sidebar is doing
export const OpenSidebarProvider = ({ children }: { children: React.ReactNode }) => (
    <SidebarContext.Provider value={ALWAYS_OPEN}>{children}</SidebarContext.Provider>
);

export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
    const [pinned, setPinned] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const hideTimer = useRef<ReturnType<typeof setTimeout>>();

    // Read after mount so server and client render the same first frame
    useEffect(() => {
        try {
            setPinned(localStorage.getItem(STORAGE_KEY) === "1");
        } catch {
            // Storage can be unavailable (private mode); stay on auto-hide
        }
    }, []);

    useEffect(() => () => clearTimeout(hideTimer.current), []);

    // Where the pointer is, and whether a sidebar dropdown is open, decide when it may fold
    const pointerInside = useRef(false);
    const menuOpen = useRef(false);

    const scheduleHide = useCallback(() => {
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setRevealed(false), HOLD_OPEN_MS);
    }, []);

    const reveal = useCallback(() => {
        pointerInside.current = true;
        clearTimeout(hideTimer.current);
        setRevealed(true);
    }, []);

    const conceal = useCallback(() => {
        pointerInside.current = false;
        // Moving onto the dropdown's list counts as leaving; wait until the menu closes
        if (!menuOpen.current) scheduleHide();
    }, [scheduleHide]);

    // Switching to another window (Alt+Tab, a workspace key) never fires mouseleave, which would
    // leave the sidebar stuck open; fold it as the window loses focus
    useEffect(() => {
        const onWindowBlur = () => {
            pointerInside.current = false;
            if (menuOpen.current) return;
            clearTimeout(hideTimer.current);
            setRevealed(false);
        };
        window.addEventListener("blur", onWindowBlur);
        return () => window.removeEventListener("blur", onWindowBlur);
    }, []);

    const setMenuOpen = useCallback((open: boolean) => {
        menuOpen.current = open;
        if (open) {
            clearTimeout(hideTimer.current);
            setRevealed(true);
        } else if (!pointerInside.current) {
            scheduleHide();
        }
    }, [scheduleHide]);

    const toggle = useCallback(() => {
        setPinned((current) => {
            try {
                localStorage.setItem(STORAGE_KEY, current ? "0" : "1");
            } catch {
                // Not persisted; still toggles for this visit
            }
            return !current;
        });
        // Unpinning folds it straight away rather than after the hold
        clearTimeout(hideTimer.current);
        setRevealed(false);
    }, []);

    return (
        <SidebarContext.Provider value={{ collapsed: !pinned && !revealed, pinned, toggle, reveal, conceal, setMenuOpen }}>
            {children}
        </SidebarContext.Provider>
    );
};
