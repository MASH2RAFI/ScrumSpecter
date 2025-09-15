"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";


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
import { cn } from "@/lib/utils";
import { SimpleDatePicker } from "@/components/simple-date-picker";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { Task, TaskStatus } from "../types";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useUpdateTask } from "../api/use-update-task";
import { TargetIcon } from "lucide-react";
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

interface EditTaskFormProps {
    onCancel?: () => void;
    projectOptions: { id: string, name: string }[];
    memberOptions: { id: string, name: string }[];
    initialValues: Task;
};

export const EditTaskForm = ({ onCancel, projectOptions, memberOptions, initialValues }: EditTaskFormProps) => {
    const workspaceId = useWorkspaceId();
    const { isAdmin } = useIsAdmin({ workspaceId });
    const { mutate, isPending } = useUpdateTask();
    const formSchema = z.object({
        name: z.string().trim().min(1, "Required"),
        status: z.nativeEnum(TaskStatus, { error: "Required" }),
        projectId: z.string().trim().min(1, "Required"),
        dueDate: z.date().optional(),
        assigneeId: z.string().trim().min(1, "Required"),
        description: z.string().optional(),
        storyPoints: z.number().min(0, "Story points cannot be negative").max(100, "Story points cannot exceed 100").optional(),
    });
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: initialValues.name,
            status: initialValues.status,
            projectId: initialValues.projectId,
            dueDate: initialValues.dueDate ? new Date(initialValues.dueDate) : undefined,
            assigneeId: initialValues.assigneeId || "",
            description: initialValues.description || "",
            storyPoints: initialValues.storyPoints,
        },
    });

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        mutate({ json: values, param: { taskId: initialValues.$id } }, {
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
                                render={({ field }) => 
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
                                }
                            />

                            <FormField
                                control={form.control} 
                                name="description" 
                                render={({ field }) => 
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
                                }
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

                            <FormField
                                control={form.control} 
                                name="assigneeId" 
                                render={({ field }) => (
                                    <FormItem> 
                                        <FormLabel> 
                                            Assignee
                                        </FormLabel> 

                                        <Select
                                            defaultValue={field.value}
                                            onValueChange={field.onChange}
                                            disabled={!isAdmin}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
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

                                        <Select
                                            defaultValue={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
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

                                        <Select
                                            defaultValue={field.value}
                                            onValueChange={field.onChange}
                                            disabled={!isAdmin}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
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
                                                min="0"
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
                            <Button
                                type="submit"
                                size="lg"
                                disabled={isPending}
                            >
                                Save changes
                                
                            </Button>
                        </div>
                    </form>
                </Form>        
                            
            </CardContent>
        </Card>
    )
};
