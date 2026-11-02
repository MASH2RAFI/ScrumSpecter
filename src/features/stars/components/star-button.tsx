"use client";

import { StarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useGetStarIds, useToggleStar, type StarItem } from "../api/use-stars";

interface StarButtonProps {
    workspaceId: string;
    item: StarItem;
    name: string;
    className?: string;
}

export const StarButton = ({ workspaceId, item, name, className }: StarButtonProps) => {
    const { data } = useGetStarIds(workspaceId);
    const { mutate } = useToggleStar(workspaceId);
    const starred = "taskId" in item
        ? Boolean(data?.taskIds.includes(item.taskId))
        : Boolean(data?.routineIds.includes(item.routineId));

    return (
        <button
            type="button"
            data-row-click-ignore
            aria-pressed={starred}
            aria-label={`${starred ? "Unstar" : "Star"} ${name}`}
            title={starred ? "Unstar" : "Star"}
            onClick={(e) => {
                // Cards and rows open the task on click; starring shouldn't
                e.stopPropagation();
                mutate({ item, starred: !starred });
            }}
            className={cn("inline-flex shrink-0 items-center justify-center rounded-md p-0.5 text-muted-foreground hover:text-amber-500 transition-colors", className)}
        >
            <StarIcon className={cn("size-4", starred && "fill-amber-400 text-amber-500")} />
        </button>
    );
};
