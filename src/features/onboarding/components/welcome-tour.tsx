"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/sidebar-context";
import { cn } from "@/lib/utils";
import { useUpdatePreferences } from "@/features/account/api/use-account";
import { useCurrent } from "@/features/auth/api/use-current";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { endTour, startTour, useTourOpen } from "../tour-store";
import { buildTourSteps } from "../tour-steps";

const CARD_WIDTH = 340;
const GAP = 12;
const EDGE = 16;
// Room around the highlighted element
const PAD = 6;

type Rect = { top: number; left: number; width: number; height: number };

const sameRect = (a: Rect | null, b: Rect | null) =>
    a === b || Boolean(a && b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

// The on-screen copy of a target: the desktop sidebar is hidden on phones, and the phone menu
// only exists while it's open
const findTarget = (target?: string): Rect | null => {
    if (!target) return null;
    for (const element of Array.from(document.querySelectorAll(`[data-tour="${target}"]`))) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            return { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) };
        }
    }
    return null;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

// Beside the target when there's room (the sidebar), otherwise below or above it (the top bar)
const placeCard = (target: Rect | null, cardWidth: number, cardHeight: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!target) return { top: (vh - cardHeight) / 2, left: (vw - cardWidth) / 2 };
    const right = target.left + target.width + PAD + GAP;
    if (right + cardWidth <= vw - EDGE) {
        return { top: clamp(target.top + target.height / 2 - cardHeight / 2, EDGE, vh - cardHeight - EDGE), left: right };
    }
    const left = clamp(target.left + target.width - cardWidth, EDGE, vw - cardWidth - EDGE);
    const below = target.top + target.height + PAD + GAP;
    if (below + cardHeight <= vh - EDGE) return { top: below, left };
    return { top: clamp(target.top - PAD - GAP - cardHeight, EDGE, vh - cardHeight - EDGE), left };
};

// Single-key shortcuts (command-palette.tsx) would open things behind the tour
const isShortcut = (e: KeyboardEvent) =>
    ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (!e.metaKey && !e.ctrlKey && !e.altKey && ["c", "/", "[", "?"].includes(e.key));

