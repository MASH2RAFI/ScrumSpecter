"use client";

import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiAddCircleFill } from "react-icons/ri";

import { useSidebar } from "./sidebar-context";
import { SIDEBAR_FADE, SIDEBAR_ROW } from "./sidebar-context";
import { RowsSkeleton } from "@/components/page-skeletons";

export const Projects = () => {
    const  pathname  = usePathname();
    const { open } = useCreateProjectModal();
    const workspaceId = useWorkspaceId();
    const { collapsed } = useSidebar();
    const { canEditWork } = usePermissions({ workspaceId });
    const { data, isLoading, error } = useGetProjects({
        workspaceId,
    });

    return (
        <div className="flex flex-col gap-y-2">
            <div className={cn("flex items-center justify-between", SIDEBAR_FADE)}>
                <p className="text-xs uppercase font-medium text-muted-foreground">Projects</p>
                {canEditWork && (
                    <RiAddCircleFill onClick={ open } className="size-5 text-muted-foreground cursor-pointer hover:text-primary transition-colors" />
                )}
            </div>
            {isLoading ? (
                <RowsSkeleton rows={3} />
            ) : error ? (
                <div className="w-full bg-destructive/10 border border-destructive/20 rounded-md p-3">
                    <p className="text-xs text-destructive text-center">Failed to load projects</p>
                </div>
            ) : data?.documents && data.documents.length > 0 ? (
                data.documents.map((project) => {
                    const href = `/workspaces/${workspaceId}/projects/${project.$id}`;
                    const isActive = pathname === href;
                    return (
                        <Link href={href} key={project.$id} title={collapsed ? project.name : undefined} aria-label={collapsed ? project.name : undefined}>
                            <div
                            className={cn(
                                "flex items-center gap-2.5 p-2.5 rounded-md transition-colors cursor-pointer text-muted-foreground hover:text-primary hover:bg-accent overflow-hidden",
                                SIDEBAR_ROW,
                                isActive && "bg-primary/10 text-primary shadow-sm"
                            )}
                            >
                                <ProjectAvatar name = {project.name} />
                                <span className={cn("truncate text-foreground", SIDEBAR_FADE)}>{project.name}</span>
                            </div>
                        </Link>
                    )
                })
            ) : (
                <div className="p-2 text-center">
                    <p className={cn("text-xs text-muted-foreground", SIDEBAR_FADE)}>No projects found</p>
                </div>
            )}

        </div>
    );
}