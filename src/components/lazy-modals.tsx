"use client";

import { Loader } from "lucide-react";
import { lazy, Suspense, useState, type ComponentType } from "react";

import { useNotificationSettings } from "@/features/notifications/hooks/use-notification-settings";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { useEditProjectModal } from "@/features/projects/hooks/use-edit-project-modal";
import { useRoutineModal } from "@/features/routines/hooks/use-routine-modal";
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal";
import { useEditTaskModal } from "@/features/tasks/hooks/use-edit-task-modal";
import { useTaskPanel } from "@/features/tasks/hooks/use-task-panel";
import { useCreateWorkspaceModal } from "@/features/workspaces/hooks/use-create-workspace-modal";
import { useWorkspacePanel } from "@/features/workspaces/hooks/use-workspace-panel";

// The dashboard mounts nine modals and panels on every page, but each one is closed until a link or button
// sets its address parameter. Their code (the forms, with their validation and pickers) is a good part of what
// a phone has to download and run before the first screen: so a modal's code is fetched the first time it
// opens (a link that opens one on arrival does too), and stays mounted after that so it can animate shut.
// On a computer the idle prefetch (lazy-parts.tsx) has usually fetched them already.
// While a modal's code is still on its way (a slow phone, the first time): after a moment, a dimmed screen with a
// spinner, so the tap visibly did something. A quick load never shows it (late-in, globals.css).
const Loading = () => (
    <div role="status" aria-label="Loading" className="late-in fixed inset-0 z-50 grid place-items-center bg-black/20">
        <div className="grid size-12 place-items-center rounded-full bg-background shadow-lg">
            <Loader className="size-5 animate-spin text-primary" />
        </div>
    </div>
);

const whenOpened = (useIsOpen: () => boolean, Modal: ComponentType) => {
    const Gate = () => {
        const open = useIsOpen();
        const [opened, setOpened] = useState(open);
        if (open && !opened) setOpened(true);
        return opened ? <Suspense fallback={<Loading />}><Modal /></Suspense> : null;
    };
    return Gate;
};

const useCreateWorkspaceOpen = () => useCreateWorkspaceModal().isOpen;
const useCreateProjectOpen = () => useCreateProjectModal().isOpen;
const useEditProjectOpen = () => Boolean(useEditProjectModal().projectId);
const useWorkspacePanelOpen = () => Boolean(useWorkspacePanel().panel);
const useCreateTaskOpen = () => useCreateTaskModal().isOpen;
const useEditTaskOpen = () => Boolean(useEditTaskModal().taskId);
const useRoutineOpen = () => useRoutineModal().isOpen;
const useTaskPanelOpen = () => Boolean(useTaskPanel().taskId);
const useNotificationSettingsOpen = () => useNotificationSettings().isOpen;

export const CreateWorkspaceWithProjectModal = whenOpened(useCreateWorkspaceOpen, lazy(() => import("@/features/workspaces/components/create-workspace-with-project-modal").then((m) => ({ default: m.CreateWorkspaceWithProjectModal }))));
export const CreateProjectModal = whenOpened(useCreateProjectOpen, lazy(() => import("@/features/projects/components/create-project-modal").then((m) => ({ default: m.CreateProjectModal }))));
export const EditProjectModal = whenOpened(useEditProjectOpen, lazy(() => import("@/features/projects/components/edit-project-modal").then((m) => ({ default: m.EditProjectModal }))));
export const WorkspacePanelModal = whenOpened(useWorkspacePanelOpen, lazy(() => import("@/features/workspaces/components/workspace-panel-modal").then((m) => ({ default: m.WorkspacePanelModal }))));
export const CreateTaskModal = whenOpened(useCreateTaskOpen, lazy(() => import("@/features/tasks/components/create-task-modal").then((m) => ({ default: m.CreateTaskModal }))));
export const EditTaskModal = whenOpened(useEditTaskOpen, lazy(() => import("@/features/tasks/components/edit-task-modal").then((m) => ({ default: m.EditTaskModal }))));
export const RoutineModal = whenOpened(useRoutineOpen, lazy(() => import("@/features/routines/components/routine-modal").then((m) => ({ default: m.RoutineModal }))));
export const TaskPanel = whenOpened(useTaskPanelOpen, lazy(() => import("@/features/tasks/components/task-panel").then((m) => ({ default: m.TaskPanel }))));
export const NotificationSettingsModal = whenOpened(useNotificationSettingsOpen, lazy(() => import("@/features/notifications/components/notification-settings-modal").then((m) => ({ default: m.NotificationSettingsModal }))));
