import { DashboardShell } from "@/components/dashboard-shell";
import { CreateProjectModal } from "@/features/projects/components/create-project-modal";
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
        <div className="min-h-screen">
            <CreateWorkspaceWithProjectModal />
            <CreateProjectModal />
            <CreateTaskModal />
            <EditTaskModal />
            <RoutineModal />
            <TaskPanel />
            <DashboardShell>{children}</DashboardShell>
        </div>
);
};
export default DashboardLayout;