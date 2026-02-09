"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateProjectSchema } from "../schemas";

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
import { Button } from "@/components/ui/button";
import { SimpleDatePicker } from "@/components/simple-date-picker";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Project } from "../types";
import { ArrowLeftIcon, TargetIcon, CalendarIcon } from "lucide-react";
import { useUpdateProject } from "../api/use-update-project";
import { useConfirm } from "@/hooks/use-confirm";
import { useDeleteProject } from "../api/use-delete-project";
import { toast } from "sonner";
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { calculateSprintEndDate, convertDDMMYYYYToDate, convertDDMMYYYYToYYYYMMDD, convertDateToDDMMYYYY, formatDateDDMMYYYY } from "@/lib/sprint-utils";

interface EditProjectFormProps {
    onCancel?: () => void;
    initialValues: Project;
};

export const EditProjectForm = ({ onCancel,initialValues }: EditProjectFormProps) => {
    const router = useRouter();
    const { mutate, isPending } = useUpdateProject();
    const { 
        mutate: deleteProject,
        isPending: isDeletingProject
    } = useDeleteProject();
    const { isAdmin } = useIsAdmin({ workspaceId: initialValues.workspaceId });


    const [DeleteDialog, confirmDelete] = useConfirm(
        "Delete Project",
        "This action cannot be undone." ,
        "destructive",
    );

    const form = useForm<z.infer<typeof updateProjectSchema>>({
        resolver: zodResolver(updateProjectSchema),
        defaultValues: {
            ...initialValues,
            currentSprintStartDate: initialValues.currentSprintStartDate || '', 
            sprintDuration: initialValues.sprintDuration || undefined,
            sprintNumber: initialValues.sprintNumber || 1,
        },
    });

    const handleDelete = async () => {
        const ok = await confirmDelete();
        if (!ok) return;
        
        deleteProject({
            param: { projectId: initialValues.$id },
        }, {
            onSuccess: () => {
                router.push(`/workspaces/${initialValues.workspaceId}`);
            },
        });
    };


    const onSubmit = (values: z.infer<typeof updateProjectSchema>) => {
        const startDateString = convertDDMMYYYYToYYYYMMDD(values.currentSprintStartDate || formatDateDDMMYYYY(new Date()));
        const startDate = new Date(startDateString);
        const endDate = calculateSprintEndDate(startDate, values.sprintDuration || 30);
        const finalValues = {
            ...values,
            workspaceId: initialValues.workspaceId, // Include workspaceId
            sprintDuration: values.sprintDuration?.toString(),
            sprintNumber: initialValues.sprintNumber?.toString() || "1",
            currentSprintStartDate: values.currentSprintStartDate || undefined,
            currentSprintEndDate:endDate.toISOString().split('T')[0] || undefined
        }
        
        mutate({ 
            form: finalValues,
            param: { projectId: initialValues.$id } 
        }, {
            onSuccess: () => {
                toast.success('Project updated successfully');
            },
            onError: () => {
                toast.error('Failed to update project');
            }
        });
    };

    return (
        <div className="flex flex-col gap-y-4">
            <DeleteDialog />
            <Card className="w-full h-full border-none shadow-none">
                <CardHeader className="flex flex-row items-center gap-x-4 p-7 space-y-0">

                    <Button size="sm" variant="secondary" onClick={onCancel ? onCancel: () => router.push(`/workspaces/${initialValues.workspaceId}/projects/${initialValues.$id}`)}>
                        <ArrowLeftIcon className="size-4 mr-2" /> 
                            Back
                    </Button>

                    <CardTitle className="text-xl font-bold">
                        {initialValues.name}
                    </CardTitle>
                </CardHeader>
                <div className="px-7">
                    <DottedSeparator />
                </div> 
                <CardContent className="p-7">
                    <Form {...form}> 
                        <form onSubmit={form.handleSubmit(onSubmit)}> 
                            <div className="flex flex-col gap-y-4">
                                {isAdmin && (
                                    <FormField
                                        control={form.control} 
                                        name="name" 
                                        render={({ field }) => 
                                            <FormItem> 
                                                <FormLabel> 
                                                    Project Name
                                                </FormLabel> 
                                                <FormControl>
                                                    <Input 
                                                        {...field}                                        
                                                        placeholder="Enter project name"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem> 
                                        }
                                    />
                                )}

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <TargetIcon className="h-4 w-4 text-primary" />
                                        <h3 className="text-sm font-medium">Sprint Settings</h3>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {isAdmin && (
                                            <FormField
                                                control={form.control} 
                                                name="sprintDuration" 
                                                render={({ field }) => 
                                                    <FormItem>
                                                        <FormLabel> 
                                                            Sprint Duration (days)
                                                        </FormLabel> 
                                                        <FormControl>
                                                            <Input 
                                                                {...field}
                                                                type="number"
                                                                min="1"
                                                                max="365"
                                                                placeholder="30"
                                                                value={field.value || ''}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    field.onChange(value === '' ? undefined : Number(value));
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem> 
                                                }
                                            />
                                        )}
                                        {isAdmin && (
                                            <FormField
                                                control={form.control} 
                                                name="currentSprintStartDate" 
                                                render={({ field }) => 
                                                    <FormItem> 
                                                        <FormLabel className="flex items-center gap-2">
                                                            <CalendarIcon className="h-4 w-4" />
                                                            Starting Sprint Date
                                                        </FormLabel> 
                                                        <FormControl>
                                                            <SimpleDatePicker 
                                                                value={field.value && field.value.trim() !== '' ? convertDDMMYYYYToDate(field.value) : undefined}
                                                                onChange={(date) => {
                                                                    if (date) {
                                                                        const formattedDate = convertDateToDDMMYYYY(date);
                                                                        field.onChange(formattedDate);
                                                                    } else {
                                                                        field.onChange('');
                                                                    }
                                                                }}
                                                                placeholder="Select starting date"
                                                                size="lg"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem> 
                                                }
                                            />
                                        )}
                                    </div>
                                </div>
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
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </Form>        
                                
                </CardContent>
            </Card>

            <Card className="w-full h-full border-none shadow-none">
                <CardContent className="p-7">
                    <div className="flex flex-col">
                        <h3 className="font-bold">Danger Zone</h3>
                        <p className="text-sm text-muted-foreground">
                            Deleting a project is irreversible and will remove all associated data
                        </p>
                        <DottedSeparator className="py-7"/>
                        {isAdmin && (
                            <Button
                                className="mt-6 w-fit ml-auto" 
                                size="sm" 
                                variant="destructive"
                                type="button"
                                disabled={ isPending || isDeletingProject}
                                onClick={ handleDelete }
                            > 
                                Delete Project 
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
        
    )
};
