"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreVertical, RepeatIcon } from "lucide-react"

import { Task, TaskStatus } from "../types";
import { useUpdateTask } from "../api/use-update-task";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { TaskDate } from "./task-date";
import { Badge } from "@/components/ui/badge";
import { snakeCaseToTitleCase } from "@/lib/utils";
import { TaskActions } from "./task-actions";
import { useTaskPanel } from "../hooks/use-task-panel";

const STATUSES = Object.values(TaskStatus);

// Status badge doubles as a menu to change status in place (members may change status too)
const StatusCell = ({ task }: { task: Task }) => {
    const { mutate } = useUpdateTask();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" aria-label={`Change status (${snakeCaseToTitleCase(task.status)})`} className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Badge variant={task.status} className="cursor-pointer">{snakeCaseToTitleCase(task.status)}</Badge>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {STATUSES.map((status) => (
                    <DropdownMenuItem
                        key={status}
                        disabled={status === task.status}
                        onClick={() => mutate({ param: { taskId: task.$id }, json: { status } })}
                    >
                        <Badge variant={status}>{snakeCaseToTitleCase(status)}</Badge>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

// Clicking the name opens the task in the side panel
const TaskNameCell = ({ task }: { task: Task }) => {
    const { open } = useTaskPanel();

    return (
        <button
            type="button"
            onClick={() => open(task.$id)}
            className="flex items-center gap-1.5 text-left hover:text-primary hover:underline underline-offset-2"
        >
            {task.routineId && <RepeatIcon className="size-3.5 shrink-0 text-primary" aria-label="From a weekly routine" />}
            <span className="line-clamp-1">{task.name}</span>
        </button>
    );
};

const baseColumns: ColumnDef<Task>[] = [
    {
        accessorKey: "name",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Task Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            return <TaskNameCell task={row.original} />;
        }
    },

    {
        accessorKey: "project",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Project
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const project = row.original.project;

            if (!project) {
                return <p className="text-muted-foreground">No project</p>;
            }

            return (
                <div className="flex items-center gap-x-2 text-sm font-medium">
                    <ProjectAvatar
                        className="size-6"
                        name={project?.name}
                    />
                    <p className="line-clamp-1">{project?.name}</p>
                </div>
            )
        }
    },

    {
        accessorKey: "assignee",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Assignee
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const assignee = row.original.assignee;

            if (!assignee) {
                return <p className="text-muted-foreground">Unassigned</p>;
            }

            return (
                <div className="flex items-center gap-x-2 text-sm font-medium">
                    <MemberAvatar
                    className="size-6"
                    fallbackClassName="text-xs"
                    name={assignee?.name}
                    />
                    <p className="line-clamp-1">{assignee?.name || "Unassigned"}</p>
                </div>
            )
        }
    },

    {
        accessorKey: "dueDate",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Due Date
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const dueDate = row.original.dueDate;

            return <TaskDate value={dueDate} />
        }
    },

    {
        accessorKey: "storyPoints",
        header: ({ column }) => (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Points
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => (
            <span className="tabular-nums text-sm text-muted-foreground">{row.original.storyPoints ?? "—"}</span>
        ),
    },
    {
        accessorKey: "status",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => <StatusCell task={row.original} />,
    },

    {
        id: "actions", 
        cell: ({ row }) => {
            const id = row.original.$id; 
            const projectId = row.original.projectId; 

            return ( 
                <TaskActions id={id} projectId={projectId}> 
                    <Button variant="ghost" className="size-8 p-0"> 
                        <MoreVertical className="size-4" /> 
                    </Button> 
                </TaskActions> 
            ) 
        }
    },
];

export const getColumns = (tasks: Task[]): ColumnDef<Task>[] => {
    // Check if any task has a project
    const hasProjects = tasks.some(task => task.project);
    
    // Filter out the project column if no tasks have projects
    if (!hasProjects) {
        return baseColumns.filter(column => 
            !('accessorKey' in column) || column.accessorKey !== "project"
        );
    }
    
    return baseColumns;
};