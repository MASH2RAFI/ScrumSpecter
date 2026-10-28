"use client";

import { Trash2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimpleDatePicker } from "@/components/simple-date-picker";
import { useConfirm } from "@/hooks/use-confirm";
import { snakeCaseToTitleCase } from "@/lib/utils";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { useBulkEditTasks } from "../api/use-bulk-edit-tasks";
import { Task, TaskStatus } from "../types";

interface TaskBulkBarProps {
    tasks: Task[];
    clear: () => void;
    canEditWork: boolean;
    canReview: boolean;
}

// Shown above the table while tasks are ticked. Reviewers can change status; admins and
// supervisors can also reassign, reschedule and delete.
export const TaskBulkBar = ({ tasks, clear, canEditWork, canReview }: TaskBulkBarProps) => {
    const workspaceId = useWorkspaceId();
    const { data: members } = useGetMembers({ workspaceId });
    const { mutate, isPending } = useBulkEditTasks();
    const ids = tasks.map((task) => task.$id);
    const [ConfirmDelete, confirmDelete] = useConfirm(
        `Delete ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}?`,
        "You can undo this for a few seconds afterwards.",
        "destructive",
    );

    const apply = (changes: Parameters<typeof mutate>[0]["changes"]) =>
        mutate({ ids, changes }, { onSuccess: clear });

    return (
        <div
            role="toolbar"
            aria-label="Bulk actions"
            className="mb-2 flex flex-wrap items-center gap-2 rounded-md border bg-muted/60 px-3 py-2"
        >
            <ConfirmDelete />
            <span className="text-sm font-medium">{tasks.length} selected</span>

            {canReview && (
            <Select disabled={isPending} onValueChange={(status) => apply({ status: status as TaskStatus })}>
                <SelectTrigger className="h-8 w-36" aria-label="Set status">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    {Object.values(TaskStatus).map((status) => (
                        <SelectItem key={status} value={status}>{snakeCaseToTitleCase(status)}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            )}

            {canEditWork && (
                <>
                    <Select disabled={isPending} onValueChange={(assigneeId) => apply({ assigneeIds: [assigneeId] })}>
                        <SelectTrigger className="h-8 w-40" aria-label="Set assignee">
                            <SelectValue placeholder="Assign to" />
                        </SelectTrigger>
                        <SelectContent>
                            {members?.documents.map((member) => (
                                <SelectItem key={member.$id} value={member.$id}>{member.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="w-40" aria-label="Set due date">
                        <SimpleDatePicker
                            value={undefined}
                            size="sm"
                            disabled={isPending}
                            placeholder="Due date"
                            onChange={(date) => date && apply({ dueDate: date.toISOString() })}
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-destructive"
                        disabled={isPending}
                        onClick={async () => {
                            if (await confirmDelete()) apply({ delete: true });
                        }}
                    >
                        <Trash2Icon className="mr-1 size-4" />
                        Delete
                    </Button>
                </>
            )}

            <Button variant="ghost" size="sm" className="ml-auto h-8" onClick={clear}>
                <XIcon className="mr-1 size-4" />
                Clear
            </Button>
        </div>
    );
};