// First-sign-in walkthrough of the sidebar and top bar, worded for the person's role.
// Starts by itself for new accounts (preferences.showTutorial) and can be replayed any time.
export const WelcomeTour = () => {
    const workspaceId = useWorkspaceId();
    const open = useTourOpen();
    const { data: user } = useCurrent();
    const { showTutorial } = usePreferences();
    const { role } = usePermissions({ workspaceId: workspaceId ?? "" });
    const { data: workspace } = useGetWorkspace({ workspaceId: workspaceId ?? "" });
    const { mutate: updatePreferences } = useUpdatePreferences({ silent: true });
    const { setMenuOpen } = useSidebar();
    const queryClient = useQueryClient();

    const [index, setIndex] = useState(0);
    const [target, setTarget] = useState<Rect | null>(null);
    const [cardHeight, setCardHeight] = useState(0);
    const cardRef = useRef<HTMLDivElement>(null);
    const primaryRef = useRef<HTMLButtonElement>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    const autoStarted = useRef(false);

    const steps = useMemo(
        () => (user && role ? buildTourSteps({ name: user.name, role, workspaceName: workspace?.name }) : []),
        [user, role, workspace?.name],
    );
    const showing = open && steps.length > 0;
    const step = steps[Math.min(index, steps.length - 1)];
    const last = index >= steps.length - 1;

    // New accounts: once, when they first land inside a workspace and their role is known
    useEffect(() => {
        if (autoStarted.current || !showTutorial || !workspaceId || !role) return;
        const timer = setTimeout(() => {
            autoStarted.current = true;
            startTour();
        }, 400);
        return () => clearTimeout(timer);
    }, [showTutorial, workspaceId, role]);

    useEffect(() => {
        if (!showing) return;
        setIndex(0);
        returnFocus.current = document.activeElement as HTMLElement | null;
        // Keeps the auto-hiding sidebar unfolded so its labels can be pointed at
        setMenuOpen(true);
        return () => {
            setMenuOpen(false);
            returnFocus.current?.focus?.();
        };
    }, [showing, setMenuOpen]);

    const finish = useCallback(() => {
        endTour();
        if (!showTutorial) return;
        // Into the cached user straight away too, so a reload (which restores the browser
        // cache before asking the server) doesn't start the tour again
        queryClient.setQueryData<{ preferences: Record<string, unknown> } | null>(["current"], (current) =>
            current ? { ...current, preferences: { ...current.preferences, showTutorial: false } } : current);
        updatePreferences({ showTutorial: false });
    }, [showTutorial, updatePreferences, queryClient]);

    // Follows the target while the sidebar slides open, the window resizes or the page scrolls
    useEffect(() => {
        if (!showing) return;
        let frame = 0;
        let current: Rect | null = null;
        const track = () => {
            const next = findTarget(step?.target);
            if (!sameRect(current, next)) {
                current = next;
                setTarget(next);
            }
            const height = cardRef.current?.offsetHeight ?? 0;
            setCardHeight((previous) => (previous === height ? previous : height));
            frame = requestAnimationFrame(track);
        };
        track();
        return () => cancelAnimationFrame(frame);
    }, [showing, step?.target]);

    const measured = cardHeight > 0;
    useEffect(() => {
        if (showing && measured) primaryRef.current?.focus();
    }, [showing, measured, index]);

    useEffect(() => {
        if (!showing) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                finish();
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                if (last) finish(); else setIndex((i) => i + 1);
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === "Tab") {
                // Focus stays in the card
                const buttons = Array.from(cardRef.current?.querySelectorAll<HTMLElement>("button") ?? []);
                if (!buttons.length) return;
                const at = buttons.indexOf(document.activeElement as HTMLElement);
                const next = e.shiftKey ? (at <= 0 ? buttons.length - 1 : at - 1) : (at + 1) % buttons.length;
                e.preventDefault();
                buttons[next].focus();
            } else if (isShortcut(e)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        // Capture phase, ahead of the page's own shortcuts
        window.addEventListener("keydown", onKeyDown, true);
        return () => window.removeEventListener("keydown", onKeyDown, true);
    }, [showing, last, finish]);

    if (!showing || !step) return null;

    const cardWidth = Math.min(CARD_WIDTH, window.innerWidth - 2 * EDGE);
    const position = placeCard(target, cardWidth, cardHeight);

    return createPortal(
        <div className="fixed inset-0 z-[100]" data-testid="welcome-tour">
            {target ? (
                // The dimmed page with a hole over the target
                <div
                    aria-hidden
                    className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-300 ease-out motion-reduce:transition-none"
                    style={{
                        top: target.top - PAD,
                        left: target.left - PAD,
                        width: target.width + 2 * PAD,
                        height: target.height + 2 * PAD,
                        boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
                    }}
                />
            ) : (
                <div aria-hidden className="absolute inset-0 bg-black/55" />
            )}
            <div
                ref={cardRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="welcome-tour-title"
                aria-describedby="welcome-tour-body"
                className={cn(
                    "absolute rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-2xl",
                    "transition-[top,left] duration-300 ease-out motion-reduce:transition-none",
                    // See-through for the first frame, until its height is known
                    !measured && "opacity-0",
                )}
                style={{ width: cardWidth, top: position.top, left: position.left }}
            >
                <button
                    type="button"
                    onClick={finish}
                    aria-label="Close tour"
                    className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                    <XIcon className="size-4" />
                </button>
                <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
                    Step {index + 1} of {steps.length}
                </p>
                <h2 id="welcome-tour-title" className="mt-1 pr-6 text-base font-semibold">{step.title}</h2>
                <p id="welcome-tour-body" className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                <div className="mt-4 flex items-center gap-1" aria-hidden>
                    {steps.map((item, i) => (
                        <span key={item.id} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30")} />
                    ))}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                    {index === 0 ? (
                        <Button type="button" variant="ghost" size="sm" onClick={finish}>Skip tour</Button>
                    ) : (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setIndex((i) => i - 1)}>Back</Button>
                    )}
                    <Button
                        ref={primaryRef}
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => (last ? finish() : setIndex((i) => i + 1))}
                    >
                        {index === 0 ? "Show me around" : last ? "Get started" : "Next"}
                    </Button>
                </div>
            </div>
        </div>,
        document.body,
    );
};
