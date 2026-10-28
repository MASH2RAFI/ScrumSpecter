"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ReactNode, useEffect, useState } from "react";
import { TargetIcon, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
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
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { TaskStatus } from "../types";
import { useCreateTask } from "../api/use-create-task";
import { usePermissions } from "@/features/members/hooks/use-permissions";
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
    name: z.string().trim().min(1, "Task name is required"),
    status: z.nativeEnum(TaskStatus, { message: "Please select a status" }),
    projectId: z.string().trim().min(1, "Please select a project"),
    dueDate: z.date({ message: "Due date is required" }),
    assigneeIds: z.array(z.string()).min(1, "Please select at least one assignee").max(20),
    description: z.string().optional(),
    storyPoints: z.number()
        .min(1, "Story points must be at least 1")
        .max(100, "Story points cannot exceed 100"),
    // "" = all day
    startTime: z.string().optional(),
    durationMinutes: z.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type FieldName = keyof FormValues;

const REQUIRED_FIELDS: FieldName[] = ["name", "status", "projectId", "assigneeIds", "storyPoints", "dueDate"];

interface FieldState {
    hasError: boolean;
    isEmpty: boolean;
    isValid: boolean;
}

const fieldStateClassName = ({ hasError, isEmpty, isValid }: FieldState) => cn(
    hasError && "border-destructive focus:border-destructive focus:ring-destructive/20",
    isEmpty && !hasError && "border-amber-400 focus:border-amber-400 focus:ring-amber-400/20",
    isValid && "border-green-500 focus:border-green-500 focus:ring-green-500/20"
);

const RequiredLabel = ({ state, children }: { state: FieldState, children: ReactNode }) => (
    <FormLabel className="flex items-center gap-2">
        {children}
        <span className="text-destructive">*</span>
        {state.hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
        {state.isEmpty && !state.hasError && <AlertCircle className="h-4 w-4 text-amber-500" />}
        {state.isValid && <CheckCircle2 className="h-4 w-4 text-green-600" />}
    </FormLabel>
);

interface CreateTaskFormProps extends TaskFormOptionsProps {
    onCancel?: () => void;
    defaultStatus?: TaskStatus;
    // From selecting a time range on the calendar
    defaultStart?: Date | null;
    defaultDuration?: number | null;
};

export const CreateTaskForm = ({ onCancel, projectOptions, memberOptions, defaultStatus, defaultStart, defaultDuration }: CreateTaskFormProps) => {
    const workspaceId = useWorkspaceId();
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const { mutate, isPending: isCreating, error: mutationError } = useCreateTask();
    // Assignees and reviewers propose the task; an admin or supervisor approves it
    const { canEditWork, canRequestChanges } = usePermissions({ workspaceId });
    const asRequest = !canEditWork && canRequestChanges;
    const { mutate: requestTask, isPending: isRequesting } = useCreateChangeRequest();
    const isPending = isCreating || isRequesting;
    const [requestNote, setRequestNote] = useState("");
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        mode: "onChange",
        defaultValues: {
            name: "",
            status: defaultStatus || TaskStatus.TODO,
            projectId: "",
            assigneeIds: [],
            description: "",
            storyPoints: 1,
            // Local midnight: Date.UTC() here showed as yesterday west of UTC
            dueDate: defaultStart
                ? new Date(defaultStart.getFullYear(), defaultStart.getMonth(), defaultStart.getDate())
                : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()),
            // A duration of 0 means the calendar picked a whole day, not a time
            startTime: defaultStart && defaultDuration !== 0 ? toTimeInput(defaultStart.toISOString()) : "",
            durationMinutes: defaultStart && defaultDuration !== 0 ? defaultDuration ?? DEFAULT_DURATION_MINUTES : undefined,
        },
    });

    useEffect(() => {
        if (defaultStatus) {
            form.setValue("status", defaultStatus);
        }
    }, [defaultStatus, form]);

    // handleSubmit only calls this once validation has passed
    const onSubmit = (values: FormValues) => {
        setSubmitAttempted(true);

        const { startTime, durationMinutes, dueDate, ...rest } = values;
        const timed = Boolean(startTime);

        const time = {
            startAt: timed ? combineDateAndTime(dueDate, startTime!) : null,
            durationMinutes: timed ? durationMinutes ?? DEFAULT_DURATION_MINUTES : null,
        };

        if (asRequest) {
            requestTask({
                kind: "create",
                workspaceId,
                changes: { ...rest, dueDate: dueDate.toISOString(), ...time },
                note: requestNote.trim() || undefined,
            }, {
                onSuccess: () => {
                    form.reset();
                    setRequestNote("");
                    setSubmitAttempted(false);
                    onCancel?.();
                },
                onError: () => setSubmitAttempted(false),
            });
            return;
        }

        mutate({ json: {
            ...rest,
            workspaceId,
            dueDate,
            ...time,
        } }, {
            onSuccess: () => {
                form.reset();
                setSubmitAttempted(false);
                onCancel?.();
            },
            onError: () => {
                setSubmitAttempted(false);
            }
        });
    };

    const isFieldEmpty = (fieldName: FieldName) => {
        const value = form.getValues(fieldName);
        return !value || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);
    };

    // trackEmpty enables the amber "empty" highlight (text, date and number inputs only)
    const getFieldState = (fieldName: FieldName, trackEmpty = false): FieldState => {
        const hasFieldError = !!form.formState.errors[fieldName];
        const isEmpty = isFieldEmpty(fieldName);
        const { isDirty } = form.formState;
        return {
            hasError: submitAttempted && (hasFieldError || isEmpty),
            isEmpty: trackEmpty && REQUIRED_FIELDS.includes(fieldName) && isEmpty && isDirty,
            isValid: !hasFieldError && !isEmpty && isDirty,
        };
    };

    const getFormCompletion = () => {
        const completedFields = REQUIRED_FIELDS.filter((field) => !isFieldEmpty(field));
        return Math.round((completedFields.length / REQUIRED_FIELDS.length) * 100);
    };

    const isFormReady = () => {
        const { errors } = form.formState;
        const hasRequiredErrors = REQUIRED_FIELDS.some((field) => errors[field]);
        return !hasRequiredErrors && getFormCompletion() === 100;
    };

    return (
        <Card className="w-full h-full border-none shadow-none transition-unified">
            <CardHeader className="flex flex-col p-4 sm:p-7 space-unified-sm">
                <div className="flex items-center justify-between w-full">
                    <CardTitle className="text-lg sm:text-xl font-bold">
                        {asRequest ? "Request a new task" : "Create a new task"}
                    </CardTitle>
                </div>
                {asRequest && (
                    <p className="text-sm text-muted-foreground">An admin or supervisor approves it before it&apos;s added.</p>
                )}
                <div className="w-full bg-muted rounded-full h-2">
                    <div
                        className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
                        style={{ width: `${getFormCompletion()}%` }}
                    />
                </div>
            </CardHeader>
            <div className="px-4 sm:px-7">
                <DottedSeparator />
            </div>
            <CardContent className="p-4 sm:p-7">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        {mutationError && (
                            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive">
                                <XCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">
                                    Failed to create task. Please try again.
                                </span>
                            </div>
                        )}

                        {submitAttempted && Object.keys(form.formState.errors).length > 0 && (
                            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                                <div className="flex items-center gap-2 text-destructive mb-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="text-sm font-medium">Please fix the following errors:</span>
                                </div>
                                <ul className="text-sm text-destructive space-y-1">
                                    {Object.entries(form.formState.errors).map(([field, error]) => (
                                        <li key={field} className="flex items-center gap-2">
                                            <span className="w-1 h-1 bg-destructive rounded-full"></span>
                                            {error?.message}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {!submitAttempted && getFormCompletion() < 100 && (
                            <div className="mb-4 rounded-xl border border-primary/20 bg-accent p-3">
                                <div className="flex items-center gap-2 text-accent-foreground">
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="text-sm font-medium">
                                        Complete the required fields marked with * to create your task
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-y-4 sm:gap-y-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => {
                                    const state = getFieldState("name", true);
                                    return (
                                        <FormItem>
                                            <RequiredLabel state={state}>Task Name</RequiredLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="Enter task name"
                                                    className={fieldStateClassName(state)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
                            />

                            <FormField
                                control={form.control}
                                name="dueDate"
                                render={({ field }) => {
                                    const state = getFieldState("dueDate", true);
                                    return (
                                        <FormItem>
                                            <RequiredLabel state={state}>Due Date</RequiredLabel>
                                            <FormControl>
                                                <SimpleDatePicker
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Select due date"
                                                    presets
                                                    hasError={state.hasError}
                                                    size="lg"
                                                />
                                            </FormControl>
                                            <HolidayNotice date={field.value} />
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
                            />

                            <TaskTimeFields />

                            <FormField
                                control={form.control}
                                name="assigneeIds"
                                render={({ field }) => {
                                    const state = getFieldState("assigneeIds");
                                    return (
                                        <FormItem>
                                            <RequiredLabel state={state}>Assignees</RequiredLabel>
                                            <AssigneePicker
                                                value={field.value}
                                                onChange={field.onChange}
                                                options={memberOptions}
                                                triggerClassName={fieldStateClassName(state)}
                                            />
                                        </FormItem>
                                    );
                                }}
                            />

                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => {
                                    const state = getFieldState("status");
                                    return (
                                        <FormItem>
                                            <RequiredLabel state={state}>Status</RequiredLabel>
                                            <TaskSelect
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="Select status"
                                                triggerClassName={fieldStateClassName(state)}
                                            >
                                                <StatusSelectItems />
                                            </TaskSelect>
                                        </FormItem>
                                    );
                                }}
                            />

                            <FormField
                                control={form.control}
                                name="projectId"
                                render={({ field }) => {
                                    const state = getFieldState("projectId");
                                    return (
                                        <FormItem>
                                            <RequiredLabel state={state}>Project</RequiredLabel>
                                            <TaskSelect
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="Select project"
                                                triggerClassName={fieldStateClassName(state)}
                                            >
                                                <ProjectSelectItems options={projectOptions} />
                                            </TaskSelect>
                                        </FormItem>
                                    );
                                }}
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
                                                placeholder="Enter task description (optional)"
                                                rows={3}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="storyPoints"
                                render={({ field }) => {
                                    const state = getFieldState("storyPoints", true);
                                    return (
                                        <FormItem>
                                            <RequiredLabel state={state}>
                                                <TargetIcon className="h-4 w-4 text-primary" />
                                                Story Points
                                            </RequiredLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    placeholder="Enter story points"
                                                    className={fieldStateClassName(state)}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        field.onChange(value === "" ? 1 : Number(value));
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
                            />
                        </div>

                        {asRequest && (
                            <Input
                                className="mt-4"
                                value={requestNote}
                                onChange={(e) => setRequestNote(e.target.value)}
                                placeholder="Why? (optional note for the reviewer)"
                                maxLength={1000}
                                aria-label="Note for the reviewer"
                            />
                        )}

                        <TaskFormFooter onCancel={onCancel} isPending={isPending}>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                {submitAttempted && isFormReady() && (
                                    <div className="flex items-center gap-2 text-green-600 text-sm">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>Ready to create</span>
                                    </div>
                                )}
                                {submitAttempted && !isFormReady() && (
                                    <div className="flex items-center gap-2 text-amber-600 text-sm">
                                        <AlertCircle className="h-4 w-4" />
                                        <span>Complete required fields</span>
                                    </div>
                                )}
                                <Button
                                    type="submit"
                                    size="lg"
                                    disabled={isPending}
                                    className={cn(
                                        "w-full sm:w-auto min-h-[44px] text-sm sm:text-base transition-all duration-200",
                                        isFormReady() && "bg-green-600 hover:bg-green-700"
                                    )}
                                >
                                    {asRequest
                                        ? isPending ? "Sending..." : "Send request"
                                        : isPending ? "Creating..." : "Create Task"}
                                </Button>
                            </div>
                        </TaskFormFooter>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};
