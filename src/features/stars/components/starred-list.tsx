"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RepeatIcon, StarIcon } from "lucide-react";

import { PageError } from "@/components/page-error";
import { CardListSkeleton, Loading } from "@/components/page-skeletons";
import { Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { WEEKDAYS } from "@/features/routines/types";
import { TaskDate } from "@/features/tasks/components/task-date";
import { useTaskPanel } from "@/features/tasks/hooks/use-task-panel";
import { snakeCaseToTitleCase } from "@/lib/utils";

import { useGetStarred } from "../api/use-stars";
import { StarButton } from "./star-button";

type Starred = NonNullable<ReturnType<typeof useGetStarred>["data"]>;

// Every workspace's stars, the current workspace first
export const StarredList = ({ workspaceId }: { workspaceId: string }) => {
    const [includeDone, setIncludeDone] = useState(false);
    const { data, isLoading, isError } = useGetStarred(includeDone);
    const { open } = useTaskPanel();
    const router = useRouter();

    const toggle = (
        <div className="flex items-center gap-2">
            <Checkbox id="starred-show-done" checked={includeDone} onCheckedChange={(checked) => setIncludeDone(checked === true)} />
            <Label htmlFor="starred-show-done">Show done</Label>
        </div>
    );

    if (isLoading) return <div className="space-y-4">{toggle}<Loading><CardListSkeleton /></Loading></div>;
    if (isError || !data) return <PageError message="Failed to load starred items" />;

    const groups = groupByWorkspace(data, workspaceId);

    return (
        <div className="space-y-6">
            {toggle}
            {groups.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
                    <StarIcon className="size-8" aria-hidden />
                    <p>Star tasks and routines to keep them here</p>
                </div>
            ) : (
                <Stagger className="space-y-6">
                    {groups.map((group) => (
                        <StaggerItem as="section" key={group.workspaceId} className="space-y-3">
                            <h2 className="text-lg font-semibold">{group.workspaceName}</h2>
                            {group.tasks.length > 0 && (
                                <Card>
                                    <CardContent className="divide-y p-0" aria-label={`Starred tasks in ${group.workspaceName}`}>
                                        {group.tasks.map((task) => {
                                            const here = task.workspaceId === workspaceId;
                                            return (
                                                <div
                                                    key={task.id}
                                                    data-testid="starred-task"
                                                    className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/50"
                                                    // The panel's forms assume this workspace's projects and members, so others open their full page
                                                    onClick={() => here ? open(task.id) : router.push(`/workspaces/${task.workspaceId}/tasks/${task.id}`)}
                                                >
                                                    <StarButton workspaceId={task.workspaceId} item={{ taskId: task.id }} name={task.name} />
                                                    <span className="min-w-0 flex-1 font-medium">{task.name}</span>
                                                    <span className="text-sm text-muted-foreground">{task.projectName ?? "Personal"}</span>
                                                    <span className="text-sm text-muted-foreground">{task.assigneeNames.join(", ") || "Unassigned"}</span>
                                                    <TaskDate value={task.dueDate} className="text-sm" />
                                                    <Badge variant={task.status}>{snakeCaseToTitleCase(task.status)}</Badge>
                                                </div>
                                            );
                                        })}
                                    </CardContent>
                                </Card>
                            )}
                            {group.routines.map((routine) => (
                                <div key={routine.id} data-testid="starred-routine" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3">
                                    <StarButton workspaceId={routine.workspaceId} item={{ routineId: routine.id }} name={routine.name} />
                                    <RepeatIcon className="size-4 text-primary" aria-hidden />
                                    <Link href={`/workspaces/${routine.workspaceId}/routines`} className="min-w-0 flex-1 font-medium hover:underline">
                                        {routine.name}
                                    </Link>
                                    <span className="text-sm text-muted-foreground">
                                        {WEEKDAYS.filter((day) => routine.weekdays.includes(day.value)).map((day) => day.short).join(", ")}
                                        {routine.startTime ? ` · ${routine.startTime}` : ""}
                                    </span>
                                    <span className="text-sm text-muted-foreground">{routine.projectName ?? "Personal"}</span>
                                    <span className="text-sm text-muted-foreground">
                                        {routine.nextDue ? <>Next: <TaskDate value={routine.nextDue} className="inline" /></> : routine.active ? "No upcoming task" : "Paused"}
                                    </span>
                                </div>
                            ))}
                        </StaggerItem>
                    ))}
                </Stagger>
            )}
        </div>
    );
};

const groupByWorkspace = ({ tasks, routines }: Starred, currentId: string) => {
    const groups = new Map<string, { workspaceId: string; workspaceName: string; tasks: Starred["tasks"]; routines: Starred["routines"] }>();
    const groupOf = (workspaceId: string, workspaceName: string) => {
        if (!groups.has(workspaceId)) groups.set(workspaceId, { workspaceId, workspaceName, tasks: [], routines: [] });
        return groups.get(workspaceId)!;
    };
    tasks.forEach((task) => groupOf(task.workspaceId, task.workspaceName).tasks.push(task));
    routines.forEach((routine) => groupOf(routine.workspaceId, routine.workspaceName).routines.push(routine));
    return Array.from(groups.values()).sort((a, b) =>
        Number(b.workspaceId === currentId) - Number(a.workspaceId === currentId) || a.workspaceName.localeCompare(b.workspaceName));
};
