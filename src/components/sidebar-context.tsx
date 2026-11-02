"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useStoredFlag } from "@/hooks/use-stored-flag";

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
    const [pinned, setPinned] = useStoredFlag(STORAGE_KEY, false);
    const [revealed, setRevealed] = useState(false);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

    // The pointer's position decides, from one page-wide listener: the panel's own mouse events can be
    // swallowed (Radix turns off pointer events on the page while a dropdown opens or closes, and React
    // counts a portalled list as "inside"), which left it stuck open or closed
    useEffect(() => {
        if (pinned) return;
        const onMove = (event: PointerEvent) => {
            const frame = document.querySelector("[data-sidebar-frame]");
            if (!frame || menuOpen.current) return;
            const { right, width } = frame.getBoundingClientRect();
            if (!width) return; // hidden below the lg breakpoint
            // Over the panel, or over the bare page (Radix turns pointer events off while a menu
            // animates); not over a dialog or overlay that covers the panel
            const target = event.target as Element | null;
            const onPage = target === document.documentElement || target === document.body || frame.contains(target);
            const inside = event.clientX <= right && onPage;
            if (inside && !pointerInside.current) reveal();
            else if (!inside && pointerInside.current) conceal();
        };
        window.addEventListener("pointermove", onMove);
        return () => window.removeEventListener("pointermove", onMove);
    }, [pinned, reveal, conceal]);

    const toggle = useCallback(() => {
        setPinned(!pinned);
        // Unpinning folds it straight away rather than after the hold
        clearTimeout(hideTimer.current);
        setRevealed(false);
    }, [pinned, setPinned]);

    return (
        <SidebarContext.Provider value={{ collapsed: !pinned && !revealed, pinned, toggle, reveal, conceal, setMenuOpen }}>
            {children}
        </SidebarContext.Provider>
    );
};
