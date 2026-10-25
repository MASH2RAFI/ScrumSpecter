"use client";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGetProject } from "@/features/projects/api/use-get-project";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { TaskViewSwitcher } from "@/features/tasks/components/task-view-switcher";
import { PencilLineIcon, CalendarIcon, ClockIcon, TargetIcon, UsersIcon, BarChart3Icon, LucideIcon } from "lucide-react";
import Link from "next/link";
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useRedirectOnAccessError } from "@/hooks/use-redirect-on-access-error";
import { isAccessError } from "@/lib/api-error";
import { formatDateDDMMYYYY } from "@/lib/sprint-utils";

interface InfoCardProps {
    icon: LucideIcon;
    title: string;
    children: React.ReactNode;
}

const InfoCard = ({ icon: Icon, title, children }: InfoCardProps) => (
    <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
            {children}
        </CardContent>
    </Card>
);

const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{label}</span>
        {children}
    </div>
);

const InfoValue = ({ children }: { children: React.ReactNode }) => (
    <span className="text-sm font-medium">{children}</span>
);

const InfoFooter = ({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) => (
    <div className="pt-2 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon className="h-4 w-4" />
            <span>{children}</span>
        </div>
    </div>
);

export const ProjectIdClient = () => {
    const projectId = useProjectId();
    const workspaceId = useWorkspaceId();
    const { isAdmin } = useIsAdmin({ workspaceId });
    const { data: project, isLoading: isLoadingProject, error: projectError } = useGetProject({ projectId });

    useRedirectOnAccessError(projectError);

    // Keep showing the loader while an access-error redirect happens
    if (isLoadingProject || isAccessError(projectError)) {
        return <PageLoader />
    }

    if (!project) {
        return <PageError message="Project not found" />
    }

    return (
        <div className="flex flex-col gap-y-6">
            {/* Project Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-3">
                    <ProjectAvatar
                        name={project.name}
                        className="size-10"
                    />
                    <div>
                        <h1 className="text-2xl font-bold">{project.name}</h1>
                        <p className="text-sm text-muted-foreground">Project Details</p>
                    </div>
                </div>

                {isAdmin && (
                    <div>
                        <Button variant="secondary" size="sm" asChild>
                            <Link href={`/workspaces/${project.workspaceId}/projects/${project.$id}/settings`}>
                                <PencilLineIcon className="size-4 mr-2" />
                                Edit Project
                            </Link>
                        </Button>
                    </div>
                )}
            </div>

            {/* Project Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <InfoCard icon={TargetIcon} title="Sprint Information">
                    <InfoRow label="Sprint Duration">
                        <Badge variant="secondary">
                            {project.sprintDuration || 14} days
                        </Badge>
                    </InfoRow>
                    <InfoRow label="Current Sprint">
                        <Badge variant="outline">
                            Sprint #{project.sprintNumber || 1}
                        </Badge>
                    </InfoRow>
                    {project.startingSprintDate && (
                        <InfoRow label="Starting Date">
                            <InfoValue>{project.startingSprintDate}</InfoValue>
                        </InfoRow>
                    )}
                </InfoCard>

                <InfoCard icon={CalendarIcon} title="Current Sprint">
                    <div className="space-y-2">
                        <InfoRow label="Start Date">
                            <InfoValue>{formatDateDDMMYYYY(project.currentSprintStartDate)}</InfoValue>
                        </InfoRow>
                        <InfoRow label="End Date">
                            <InfoValue>{formatDateDDMMYYYY(project.currentSprintEndDate)}</InfoValue>
                        </InfoRow>
                    </div>
                    <InfoFooter icon={ClockIcon}>
                        {Math.ceil((new Date(project.currentSprintEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                    </InfoFooter>
                </InfoCard>

                <InfoCard icon={BarChart3Icon} title="Project Stats">
                    <InfoRow label="Created">
                        <InfoValue>{formatDateDDMMYYYY(new Date(project.$createdAt))}</InfoValue>
                    </InfoRow>
                    <InfoRow label="Last Updated">
                        <InfoValue>{formatDateDDMMYYYY(new Date(project.$updatedAt))}</InfoValue>
                    </InfoRow>
                    <InfoFooter icon={UsersIcon}>
                        View tasks below for detailed metrics
                    </InfoFooter>
                </InfoCard>
            </div>

            {/* Tasks Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <TargetIcon className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">Project Tasks</h2>
                </div>
                <TaskViewSwitcher hideProjectFilter />
            </div>
        </div>
    );
};
