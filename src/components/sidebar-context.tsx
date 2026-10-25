"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "scrumspecter-sidebar-collapsed";

type SidebarState = { collapsed: boolean; toggle: () => void };

// Defaults to expanded, so the mobile sheet (outside the provider) always shows labels
const SidebarContext = createContext<SidebarState>({ collapsed: false, toggle: () => {} });

export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
    // Read after mount so server and client render the same first frame
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        try {
            setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
        } catch {
            // Storage can be unavailable (private mode); stay expanded
        }
    }, []);

    const toggle = useCallback(() => {
        setCollapsed((current) => {
            try {
                localStorage.setItem(STORAGE_KEY, current ? "0" : "1");
            } catch {
                // Not persisted; still toggles for this visit
            }
            return !current;
        });
    }, []);

    return <SidebarContext.Provider value={{ collapsed, toggle }}>{children}</SidebarContext.Provider>;
};
