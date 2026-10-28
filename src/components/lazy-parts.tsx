"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";

import { FormSkeleton, Loading, TableSkeleton } from "@/components/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

// Parts of the dashboard that aren't on screen when a page opens: the kanban and calendar views
// (each brings a large library) and the popup forms. Each loads on first use, and
// <PrefetchOnIdle /> fetches the ones this person can use once the page has settled, so by the
// time they click they're usually already there.

const formLoading = () => <FormSkeleton fields={5} />;

// Each import() sits directly inside dynamic() so Next can trace the chunk
export const LazyKanban = dynamic(() => import("@/features/tasks/components/data-kanban").then((m) => m.Datakanban), {
    loading: () => <Loading><TableSkeleton rows={4} /></Loading>,
});
export const LazyCalendar = dynamic(() => import("@/features/tasks/components/data-calendar").then((m) => m.DataCalendar), {
    loading: () => <Loading><Skeleton className="h-[600px] w-full rounded-card" /></Loading>,
});
export const LazyCreateTaskForm = dynamic(() => import("@/features/tasks/components/create-task-form-wrapper").then((m) => m.CreateTaskFormWrapper), { loading: formLoading });
export const LazyEditTaskForm = dynamic(() => import("@/features/tasks/components/edit-task-form-wrapper").then((m) => m.EditTaskFormWrapper), { loading: formLoading });
export const LazyCreateProjectForm = dynamic(() => import("@/features/projects/components/create-project-form").then((m) => m.CreateProjectForm), { loading: formLoading });
export const LazyEditProjectForm = dynamic(() => import("@/features/projects/components/edit-project-form").then((m) => m.EditProjectForm), { loading: formLoading });
export const LazyRoutineForm = dynamic(() => import("@/features/routines/components/routine-form").then((m) => m.RoutineForm), { loading: formLoading });
export const LazyWorkspaceSettings = dynamic(() => import("@/features/workspaces/components/edit-workspace-form").then((m) => m.WorkspaceSettings), { loading: formLoading });
export const LazyMembersList = dynamic(() => import("@/features/workspaces/components/members-list").then((m) => m.MembersList), { loading: formLoading });
export const LazyCreateWorkspaceForm = dynamic(() => import("@/features/workspaces/components/create-workspace-with-project-form").then((m) => m.CreateWorkspaceWithProjectForm), { loading: formLoading });

// The same modules, for prefetching; the views first, as they're the likeliest next click.
// Editing forms only for people who can edit (task forms also serve change requests).
const VIEWS = [
    () => import("@/features/tasks/components/data-kanban"),
    () => import("@/features/tasks/components/data-calendar"),
];
const SHARED_PANELS = [
    () => import("@/features/workspaces/components/members-list"),
    () => import("@/features/workspaces/components/edit-workspace-form"),
    () => import("@/features/workspaces/components/create-workspace-with-project-form"),
];
const EDITING_FORMS = [
    () => import("@/features/tasks/components/create-task-form-wrapper"),
    () => import("@/features/tasks/components/edit-task-form-wrapper"),
    () => import("@/features/projects/components/create-project-form"),
    () => import("@/features/projects/components/edit-project-form"),
    () => import("@/features/routines/components/routine-form"),
];

// Data Saver on, or a 2G connection: wait until a part is actually used
const lowData = () => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    return Boolean(connection?.saveData || connection?.effectiveType?.includes("2g"));
};

// Fetches the parts above once the browser has nothing else to do
export const PrefetchOnIdle = () => {
    const workspaceId = useWorkspaceId();
    const { isViewer, isLoading } = usePermissions({ workspaceId: workspaceId ?? "" });

    useEffect(() => {
        // Production only: in development each import compiles on demand, and that burst of
        // compiling right after a page loads can cancel a navigation in progress
        if (process.env.NODE_ENV !== "production" || isLoading || lowData()) return;
        let cancelled = false;
        const parts = [...VIEWS, ...SHARED_PANELS, ...(isViewer ? [] : EDITING_FORMS)];
        // One at a time, so the downloads never compete with what the page itself is fetching.
        // Failures are fine: the part loads again when it's actually used.
        const run = async () => {
            for (const load of parts) {
                if (cancelled) return;
                await load().catch(() => {});
            }
        };
        const start = () => void run();
        if ("requestIdleCallback" in window) {
            const id = window.requestIdleCallback(start, { timeout: 4000 });
            return () => { cancelled = true; window.cancelIdleCallback(id); };
        }
        const timer = setTimeout(start, 2000);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [isLoading, isViewer]);

    return null;
};
