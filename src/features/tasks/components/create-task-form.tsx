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
import { TargetIcon, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

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
        status: z.nativeEnum(TaskStatus, { message: "Please select a status" }),
        projectId: z.string().trim().min(1, "Please select a project"),
        dueDate: z.date({ message: "Due date is required" }),
        assigneeId: z.string().trim().min(1, "Please select an assignee"),
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
            dueDate: new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0)),
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
        
        // Focus on first error field if validation fails
        const errors = form.formState.errors;
        if (Object.keys(errors).length > 0) {
            const firstErrorField = Object.keys(errors)[0];
            const errorElement = document.querySelector(`[name="${firstErrorField}"]`) as HTMLInputElement | HTMLSelectElement;
            if (errorElement) {
                errorElement.focus();
                errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }
        
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

    // Check if field should be highlighted as empty (even before submit)
    const shouldHighlightEmpty = (fieldName: keyof z.infer<typeof formSchema>) => {
        const isEmpty = isFieldEmpty(fieldName);
        const isRequired = ['name', 'status', 'projectId', 'assigneeId', 'storyPoints', 'dueDate'].includes(fieldName);
        return isRequired && isEmpty && form.formState.isDirty;
    };

    // Check if field is valid
    const isFieldValid = (fieldName: keyof z.infer<typeof formSchema>) => {
        const hasError = getFieldError(fieldName);
        const isEmpty = isFieldEmpty(fieldName);
        return !hasError && !isEmpty && form.formState.isDirty;
    };

    // Calculate form completion percentage
    const getFormCompletion = () => {
        const requiredFields = ['name', 'status', 'projectId', 'assigneeId', 'storyPoints', 'dueDate'];
        const completedFields = requiredFields.filter(field => {
            const value = form.getValues(field as keyof z.infer<typeof formSchema>);
            return value && (typeof value !== 'string' || value.trim() !== '');
        });
        return Math.round((completedFields.length / requiredFields.length) * 100);
    };

    // Check if form is ready to submit
    const isFormReady = () => {
        const errors = form.formState.errors;
        const requiredFields = ['name', 'status', 'projectId', 'assigneeId', 'storyPoints', 'dueDate'];
        const hasRequiredErrors = requiredFields.some(field => errors[field as keyof typeof errors]);
        return !hasRequiredErrors && getFormCompletion() === 100;
    };

    return (
        <Card className="w-full h-full border-none shadow-none transition-unified">
            <CardHeader className="flex flex-col p-4 sm:p-7 space-unified-sm">
                <div className="flex items-center justify-between w-full">
                    <CardTitle className="text-lg sm:text-xl font-bold">
                        Create a new task
                    </CardTitle>
                </div>
                {/* Progress bar */}
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
                        {/* Global Error Display */}
                        {mutationError && (
                            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive">
                                <XCircle className="h-4 w-4" />
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

                        {/* Form completion hint */}
                        {!submitAttempted && getFormCompletion() < 100 && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md dark:bg-blue-950/20 dark:border-blue-800">
                                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
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
                                    const hasError = shouldHighlightError("name");
                                    const isEmpty = shouldHighlightEmpty("name");
                                    const isValid = isFieldValid("name");
                                    return (
                                        <FormItem> 
                                            <FormLabel className="flex items-center gap-2">
                                                Task Name
                                                <span className="text-destructive">*</span>
                                                {hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
                                                {isEmpty && !hasError && <AlertCircle className="h-4 w-4 text-amber-500" />}
                                                {isValid && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                            </FormLabel> 
                                            <FormControl>
                                                <Input 
                                                    {...field}                                        
                                                    placeholder="Enter task name"
                                                    className={cn(
                                                        hasError && "border-destructive focus:border-destructive focus:ring-destructive/20",
                                                        isEmpty && !hasError && "border-amber-400 focus:border-amber-400 focus:ring-amber-400/20",
                                                        isValid && "border-green-500 focus:border-green-500 focus:ring-green-500/20"
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
                                    const hasError = shouldHighlightError("dueDate");
                                    const isEmpty = shouldHighlightEmpty("dueDate");
                                    const isValid = isFieldValid("dueDate");
                                    return (
                                        <FormItem> 
                                            <FormLabel className="flex items-center gap-2">
                                                Due Date
                                                <span className="text-destructive">*</span>
                                                {hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
                                                {isEmpty && !hasError && <AlertCircle className="h-4 w-4 text-amber-500" />}
                                                {isValid && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                            </FormLabel>
                                            <FormControl>
                                                <SimpleDatePicker 
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Select due date"
                                                    hasError={!!hasError}
                                                    size="lg"
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
                                    const isValid = isFieldValid("assigneeId");
                                    return (
                                        <FormItem> 
                                            <FormLabel className="flex items-center gap-2">
                                                Assignee
                                                <span className="text-destructive">*</span>
                                                {hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
                                                {isValid && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                            </FormLabel> 

                                            <Select
                                                defaultValue={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className={cn(
                                                        hasError && "border-destructive focus:border-destructive focus:ring-destructive/20",
                                                        isValid && "border-green-500 focus:border-green-500 focus:ring-green-500/20"
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
                                    const isValid = isFieldValid("status");
                                    return (
                                        <FormItem> 
                                            <FormLabel className="flex items-center gap-2">
                                                Status
                                                <span className="text-destructive">*</span>
                                                {hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
                                                {isValid && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                            </FormLabel> 

                                            <Select
                                                defaultValue={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className={cn(
                                                        hasError && "border-destructive focus:border-destructive focus:ring-destructive/20",
                                                        isValid && "border-green-500 focus:border-green-500 focus:ring-green-500/20"
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
                                    const isValid = isFieldValid("projectId");
                                    return (
                                        <FormItem> 
                                            <FormLabel className="flex items-center gap-2">
                                                Project
                                                <span className="text-destructive">*</span>
                                                {hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
                                                {isValid && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                            </FormLabel> 

                                            <Select
                                                defaultValue={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className={cn(
                                                        hasError && "border-destructive focus:border-destructive focus:ring-destructive/20",
                                                        isValid && "border-green-500 focus:border-green-500 focus:ring-green-500/20"
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
                                    const isEmpty = shouldHighlightEmpty("storyPoints");
                                    const isValid = isFieldValid("storyPoints");
                                    return (
                                        <FormItem> 
                                            <FormLabel className="flex items-center gap-2">
                                                <TargetIcon className="h-4 w-4 text-primary" />
                                                Story Points
                                                <span className="text-destructive">*</span>
                                                {hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
                                                {isEmpty && !hasError && <AlertCircle className="h-4 w-4 text-amber-500" />}
                                                {isValid && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                            </FormLabel> 
                                            <FormControl>
                                                <Input 
                                                    {...field}
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    placeholder="Enter story points"
                                                    className={cn(
                                                        hasError && "border-destructive focus:border-destructive focus:ring-destructive/20",
                                                        isEmpty && !hasError && "border-amber-400 focus:border-amber-400 focus:ring-amber-400/20",
                                                        isValid && "border-green-500 focus:border-green-500 focus:ring-green-500/20"
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
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                {/* Form validation status indicator */}
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
