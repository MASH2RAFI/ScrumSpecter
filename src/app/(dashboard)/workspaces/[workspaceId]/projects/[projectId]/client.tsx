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
import { PencilLineIcon, CalendarIcon, ClockIcon, TargetIcon, UsersIcon, BarChart3Icon } from "lucide-react";
import Link from "next/link";
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/lib/sprint-utils";

 

export const ProjectIdClient = () => { 
    const router = useRouter();
    const projectId = useProjectId();
    const workspaceId = useWorkspaceId();
    const { isAdmin } = useIsAdmin({ workspaceId });
    const { data: project, isLoading: isLoadingProject, error: projectError } = useGetProject({ projectId });

    // Check for workspace not found errors and redirect
    useEffect(() => {
        if (projectError) {
            // Check if the error indicates workspace not found (401 Unauthorized or 404 Not Found)
            if (projectError && typeof projectError === 'object' && 'message' in projectError) {
                const message = (projectError as Error).message.toLowerCase();
                const isWorkspaceNotFound = message.includes('unauthorized') || 
                                          message.includes('not found') || 
                                          message.includes('failed to fetch');
                
                if (isWorkspaceNotFound) {
                    // Redirect to create workspace page
                    router.push('/workspaces/create');
                }
            }
        }
    }, [projectError, router]);

    const isLoading = isLoadingProject;

    if (isLoading) {
        return <PageLoader />
    }
    
    // If there are errors, show loading while redirect happens
    if (projectError) {
        return <PageLoader />
    }
    
    if (!project){
        return <PageError message="Project not found" />
    }

    return(
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
                            <Link href={ `/workspaces/${project.workspaceId}/projects/${project.$id}/settings` }>
                            <PencilLineIcon className="size-4 mr-2"/>
                                Edit Project
                            </Link>
                        </Button>
                    </div>
                )}
            </div>

            {/* Project Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Sprint Information Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 pb-3">
                        <TargetIcon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Sprint Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Sprint Duration</span>
                            <Badge variant="secondary">
                                {project.sprintDuration || 14} days
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Current Sprint</span>
                            <Badge variant="outline">
                                Sprint #{project.sprintNumber || 1}
                            </Badge>
                        </div>
                        {project.startingSprintDate && (
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Starting Date</span>
                                <span className="text-sm font-medium">
                                    {project.startingSprintDate}
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Current Sprint Dates Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 pb-3">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Current Sprint</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Start Date</span>
                                <span className="text-sm font-medium">
                                    {formatDateDDMMYYYY(new Date(project.currentSprintStartDate))}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">End Date</span>
                                <span className="text-sm font-medium">
                                    {formatDateDDMMYYYY(new Date(project.currentSprintEndDate))}
                                </span>
                            </div>
                        </div>
                        <div className="pt-2 border-t">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <ClockIcon className="h-4 w-4" />
                                <span>
                                    {Math.ceil((new Date(project.currentSprintEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Project Statistics Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 pb-3">
                        <BarChart3Icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">Project Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Created</span>
                            <span className="text-sm font-medium">
                                {formatDateDDMMYYYY(new Date(project.$createdAt))}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Last Updated</span>
                            <span className="text-sm font-medium">
                                {formatDateDDMMYYYY(new Date(project.$updatedAt))}
                            </span>
                        </div>
                        <div className="pt-2 border-t">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <UsersIcon className="h-4 w-4" />
                                <span>View tasks below for detailed metrics</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tasks Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <TargetIcon className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">Project Tasks</h2>
                </div>
                <TaskViewSwitcher hideProjectFilter/>
            </div>
        </div>
    )
}; 
