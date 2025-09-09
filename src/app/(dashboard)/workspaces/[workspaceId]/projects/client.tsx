"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { Project } from "@/features/projects/types";
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { PlusIcon, TargetIcon } from "lucide-react";
import Link from "next/link";

interface ProjectsClientProps {
    projects: {
        documents: Project[];
        total: number;
    };
    workspaceId: string;
}

export const ProjectsClient = ({ projects, workspaceId }: ProjectsClientProps) => {
    const { open } = useCreateProjectModal();
    const { isAdmin } = useIsAdmin({ workspaceId });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Projects</h1>
                    <p className="text-muted-foreground">
                        Manage your projects and sprints
                    </p>
                </div>
                {isAdmin && (
                    <Button onClick={() => open()}>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        New Project
                    </Button>
                )}
            </div>

            {projects.documents.length === 0 ? (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-r from-muted/20 to-muted/10 mb-6">
                        <TargetIcon className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
                    <p className="text-muted-foreground mb-4">
                        Create your first project to get started with sprints and task management
                    </p>
                    {isAdmin && (
                        <Button onClick={() => open()}>
                            <PlusIcon className="mr-2 h-4 w-4" />
                            Create Project
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.documents.map((project) => (
                        <Card key={project.$id} className="hover:shadow-lg transition-shadow duration-200">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg">{project.name}</CardTitle>
                                    <TargetIcon className="h-5 w-5 text-primary" />
                                </div>
                                <CardDescription>
                                    Sprint {project.sprintNumber || 1} • {project.sprintDuration || 14} days
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {project.currentSprintStartDate && project.currentSprintEndDate && (
                                        <div className="text-sm text-muted-foreground">
                                            <div>Start: {new Date(project.currentSprintStartDate).toLocaleDateString()}</div>
                                            <div>End: {new Date(project.currentSprintEndDate).toLocaleDateString()}</div>
                                        </div>
                                    )}
                                    <Button asChild className="w-full">
                                        <Link href={`/workspaces/${workspaceId}/projects/${project.$id}`}>
                                            View Project
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};
