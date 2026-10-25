"use client";

import Link from "next/link";
import { ExternalLinkIcon, Loader } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";

import { useGetTask } from "../api/use-get-task";
import { useTaskPanel } from "../hooks/use-task-panel";
import { TaskDescription } from "./task-description";
import { TaskOverview } from "./task-overview";

// Task details in a slide-over, so opening a task keeps your place in the table/kanban/calendar
export const TaskPanel = () => {
    const { taskId, close } = useTaskPanel();
    const { data: task, isLoading } = useGetTask({ taskId: taskId ?? "" });

    return (
        <Sheet open={Boolean(taskId)} onOpenChange={(open) => !open && close()}>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
                {isLoading || !task ? (
                    <div className="flex h-full items-center justify-center">
                        <SheetTitle className="sr-only">Loading task</SheetTitle>
                        {isLoading ? <Loader className="size-5 animate-spin text-muted-foreground" /> : <p className="text-sm text-muted-foreground">Task not found</p>}
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 p-6">
                        <SheetHeader className="space-y-2 pr-8 text-left">
                            {task.project && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <ProjectAvatar name={task.project.name} />
                                    {task.project.name}
                                </div>
                            )}
                            <SheetTitle className="text-xl leading-snug">{task.name}</SheetTitle>
                            <SheetDescription className="sr-only">Task details</SheetDescription>
                        </SheetHeader>
                        <TaskOverview task={task} />
                        <div className="border rounded-lg">
                            <TaskDescription task={task} />
                        </div>
                        <Button asChild variant="outline" size="sm" className="self-start" onClick={close}>
                            <Link href={`/workspaces/${task.workspaceId}/tasks/${task.$id}`}>
                                <ExternalLinkIcon className="size-4 mr-2" />
                                Open full page
                            </Link>
                        </Button>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
};
