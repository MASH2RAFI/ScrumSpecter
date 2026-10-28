"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { useUpdatePreferences } from "@/features/account/api/use-account";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";

// My Tasks: each project with an eye to show or hide its tasks there. Saved on the account
// (preferences.hiddenProjects), so it follows the person to other devices.
export const ProjectVisibility = ({ workspaceId }: { workspaceId: string }) => {
    const queryClient = useQueryClient();
    const { hiddenProjects } = usePreferences();
    const { data: projects } = useGetProjects({ workspaceId });
    const { mutate: updatePreferences } = useUpdatePreferences({ silent: true });

    if (!projects?.documents.length) return null;
    const hidden = new Set(hiddenProjects);

    const toggle = (projectId: string) => {
        const next = hidden.has(projectId)
            ? hiddenProjects.filter((id) => id !== projectId)
            : [...hiddenProjects, projectId];
        // Into the cached user at once, so the views update before the save comes back
        queryClient.setQueryData<{ preferences: Record<string, unknown> } | null>(["current"], (current) =>
            current ? { ...current, preferences: { ...current.preferences, hiddenProjects: next } } : current);
        updatePreferences({ hiddenProjects: next });
    };

    return (
        <ul className="flex flex-wrap gap-2" aria-label="Projects shown in My Tasks">
            {projects.documents.map((project) => {
                const isHidden = hidden.has(project.$id);
                return (
                    <li
                        key={project.$id}
                        className={cn(
                            "flex items-center gap-1.5 rounded-full border py-0.5 pl-1 pr-0.5 text-sm transition-colors duration-200 ease-out",
                            isHidden ? "border-dashed border-border text-muted-foreground" : "border-border/70 bg-background",
                        )}
                    >
                        <ProjectAvatar name={project.name} className={cn(isHidden && "opacity-50")} />
                        <span className={cn("max-w-[10rem] truncate", isHidden && "line-through")}>{project.name}</span>
                        <button
                            type="button"
                            onClick={() => toggle(project.$id)}
                            aria-pressed={!isHidden}
                            aria-label={isHidden ? `Show ${project.name} in My Tasks` : `Hide ${project.name} from My Tasks`}
                            title={isHidden ? "Show in My Tasks" : "Hide from My Tasks"}
                            className="grid size-7 min-h-0 min-w-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                            {isHidden ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};
