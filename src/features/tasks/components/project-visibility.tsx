"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePreferences, useSavePreferences } from "@/features/auth/hooks/use-preferences";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";

// Each project with an eye to show or hide it on a page: My Tasks (preferences.hiddenProjects)
// or Routines (preferences.hiddenRoutineProjects). Saved on the account, so it follows the person
// to other devices.
export const ProjectVisibility = ({ workspaceId, setting = "hiddenProjects", page = "My Tasks", compact }: {
    workspaceId: string;
    setting?: "hiddenProjects" | "hiddenRoutineProjects";
    page?: string;
    // Chip-sized, for a filter block
    compact?: boolean;
}) => {
    const hiddenProjects = usePreferences()[setting];
    const { data: projects } = useGetProjects({ workspaceId });
    const save = useSavePreferences();

    if (!projects?.documents.length) return null;
    const hidden = new Set(hiddenProjects);

    const toggle = (projectId: string) => {
        const next = hidden.has(projectId)
            ? hiddenProjects.filter((id) => id !== projectId)
            : [...hiddenProjects, projectId];
        save({ [setting]: next });
    };

    return (
        <ul className={cn("flex flex-wrap", compact ? "gap-1" : "gap-2")} aria-label={`Projects shown in ${page}`}>
            {projects.documents.map((project) => {
                const isHidden = hidden.has(project.$id);
                return (
                    <li
                        key={project.$id}
                        className={cn(
                            "flex items-center rounded-full border transition-colors duration-200 ease-out",
                            compact ? "h-6 gap-1 pl-0.5 pr-0 text-xs" : "gap-1.5 py-0.5 pl-1 pr-0.5 text-sm",
                            isHidden ? "border-dashed border-border text-muted-foreground" : "border-border/70 bg-background",
                        )}
                    >
                        <ProjectAvatar name={project.name} className={cn(compact && "size-4", isHidden && "opacity-50")} fallbackClassName={compact ? "text-[8px]" : undefined} />
                        <span className={cn("max-w-[10rem] truncate", isHidden && "line-through")}>{project.name}</span>
                        <button
                            type="button"
                            onClick={() => toggle(project.$id)}
                            aria-pressed={!isHidden}
                            aria-label={isHidden ? `Show ${project.name} in ${page}` : `Hide ${project.name} from ${page}`}
                            title={isHidden ? `Show in ${page}` : `Hide from ${page}`}
                            className={cn("grid min-h-0 min-w-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground", compact ? "size-5" : "size-7")}
                        >
                            {isHidden ? <EyeOffIcon className={compact ? "size-3" : "size-4"} /> : <EyeIcon className={compact ? "size-3" : "size-4"} />}
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};
