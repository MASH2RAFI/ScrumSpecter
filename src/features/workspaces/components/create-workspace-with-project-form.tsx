"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createWorkspaceWithProjectSchema } from "../schemas";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SimpleDatePicker } from "@/components/simple-date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateWorkspaceWithProject } from "../api/use-create-workspace-with-project";
import { cn } from "@/lib/utils";
import { TargetIcon, UserPlus, Plus } from "lucide-react";
import { formatDateDDMMYYYY, convertDDMMYYYYToDate, convertDateToDDMMYYYY } from "@/lib/sprint-utils";
import { toast } from "sonner";

interface CreateWorkspaceWithProjectFormProps {
    onCancel?: () => void;
};

export const CreateWorkspaceWithProjectForm = ({ onCancel }: CreateWorkspaceWithProjectFormProps) => {
    const { mutate, isPending } = useCreateWorkspaceWithProject();
    const router = useRouter();
    const [inviteLink, setInviteLink] = useState("");
    const [isJoining, setIsJoining] = useState(false);
    
    const form = useForm<z.infer<typeof createWorkspaceWithProjectSchema>>({
        resolver: zodResolver(createWorkspaceWithProjectSchema),
        defaultValues: {
            workspaceName: "",
            projectName: "",
            sprintDuration: 14,
            startingSprintDate: formatDateDDMMYYYY(new Date()),
        },
    });

    const onSubmit = (values: z.infer<typeof createWorkspaceWithProjectSchema>) => {
        mutate({ form: values });
    };

    const handleJoinWorkspace = async () => {
        if (!inviteLink.trim()) {
            toast.error("Please enter an invite link");
            return;
        }

        setIsJoining(true);
        try {
            // Extract workspace ID and invite code from the full invite link
            // Expected format: /workspaces/{workspaceId}/join/{inviteCode}
            const parts = inviteLink.trim().split('/');
            const workspaceIdIndex = parts.findIndex(part => part === 'workspaces') + 1;
            const joinIndex = parts.findIndex(part => part === 'join') + 1;
            
            if (workspaceIdIndex < parts.length && joinIndex < parts.length) {
                const workspaceId = parts[workspaceIdIndex];
                const code = parts[joinIndex];
                
                // Make API call to join workspace
                const response = await fetch(`/api/workspaces/${workspaceId}/join`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ code }),
                });

                if (response.ok) {
                    const result = await response.json();
                    toast.success("Successfully joined workspace!");
                    router.push(`/workspaces/${result.data.$id}`);
                } else {
                    const error = await response.json();
                    toast.error(error.error || "Failed to join workspace");
                }
            } else {
                toast.error("Invalid invite link format. Please use the full invite link.");
            }
        } catch (error) {
            console.error("Error joining workspace:", error);
            toast.error("Failed to join workspace. Please try again.");
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <Card className="w-full max-w-2xl mx-auto border-0 shadow-2xl bg-gradient-to-br from-background to-muted/10">
            <CardHeader className="text-center p-10">
                <div className="mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-primary to-primary/80 mb-6">
                        <TargetIcon className="h-8 w-8 text-primary-foreground" />
                    </div>
                </div>
                <CardTitle className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    Get Started with ScrumSpecter
                </CardTitle>
                <p className="text-muted-foreground text-lg">
                    Create your own workspace or join an existing one
                </p>
            </CardHeader>
            <CardContent className="p-10 pt-0">
                <Tabs defaultValue="create" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/30">
                        <TabsTrigger 
                            value="create" 
                            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200"
                        >
                            <Plus className="h-4 w-4" />
                            Create Workspace
                        </TabsTrigger>
                        <TabsTrigger 
                            value="join" 
                            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200"
                        >
                            <UserPlus className="h-4 w-4" />
                            Join Workspace
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="create" className="space-y-6">
                        <Form {...form}> 
                            <form onSubmit={form.handleSubmit(onSubmit)}> 
                                <div className="flex flex-col gap-y-6">
                                    <FormField
                                        control={form.control} 
                                        name="workspaceName" 
                                        render={({ field }) => 
                                            <FormItem> 
                                                <FormLabel> 
                                                    Workspace Name
                                                </FormLabel> 
                                                <FormControl>
                                                    <Input 
                                                        {...field}                                        
                                                        placeholder="Enter workspace name"
                                                        className="h-12 border-2 focus:border-primary/50 transition-colors duration-200"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem> 
                                        }
                                    />
                                    
                                    <FormField
                                        control={form.control} 
                                        name="projectName" 
                                        render={({ field }) => 
                                            <FormItem> 
                                                <FormLabel> 
                                                    Project Name
                                                </FormLabel> 
                                                <FormControl>
                                                    <Input 
                                                        {...field}                                        
                                                        placeholder="Enter project name"
                                                        className="h-12 border-2 focus:border-primary/50 transition-colors duration-200"
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
                                                                max="365"
                                                                placeholder="30"
                                                                className="h-12 border-2 focus:border-primary/50 transition-colors duration-200"
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
                                <div className="mt-8 pt-8 border-t border-border/50">
                                    <div className="flex items-center justify-between">
                                        <Button
                                            type="button"
                                            size="lg"
                                            variant="outline"
                                            onClick={onCancel}
                                            disabled={isPending}
                                            className={cn(!onCancel && "invisible", "border-2 hover:bg-muted/50 transition-all duration-200")}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            size="lg"
                                            disabled={isPending}
                                            className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
                                        >
                                            {isPending ? "Creating..." : "Create Workspace & Project"}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </Form>
                    </TabsContent>

                    <TabsContent value="join" className="space-y-6">
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-primary/20 to-primary/10 mb-4">
                                    <UserPlus className="h-6 w-6 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold">Join an Existing Workspace</h3>
                                <p className="text-muted-foreground">
                                    Enter the invite link you received to join a workspace
                                </p>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        Invite Link
                                    </label>
                                    <Input
                                        value={inviteLink}
                                        onChange={(e) => setInviteLink(e.target.value)}
                                        placeholder="Paste the invite link here..."
                                        className="h-12 border-2 focus:border-primary/50 transition-colors duration-200"
                                    />
                                    <p className="text-xs text-muted-foreground mt-2">
                                        The invite link should look like: /workspaces/.../join/...
                                    </p>
                                </div>
                            </div>
                            
                            <div className="pt-6 border-t border-border/50">
                                <div className="flex items-center justify-between">
                                    <Button
                                        type="button"
                                        size="lg"
                                        variant="outline"
                                        onClick={onCancel}
                                        disabled={isJoining}
                                        className={cn(!onCancel && "invisible", "border-2 hover:bg-muted/50 transition-all duration-200")}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        size="lg"
                                        onClick={handleJoinWorkspace}
                                        disabled={isJoining || !inviteLink.trim()}
                                        className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
                                    >
                                        {isJoining ? "Joining..." : "Join Workspace"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};
