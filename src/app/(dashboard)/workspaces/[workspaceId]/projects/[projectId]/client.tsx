"use client";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { useGetProject } from "@/features/projects/api/use-get-project";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { TaskViewSwitcher } from "@/features/tasks/components/task-view-switcher";
import { PencilLineIcon } from "lucide-react";
import Link from "next/link";
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

 

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
        <div className="flex flex-col gap-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-x-2">
                <ProjectAvatar
                    name={project.name}
                    className="size-8"
                />
                
                <p className="text-lg font-semibold" >{project.name}</p>
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
            <TaskViewSwitcher hideProjectFilter/>
        </div>
    )
}; 
