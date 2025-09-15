"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProjectSchema } from "../schemas";

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
import { useCreateProject } from "../api/use-create-project";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { TargetIcon } from "lucide-react";
import { calculateSprintEndDate, formatDateDDMMYYYY, convertDDMMYYYYToYYYYMMDD, convertDDMMYYYYToDate, convertDateToDDMMYYYY } from "@/lib/sprint-utils";

interface CreateProjectFormProps {
    onCancel?: () => void;
};

export const CreateProjectForm = ({ onCancel }: CreateProjectFormProps) => {
    const workspaceId = useWorkspaceId();
    const router = useRouter();
    const { mutate, isPending } = useCreateProject();
    const formSchema = createProjectSchema.omit({ workspaceId: true });
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            sprintDuration: 14,
            startingSprintDate: formatDateDDMMYYYY(new Date()),
        },
    });

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        // Convert DD/MM/YYYY to YYYY-MM-DD for calculations
        const startDateString = convertDDMMYYYYToYYYYMMDD(values.startingSprintDate || formatDateDDMMYYYY(new Date()));
        const startDate = new Date(startDateString);
        const endDate = calculateSprintEndDate(startDate, values.sprintDuration || 14);
        
        const finalValues = {
            ...values,
            workspaceId,
            sprintDuration: values.sprintDuration?.toString(),
            sprintNumber: "1",
            currentSprintStartDate: startDateString,
            currentSprintEndDate: endDate.toISOString().split('T')[0]
        }
        mutate({ form: finalValues }, {
            onSuccess: ({ data }) => {
                form.reset();
                router.push(`/workspaces/${workspaceId}/projects/${data.$id}`);
            }
        });
    };

    return (
        <Card className="w-full h—full border-none shadow-none">
            <CardHeader className="flex p-7">
                <CardTitle className="text-x1 font-bold">
                    Create a new project
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
                            
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <TargetIcon className="h-4 w-4 text-primary" />
                                    <h3 className="text-sm font-medium">Sprint Settings</h3>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                        max="30"
                                                        placeholder="14"
                                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem> 
                                        }
                                    />
                                    
                                    <FormField
                                        control={form.control} 
                                        name="startingSprintDate" 
                                        render={({ field }) => 
                                            <FormItem> 
                                                <FormControl>
                                                    <SimpleDatePicker 
                                                        value={field.value ? new Date(convertDDMMYYYYToDate(field.value)) : undefined}
                                                        onChange={(date) => {
                                                            if (date) {
                                                                const formattedDate = convertDateToDDMMYYYY(date);
                                                                field.onChange(formattedDate);
                                                            } else {
                                                                field.onChange('');
                                                            }
                                                        }}
                                                        label="Starting Sprint Date"
                                                        placeholder="Select starting date"
                                                        size="lg"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem> 
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                        <DottedSeparator className="py-7" />
                        <div className="flex items—center justify-between">
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
                                Create Project
                            </Button>
                        </div>
                    </form>
                </Form>        
                            
            </CardContent>
        </Card>
    )
};
