import { ClientOnly } from "@/components/client-only";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardSkeleton } from "@/components/page-skeletons";
import { PrefetchOnIdle } from "@/components/lazy-parts";
import {
    CreateProjectModal, CreateTaskModal, CreateWorkspaceWithProjectModal, EditProjectModal, EditTaskModal,
    NotificationSettingsModal, RoutineModal, TaskPanel, WorkspacePanelModal,
} from "@/components/lazy-modals";
import { AccountMotion, PreferencesSync } from "@/features/auth/components/preferences-sync";

interface DashboardLayoutProps {
    children: React.ReactNode;
    };

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
    return (
        // Pages still run on the server (auth checks, redirects); only their UI waits for the browser
        <ClientOnly fallback={<DashboardSkeleton />}>
        <AccountMotion>
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
            <PrefetchOnIdle />
            <DashboardShell>{children}</DashboardShell>
        </div>
        </AccountMotion>
        </ClientOnly>
    );
};
export default DashboardLayout;