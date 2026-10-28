"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TargetIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { DottedSeparator } from "@/components/dotted-separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SimpleDatePicker } from "@/components/simple-date-picker";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { Task, TaskStatus } from "../types";
import { useUpdateTask } from "../api/use-update-task";
import { useCreateChangeRequest } from "@/features/change-requests/api/use-change-requests";
import {
    AssigneePicker,
    ProjectSelectItems,
    StatusSelectItems,
    TaskFormFooter,
    TaskFormOptionsProps,
    TaskSelect,
} from "./task-form-fields";

import { TaskTimeFields } from "./task-time-fields";
import { HolidayNotice } from "@/features/workspaces/components/holiday-notice";
import { combineDateAndTime, DEFAULT_DURATION_MINUTES, toTimeInput } from "../task-time";

const formSchema = z.object({
    name: z.string().trim().min(1, "Required"),
    status: z.nativeEnum(TaskStatus, { error: "Required" }),
    projectId: z.string().trim().min(1, "Required"),
    dueDate: z.date().optional(),
    assigneeIds: z.array(z.string()).min(1, "Pick at least one assignee").max(20),
    description: z.string().optional(),
    storyPoints: z.number().min(1, "Story points must be at least 1").max(100, "Story points cannot exceed 100").optional(),
    // "" = all day
    startTime: z.string().optional(),
    durationMinutes: z.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditTaskFormProps extends TaskFormOptionsProps {
    onCancel?: () => void;
    initialValues: Task;
};

// Admins and supervisors edit everything. Others may change the status and description of
// their own tasks (reviewers: any task); other edits are sent as a change request for an admin
// or supervisor to approve.
export const EditTaskForm = ({ onCancel, projectOptions, memberOptions, initialValues }: EditTaskFormProps) => {
    const workspaceId = useWorkspaceId();
    const { canEditWork, canReview, canRequestChanges, memberId, isViewer } = usePermissions({ workspaceId });
    const isAssignee = Boolean(memberId && initialValues.assigneeIds?.includes(memberId));
    const canWorkOnIt = canReview || (!isViewer && isAssignee);
    // Editors change the details directly; requesters propose them
    const canChangeDetails = canEditWork || canRequestChanges;
    const { mutate, isPending: isUpdating } = useUpdateTask();
    const { mutate: requestChange, isPending: isRequesting } = useCreateChangeRequest();
    const isPending = isUpdating || isRequesting;
    const [requestNote, setRequestNote] = useState("");
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: initialValues.name,
            status: initialValues.status,
            projectId: initialValues.projectId,
            dueDate: initialValues.dueDate ? new Date(initialValues.dueDate) : undefined,
            assigneeIds: initialValues.assigneeIds ?? [],
            description: initialValues.description || "",
            // Postgres returns null for tasks without points; the schema only allows a number or undefined
            storyPoints: initialValues.storyPoints ?? undefined,
            startTime: toTimeInput(initialValues.startAt),
            durationMinutes: initialValues.startAt ? initialValues.durationMinutes ?? DEFAULT_DURATION_MINUTES : undefined,
        },
    });

    const onSubmit = (values: FormValues) => {
        const { startTime, durationMinutes, ...rest } = values;
        // The time block sits on the due date (or the existing day when no due date is set)
        const day = values.dueDate ?? (initialValues.dueDate ? new Date(initialValues.dueDate) : new Date());
        const timed = Boolean(startTime);
        const time = {
            startAt: timed ? combineDateAndTime(day, startTime!) : null,
            durationMinutes: timed ? durationMinutes ?? DEFAULT_DURATION_MINUTES : null,
        };
        const done = () => {
            form.reset();
            onCancel?.();
        };

        if (canEditWork) {
            mutate({ json: { ...rest, ...time }, param: { taskId: initialValues.$id } }, { onSuccess: done });
            return;
        }

        // Status and description (own tasks) change right away; everything else is proposed
        const dirty = form.formState.dirtyFields;
        const direct = {
            ...(dirty.status ? { status: rest.status } : {}),
            ...(dirty.description && canWorkOnIt ? { description: rest.description } : {}),
        };
        const proposed = {
            ...(dirty.name ? { name: rest.name } : {}),
            ...(dirty.projectId ? { projectId: rest.projectId } : {}),
            ...(dirty.assigneeIds ? { assigneeIds: rest.assigneeIds } : {}),
            ...(dirty.storyPoints ? { storyPoints: rest.storyPoints } : {}),
            ...(dirty.dueDate ? { dueDate: rest.dueDate?.toISOString() ?? null } : {}),
            ...(dirty.startTime || dirty.durationMinutes || (dirty.dueDate && timed) ? time : {}),
            ...(dirty.description && !canWorkOnIt ? { description: rest.description } : {}),
        };
        const wantsDirect = Object.keys(direct).length > 0;
        const wantsRequest = canRequestChanges && Object.keys(proposed).length > 0;
        if (!wantsDirect && !wantsRequest) {
            done();
            return;
        }

        if (wantsDirect) {
            mutate({ json: direct, param: { taskId: initialValues.$id } }, { onSuccess: wantsRequest ? undefined : done });
        }
        if (wantsRequest) {
            requestChange({
                kind: "update",
                taskId: initialValues.$id,
                changes: proposed,
                note: requestNote.trim() || undefined,
            }, { onSuccess: done });
        }
    };

    const detailsChanged = !canEditWork && canRequestChanges
        && ["name", "projectId", "assigneeIds", "storyPoints", "dueDate", "startTime", "durationMinutes"]
            .some((field) => field in form.formState.dirtyFields);

    return (
        <Card className="w-full h-full border-none shadow-none">
            <CardHeader className="flex p-7">
                <CardTitle className="text-x1 font-bold">
                    Edit a task
                </CardTitle>
            </CardHeader>
            <div className="px-7">
                <DottedSeparator />
            </div>
            <CardContent className="p-7">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <div className="flex flex-col gap-y-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Task Name
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                placeholder="Enter task name"
                                                disabled={!canChangeDetails}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Description
                                        </FormLabel>
                                        <FormControl>
                                            <Textarea
                                                {...field}
                                                placeholder="Enter task description"
                                                rows={3}
                                                disabled={!canWorkOnIt && !canRequestChanges}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="dueDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <SimpleDatePicker
                                                value={field.value}
                                                onChange={field.onChange}
                                                label="Due Date"
                                                placeholder="Select due date"
                                                    presets
                                                disabled={!canChangeDetails}
                                                size="lg"
                                            />
                                        </FormControl>
                                        <HolidayNotice date={field.value} />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <TaskTimeFields disabled={!canChangeDetails} />

                            <FormField
                                control={form.control}
                                name="assigneeIds"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Assignees
                                        </FormLabel>
                                        <AssigneePicker
                                            value={field.value}
                                            onChange={field.onChange}
                                            options={memberOptions}
                                            disabled={!canChangeDetails}
                                        />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Status
                                        </FormLabel>
                                        <TaskSelect
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Select status"
                                            disabled={!canWorkOnIt}
                                        >
                                            <StatusSelectItems />
                                        </TaskSelect>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="projectId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Project
                                        </FormLabel>
                                        <TaskSelect
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Select project"
                                            disabled={!canChangeDetails}
                                        >
                                            <ProjectSelectItems options={projectOptions} />
                                        </TaskSelect>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="storyPoints"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <TargetIcon className="h-4 w-4 text-primary" />
                                            Story Points
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                type="number"
                                                min="1"
                                                max="100"
                                                placeholder="Enter story points"
                                                disabled={!canChangeDetails}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    field.onChange(value === "" ? undefined : Number(value));
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {detailsChanged && (
                            <div className="mt-4 space-y-1.5 rounded-md border border-dashed p-3">
                                <p className="text-sm">
                                    Admins and supervisors approve changes to the task&apos;s details. Yours are sent as a request.
                                </p>
                                <Input
                                    value={requestNote}
                                    onChange={(e) => setRequestNote(e.target.value)}
                                    placeholder="Why? (optional note for the reviewer)"
                                    maxLength={1000}
                                    aria-label="Note for the reviewer"
                                />
                            </div>
                        )}

                        <TaskFormFooter onCancel={onCancel} isPending={isPending}>
                            <Button
                                type="submit"
                                size="lg"
                                disabled={isPending || !(canWorkOnIt || canChangeDetails)}
                            >
                                {detailsChanged ? "Send request" : "Save changes"}
                            </Button>
                        </TaskFormFooter>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};
