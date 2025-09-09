"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";


import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { 
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
}from "@/components/ui/select";

import { DottedSeparator } from "@/components/dotted-separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCreateTask } from "../api/use-create-task";
import { cn } from "@/lib/utils";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { SimpleDatePicker } from "@/components/simple-date-picker";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { TaskStatus } from "../types";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { TargetIcon, AlertCircle, CheckCircle2 } from "lucide-react";

interface CreateTaskFormProps {
    onCancel?: () => void;
    projectOptions: { id: string, name: string }[];
    memberOptions: { id: string, name: string }[];
    defaultStatus?: TaskStatus;
};

export const CreateTaskForm = ({ onCancel, projectOptions, memberOptions, defaultStatus }: CreateTaskFormProps) => {
    const workspaceId = useWorkspaceId();
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const { mutate, isPending, error: mutationError } = useCreateTask();
    const formSchema = z.object({
        name: z.string().trim().min(1, "Task name is required"),
        status: z.nativeEnum(TaskStatus, { message: "Status is required" }),
        projectId: z.string().trim().min(1, "Project is required"),
        dueDate: z.date().optional(),
        assigneeId: z.string().trim().min(1, "Assignee is required"),
        description: z.string().optional(),
        storyPoints: z.number()
            .min(1, "Story points must be at least 1")
            .max(100, "Story points cannot exceed 100"),
    });
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        mode: "onChange", // Enable real-time validation
        defaultValues: {
            name: "",
            status: defaultStatus || TaskStatus.TODO,
            projectId: "",
            assigneeId: "",
            description: "",
            storyPoints: 1,
            dueDate: undefined,
        },
    });

    // Update form when defaultStatus changes
    useEffect(() => {
        if (defaultStatus) {
            form.setValue("status", defaultStatus);
        }
    }, [defaultStatus, form]);

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        setSubmitAttempted(true);
        mutate({ json: { ...values, workspaceId } }, {
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

    // Check if required fields are empty
    const isFieldEmpty = (fieldName: keyof z.infer<typeof formSchema>) => {
        const value = form.getValues(fieldName);
        return !value || (typeof value === 'string' && value.trim() === '');
    };

    // Get field error state
    const getFieldError = (fieldName: keyof z.infer<typeof formSchema>) => {
        return form.formState.errors[fieldName];
    };

    // Check if field should be highlighted as error
    const shouldHighlightError = (fieldName: keyof z.infer<typeof formSchema>) => {
        const hasError = getFieldError(fieldName);
        const isEmpty = isFieldEmpty(fieldName);
        return submitAttempted && (hasError || isEmpty);
    };

    return (
        <Card className="w-full h-full border-none shadow-none">
            <CardHeader className="flex p-7">
                <CardTitle className="text-xl font-bold">
                    Create a new task
                </CardTitle>
            </CardHeader>
            <div className="px-7">
                <DottedSeparator />
            </div> 
            <CardContent className="p-7">
                <Form {...form}> 
                    <form onSubmit={form.handleSubmit(onSubmit)}> 
                        {/* Global Error Display */}
                        {mutationError && (
                            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">
                                    Failed to create task. Please try again.
                                </span>
                            </div>
                        )}

                        {/* Form Validation Summary */}
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

                        <div className="flex flex-col gap-y-4">
                            <FormField
                                control={form.control} 
                                name="name" 
                                render={({ field }) => {
                                    const hasError = shouldHighlightError("name");
                                    return (
                                        <FormItem> 
                                            <FormLabel className="flex items-center gap-2">
                                                Task Name
                                                <span className="text-destructive">*</span>
                                                {hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
                                            </FormLabel> 
                                            <FormControl>
                                                <Input 
                                                    {...field}                                        
                                                    placeholder="Enter task name"
                                                    className={cn(
                                                        hasError && "border-destructive focus:border-destructive focus:ring-destructive/20"
                                                    )}
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
                                    const hasError = getFieldError("dueDate");
                                    return (
                                        <FormItem> 
                                            <FormControl>
                                                <SimpleDatePicker 
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    label="Due Date"
                                                    placeholder="Select due date"
                                                    hasError={!!hasError}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
                            />

                            <FormField
                                control={form.control} 
                                name="assigneeId" 
                                render={({ field }) => {
                                    const hasError = shouldHighlightError("assigneeId");
                                    return (
                                        <FormItem> 
                                            <FormLabel className="flex items-center gap-2">
                                                Assignee
                                                <span className="text-destructive">*</span>
                                                {hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
                                            </FormLabel> 

                                            <Select
                                                defaultValue={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className={cn(
                                                        hasError && "border-destructive focus:border-destructive focus:ring-destructive/20"
                                                    )}>
                                                        <SelectValue placeholder="Select assignee" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <FormMessage />
                                                <SelectContent>
                                                    {memberOptions.map( (member) => (
                                                        <SelectItem key={member.id} value={member.id}>
                                                            <div className="flex items-center gap-x-2">
                                                                <MemberAvatar
                                                                    className="size-6"
                                                                    name={member.name}
                                                                />
                                                                {member.name}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    );
                                }}
                            />

                            <FormField
                                control={form.control} 
                                name="status" 
                                render={({ field }) => {
                                    const hasError = shouldHighlightError("status");
                                    return (
                                        <FormItem> 
                                            <FormLabel className="flex items-center gap-2">
                                                Status
                                                <span className="text-destructive">*</span>
                                                {hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
                                            </FormLabel> 

                                            <Select
                                                defaultValue={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className={cn(
                                                        hasError && "border-destructive focus:border-destructive focus:ring-destructive/20"
                                                    )}>
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <FormMessage />
                                                <SelectContent>
                                                    <SelectItem value={TaskStatus.BACKLOG}>
                                                        Backlog
                                                    </SelectItem>
                                                    <SelectItem value={TaskStatus.IN_PROGRESS}>
                                                        In Progress
                                                    </SelectItem>
                                                    <SelectItem value={TaskStatus.IN_REVIEW}>
                                                        In Review
                                                    </SelectItem>
                                                    <SelectItem value={TaskStatus.TODO}>
                                                        Todo
                                                    </SelectItem>
                                                    <SelectItem value={TaskStatus.DONE}>
                                                        Done
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    );
                                }}
                            />

                            
                            <FormField
                                control={form.control} 
                                name="projectId" 
                                render={({ field }) => {
                                    const hasError = shouldHighlightError("projectId");
                                    return (
                                        <FormItem> 
                                            <FormLabel className="flex items-center gap-2">
                                                Project
                                                <span className="text-destructive">*</span>
                                                {hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
                                            </FormLabel> 

                                            <Select
                                                defaultValue={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className={cn(
                                                        hasError && "border-destructive focus:border-destructive focus:ring-destructive/20"
                                                    )}>
                                                        <SelectValue placeholder="Select project" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <FormMessage />
                                                <SelectContent>
                                                    {projectOptions.map( (project) => (
                                                        <SelectItem key={project.id} value={project.id}>
                                                            <div className="flex items-center gap-x-2">
                                                                <ProjectAvatar
                                                                    className="size-6"
                                                                    name={project.name}
                                                                />
                                                                {project.name}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
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
                                    const hasError = shouldHighlightError("storyPoints");
                                    return (
                                        <FormItem> 
                                            <FormLabel className="flex items-center gap-2">
                                                <TargetIcon className="h-4 w-4 text-primary" />
                                                Story Points
                                                <span className="text-destructive">*</span>
                                                {hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
                                            </FormLabel> 
                                            <FormControl>
                                                <Input 
                                                    {...field}
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    placeholder="Enter story points"
                                                    className={cn(
                                                        hasError && "border-destructive focus:border-destructive focus:ring-destructive/20"
                                                    )}
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

                        <DottedSeparator className="py-7" />
                        <div className="flex items-center justify-between">
                            <Button
                                type="button"
                                size="lg"
                                variant="secondary"
                                onClick={onCancel}
                                disabled={isPending}
                                className={cn(!onCancel && "invisible")}
                            >
                                Cancel
                            </Button>
                            <div className="flex items-center gap-3">
                                {/* Form validation status indicator */}
                                {submitAttempted && Object.keys(form.formState.errors).length === 0 && (
                                    <div className="flex items-center gap-2 text-green-600 text-sm">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>All fields valid</span>
                                    </div>
                                )}
                                <Button
                                    type="submit"
                                    size="lg"
                                    disabled={isPending}
                                    className="min-w-[120px]"
                                >
                                    {isPending ? "Creating..." : "Create Task"}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>        
                            
            </CardContent>
        </Card>
    )
};
