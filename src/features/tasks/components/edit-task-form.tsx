"use client";

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
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { Task, TaskStatus } from "../types";
import { useUpdateTask } from "../api/use-update-task";
import {
    MemberSelectItems,
    ProjectSelectItems,
    StatusSelectItems,
    TaskFormFooter,
    TaskFormOptionsProps,
    TaskSelect,
} from "./task-form-fields";

import { TaskTimeFields } from "./task-time-fields";
import { combineDateAndTime, DEFAULT_DURATION_MINUTES, toTimeInput } from "../task-time";

const formSchema = z.object({
    name: z.string().trim().min(1, "Required"),
    status: z.nativeEnum(TaskStatus, { error: "Required" }),
    projectId: z.string().trim().min(1, "Required"),
    dueDate: z.date().optional(),
    assigneeId: z.string().trim().min(1, "Required"),
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

// Members may only change the description and status; everything else is admin-only.
export const EditTaskForm = ({ onCancel, projectOptions, memberOptions, initialValues }: EditTaskFormProps) => {
    const workspaceId = useWorkspaceId();
    const { isAdmin } = useIsAdmin({ workspaceId });
    const { mutate, isPending } = useUpdateTask();
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: initialValues.name,
            status: initialValues.status,
            projectId: initialValues.projectId,
            dueDate: initialValues.dueDate ? new Date(initialValues.dueDate) : undefined,
            assigneeId: initialValues.assigneeId || "",
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
        const json = {
            ...rest,
            startAt: timed ? combineDateAndTime(day, startTime!) : null,
            durationMinutes: timed ? durationMinutes ?? DEFAULT_DURATION_MINUTES : null,
        };

        mutate({ json, param: { taskId: initialValues.$id } }, {
            onSuccess: () => {
                form.reset();
                onCancel?.();
            }
        });
    };

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
                                                disabled={!isAdmin}
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
                                                disabled={!isAdmin}
                                                size="lg"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <TaskTimeFields disabled={!isAdmin} />

                            <FormField
                                control={form.control}
                                name="assigneeId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Assignee
                                        </FormLabel>
                                        <TaskSelect
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Select assignee"
                                            disabled={!isAdmin}
                                        >
                                            <MemberSelectItems options={memberOptions} />
                                        </TaskSelect>
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
                                            disabled={!isAdmin}
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
                                                disabled={!isAdmin}
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

                        <TaskFormFooter onCancel={onCancel} isPending={isPending}>
                            <Button
                                type="submit"
                                size="lg"
                                disabled={isPending}
                            >
                                Save changes
                            </Button>
                        </TaskFormFooter>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};
