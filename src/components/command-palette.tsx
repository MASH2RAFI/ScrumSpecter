"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    BarChart3Icon,
    CheckCircleIcon,
    HomeIcon,
    PanelLeftIcon,
    PlusIcon,
    RepeatIcon,
    SearchIcon,
    SettingsIcon,
    UsersIcon,
    type LucideIcon,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal";
import { useTaskPanel } from "@/features/tasks/hooks/use-task-panel";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { useSidebar } from "./sidebar-context";

type Item = {
    id: string;
    group: "Actions" | "Pages" | "Projects" | "Tasks";
    label: string;
    hint?: string;
    icon?: LucideIcon;
    project?: string;
    run: () => void;
};

const isTyping = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
};

// Focus the task search box, waiting briefly for it to mount after navigation
const focusTaskSearch = (attempts = 20) => {
    const input = document.getElementById("task-search") as HTMLInputElement | null;
    if (input) {
        input.focus();
        input.select();
    } else if (attempts > 0) {
        setTimeout(() => focusTaskSearch(attempts - 1), 100);
    }
};

// Keyboard shortcuts (C, /, [, Ctrl/Cmd+K) and the Ctrl/Cmd+K quick-jump menu
export const CommandPalette = () => {
    const router = useRouter();
    const workspaceId = useWorkspaceId();
    const { isAdmin } = useIsAdmin({ workspaceId });
    const { toggle: toggleSidebar } = useSidebar();
    const { open: openCreateTask } = useCreateTaskModal();
    const { open: openTask } = useTaskPanel();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const listRef = useRef<HTMLUListElement>(null);

    // Only fetched once the menu is opened (tasks are usually already cached)
    const { data: projects } = useGetProjects({ workspaceId: isOpen ? workspaceId : "" });
    const { data: tasks } = useGetTasks({ workspaceId: isOpen ? workspaceId : "" });

    const base = `/workspaces/${workspaceId}`;
    const goToSearch = () => {
        if (!window.location.pathname.endsWith("/tasks")) router.push(`${base}/tasks`);
        focusTaskSearch();
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setIsOpen((open) => !open);
                return;
            }
            if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || !workspaceId) return;
            if (e.key === "c" && isAdmin) {
                e.preventDefault();
                openCreateTask();
            } else if (e.key === "/") {
                e.preventDefault();
                goToSearch();
            } else if (e.key === "[") {
                e.preventDefault();
                toggleSidebar();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    });

    const items = useMemo<Item[]>(() => {
        const go = (path: string) => () => router.push(`${base}${path}`);
        const all: Item[] = [
            ...(isAdmin ? [{ id: "new-task", group: "Actions" as const, label: "New task", hint: "C", icon: PlusIcon, run: () => openCreateTask() }] : []),
            { id: "search", group: "Actions", label: "Search tasks", hint: "/", icon: SearchIcon, run: goToSearch },
            { id: "sidebar", group: "Actions", label: "Toggle sidebar", hint: "[", icon: PanelLeftIcon, run: toggleSidebar },
            { id: "home", group: "Pages", label: "Home", icon: HomeIcon, run: go("") },
            { id: "tasks", group: "Pages", label: "My Tasks", icon: CheckCircleIcon, run: go("/tasks") },
            { id: "routines", group: "Pages", label: "Routines", icon: RepeatIcon, run: go("/routines") },
            { id: "members", group: "Pages", label: "Members", icon: UsersIcon, run: go("/members") },
            { id: "analytics", group: "Pages", label: "Analytics", icon: BarChart3Icon, run: go("/analytics") },
            { id: "settings", group: "Pages", label: "Settings", icon: SettingsIcon, run: go("/settings") },
            ...(projects?.documents ?? []).map((project) => ({
                id: `project-${project.$id}`, group: "Projects" as const, label: project.name, project: project.name,
                run: go(`/projects/${project.$id}`),
            })),
            ...(tasks?.documents ?? []).map((task) => ({
                id: `task-${task.$id}`, group: "Tasks" as const, label: task.name, project: task.project?.name,
                run: () => openTask(task.$id),
            })),
        ];
        const q = query.trim().toLowerCase();
        const matches = q ? all.filter((item) => item.label.toLowerCase().includes(q)) : all.filter((item) => item.group !== "Tasks");
        return matches.slice(0, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, projects, tasks, isAdmin, base]);

    useEffect(() => setActive(0), [query]);
    useEffect(() => {
        listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
    }, [active]);

    const select = (item?: Item) => {
        if (!item) return;
        setIsOpen(false);
        setQuery("");
        item.run();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setQuery(""); }}>
            <DialogContent aria-describedby={undefined} className="p-0 gap-0 sm:max-w-lg overflow-hidden">
                <DialogTitle className="sr-only">Quick jump</DialogTitle>
                <div className="flex items-center gap-2 border-b px-3 pr-10">
                    <SearchIcon className="size-4 text-muted-foreground" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
                            if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
                            if (e.key === "Enter") { e.preventDefault(); select(items[active]); }
                        }}
                        placeholder="Jump to a page, project or task..."
                        aria-label="Quick jump"
                        className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                </div>
                <ul ref={listRef} role="listbox" className="max-h-80 overflow-y-auto p-2">
                    {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matches</li>}
                    {items.map((item, index) => (
                        <li key={item.id}>
                            {(index === 0 || items[index - 1].group !== item.group) && (
                                <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.group}</p>
                            )}
                            <button
                                type="button"
                                role="option"
                                aria-selected={index === active}
                                data-index={index}
                                onMouseMove={() => setActive(index)}
                                onClick={() => select(item)}
                                className={cn(
                                    "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm",
                                    index === active && "bg-accent"
                                )}
                            >
                                {item.icon ? <item.icon className="size-4 text-muted-foreground" /> : item.project && <ProjectAvatar name={item.project} />}
                                <span className="flex-1 truncate">{item.label}</span>
                                {item.group === "Tasks" && item.project && <span className="truncate text-xs text-muted-foreground">{item.project}</span>}
                                {item.hint && <kbd className="rounded border bg-muted px-1.5 text-[10px] text-muted-foreground">{item.hint}</kbd>}
                            </button>
                        </li>
                    ))}
                </ul>
            </DialogContent>
        </Dialog>
    );
};
