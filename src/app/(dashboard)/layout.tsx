import { ClientOnly } from "@/components/client-only";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardSkeleton } from "@/components/page-skeletons";
import { NotificationSettingsModal } from "@/features/notifications/components/notification-settings-modal";
import { PreferencesSync } from "@/features/auth/components/preferences-sync";
import { CreateProjectModal } from "@/features/projects/components/create-project-modal";
import { EditProjectModal } from "@/features/projects/components/edit-project-modal";
import { WorkspacePanelModal } from "@/features/workspaces/components/workspace-panel-modal";
import { CreateTaskModal } from "@/features/tasks/components/create-task-modal";
import { EditTaskModal } from "@/features/tasks/components/edit-task-modal";
import { RoutineModal } from "@/features/routines/components/routine-modal";
import { TaskPanel } from "@/features/tasks/components/task-panel";
import { CreateWorkspaceWithProjectModal } from "@/features/workspaces/components/create-workspace-with-project-modal";

interface DashboardLayoutProps {
    children: React.ReactNode;
    };

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
    return (
        // Pages still run on the server (auth checks, redirects); only their UI waits for the browser
        <ClientOnly fallback={<DashboardSkeleton />}>
        <div className="min-h-screen">
            <CreateWorkspaceWithProjectModal />
            <CreateProjectModal />
            <EditProjectModal />
            <WorkspacePanelModal />
            <CreateTaskModal />
            <EditTaskModal />
            <RoutineModal />
            <TaskPanel />
            <NotificationSettingsModal />
            <PreferencesSync />
            <DashboardShell>{children}</DashboardShell>
        </div>
        </ClientOnly>
    );
};
export default DashboardLayout;