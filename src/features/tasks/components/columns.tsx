"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreVertical, RepeatIcon } from "lucide-react"

import { Task } from "../types";
import { Button } from "@/components/ui/button";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { MemberAvatarStack } from "@/features/members/components/member-avatar";
import { TaskDate } from "./task-date";
import { TaskActions } from "./task-actions";
import { useTaskPanel } from "../hooks/use-task-panel";
import { TaskStatusMenu } from "./task-status-menu";


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
        id: "assignee",
        // Sorts by the first assignee's name
        accessorFn: (task) => task.assignees?.[0]?.name ?? "",
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
            const names = (row.original.assignees ?? []).map((assignee) => assignee.name);

            if (names.length === 0) {
                return <p className="text-muted-foreground">Unassigned</p>;
            }

            return (
                <div className="flex items-center gap-x-2 text-sm font-medium">
                    <MemberAvatarStack className="size-6" fallbackClassName="text-xs" names={names} />
                    <p className="line-clamp-1">{names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`}</p>
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
            const { dueDate, startAt, durationMinutes } = row.original;

            return <TaskDate value={dueDate} startAt={startAt} durationMinutes={durationMinutes} />
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
        cell: ({ row }) => <TaskStatusMenu task={row.original} />,
    },

    {
        id: "actions", 
        cell: ({ row }) => {
            const id = row.original.$id; 
            const projectId = row.original.projectId; 

            return ( 
                <TaskActions id={id} projectId={projectId}> 
                    <Button variant="ghost" className="size-8 p-0" aria-label={`Actions for ${row.original.name}`}> 
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