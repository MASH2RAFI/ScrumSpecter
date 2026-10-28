"use client";

import { NoProjectsState, ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { Project } from "@/features/projects/types";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { PlusIcon } from "lucide-react";

interface ProjectsClientProps {
    projects: {
        documents: Project[];
        total: number;
    };
    workspaceId: string;
}

export const ProjectsClient = ({ projects, workspaceId }: ProjectsClientProps) => {
    const { open } = useCreateProjectModal();
    const { canEditWork } = usePermissions({ workspaceId });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Projects</h1>
                    <p className="text-muted-foreground">
                        Manage your projects and sprints
                    </p>
                </div>
                {canEditWork && (
                    <Button onClick={() => open()}>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        New Project
                    </Button>
                )}
            </div>

            {projects.documents.length === 0 ? (
                <NoProjectsState canCreate={canEditWork} onCreate={() => open()} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.documents.map((project) => (
                        <ProjectCard
                            key={project.$id}
                            href={`/workspaces/${workspaceId}/projects/${project.$id}`}
                            name={project.name}
                            description={`Sprint ${project.sprintNumber || 1} • ${project.sprintDuration || 14} days`}
                            contentClassName="space-y-2"
                        >
                            {project.currentSprintStartDate && project.currentSprintEndDate && (
                                <div className="text-sm text-muted-foreground">
                                    <div>Start: {new Date(project.currentSprintStartDate).toLocaleDateString()}</div>
                                    <div>End: {new Date(project.currentSprintEndDate).toLocaleDateString()}</div>
                                </div>
                            )}
                        </ProjectCard>
                    ))}
                </div>
            )}
        </div>
    );
};
