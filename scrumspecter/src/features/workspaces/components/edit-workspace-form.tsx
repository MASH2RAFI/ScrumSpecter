"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateWorkspaceSchema } from "../schemas";

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
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Workspace } from "../types";
import { ArrowLeftIcon } from "lucide-react";
import { useUpdateWorkspace } from "../api/use-update-workspace";
import { useConfirm } from "@/hooks/use-confirm";
import { useDeleteWorkspace } from "../api/use-delete-workspace";

interface EditWorkspaceFormProps {
    onCancel?: () => void;
    initialValues: Workspace;
};

export const EditWorkspaceForm = ({ onCancel,initialValues }: EditWorkspaceFormProps) => {
    const router = useRouter();
    const { mutate, isPending } = useUpdateWorkspace();
    const { 
        mutate: deleteWorkspace,
        isPending: isDeletingWorkspace
    } = useDeleteWorkspace();

    const [DeleteDialog, confirmDelete] = useConfirm(
        "Delete Workspace",
        "This action cannot be undone." ,
        "destructive",
    );

    const form = useForm<z.infer<typeof updateWorkspaceSchema>>({
        resolver: zodResolver(updateWorkspaceSchema),
        defaultValues: {
            ...initialValues    
        },
    });

    const handleDelete = async () => {
        const ok = await confirmDelete();
        if (!ok) return;
        
        deleteWorkspace({
            param: { workspaceId: initialValues.$id },
        }, {
            onSuccess: () => {
                router.push("/");
            },
        });
    };

    const onSubmit = (values: z.infer<typeof updateWorkspaceSchema>) => {
        const finalValues = {
            ...values
        }
        mutate({ 
            form: finalValues,
            param: { workspaceId: initialValues.$id } 
        }, {
            onSuccess: ({ data }) => {
                form.reset();
                router.push(`/workspaces/${data.$id}`);
            }
        });
    };

    return (
        <div className="flex flex-col gap-y-4">
            <DeleteDialog />
            <Card className="w-full h-full border-none shadow-none">
                <CardHeader className="flex flex-row items-center gap-x-4 p-7 space-y-0">

                    <Button size="sm" variant="secondary" onClick={onCancel ? onCancel: () => router.push(`/workspaces/${initialValues. $id}`)}>
                        <ArrowLeftIcon className="size-4 mr-2" /> 
                            Back
                    </Button>

                    <CardTitle className="text-x1 font-bold">
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
                                <FormField
                                    control={form.control} 
                                    name="name" 
                                    render={({ field }) => 
                                        <FormItem> 
                                            <FormLabel> 
                                                Workspace 
                                            </FormLabel> 
                                            <FormControl>
                                                <Input 
                                                    {...field}                                        
                                                    placeholder="Enter workspace name"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem> 
                                    }
                            
                                />                
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
                        <p className="text-sm text-muted—foreground">
                            Deleting a workspace is irreversible and will remove all associated Data
                        </p>
                        <Button
                            className="mt-6 w-fit ml-auto" 
                            size="sm" 
                            variant="destructive"
                            type="button"
                            disabled={isPending}
                            onClick={ handleDelete }
                        > 
                            Delete Workspace 
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
        
    )
};
