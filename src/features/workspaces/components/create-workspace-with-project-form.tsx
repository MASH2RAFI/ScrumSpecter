"use client";

import { z } from "zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { UserPlus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SprintDateField, SprintSettings, TextInputField } from "@/features/projects/components/project-form-fields";
import { addDaysDDMMYYYY, formatDateDDMMYYYY } from "@/lib/sprint-utils";

import { createWorkspaceWithProjectSchema } from "../schemas";
import { useCreateWorkspaceWithProject } from "../api/use-create-workspace-with-project";

const INPUT_CLASS_NAME = "h-12 border-2 focus:border-primary/50 transition-colors duration-200";
const SUBMIT_CLASS_NAME = "bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200";
const TAB_CLASS_NAME = "flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200";

type FormValues = z.infer<typeof createWorkspaceWithProjectSchema>;

interface CreateWorkspaceWithProjectFormProps {
    onCancel?: () => void;
};

export const CreateWorkspaceWithProjectForm = ({ }: CreateWorkspaceWithProjectFormProps) => {
    const { mutate, isPending } = useCreateWorkspaceWithProject();
    const router = useRouter();
    const [inviteLink, setInviteLink] = useState("");
    const [isJoining, setIsJoining] = useState(false);

    const today = formatDateDDMMYYYY(new Date());
    const form = useForm<FormValues>({
        resolver: zodResolver(createWorkspaceWithProjectSchema),
        defaultValues: {
            workspaceName: "",
            projectName: "",
            currentSprintStartDate: today,
            currentSprintEndDate: addDaysDDMMYYYY(today, 29),
        },
    });

    const onSubmit = (values: FormValues) => {
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
                const code = decodeURIComponent(parts[joinIndex]);
                
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
        <Card className="w-full h-[714px] max-w-2xl mx-auto border-0 shadow-2xl bg-gradient-to-br from-background to-muted/10">
            <CardHeader className="text-center p-10">
                <CardTitle className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    Get Started
                </CardTitle>
                <p className="text-muted-foreground text-lg">
                    Create your own workspace or join an existing one
                </p>
            </CardHeader>
            <CardContent className="p-10 pt-0">
                <Tabs defaultValue="create" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/30">
                        <TabsTrigger value="create" className={TAB_CLASS_NAME}>
                            <Plus className="h-4 w-4" />
                            Create Workspace
                        </TabsTrigger>
                        <TabsTrigger value="join" className={TAB_CLASS_NAME}>
                            <UserPlus className="h-4 w-4" />
                            Join Workspace
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="create" className="space-y-6">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)}>
                                <div className="flex flex-col gap-y-6">
                                    <TextInputField
                                        control={form.control}
                                        name="workspaceName"
                                        label="Workspace Name"
                                        placeholder="Enter workspace name"
                                        className={INPUT_CLASS_NAME}
                                    />
                                    <TextInputField
                                        control={form.control}
                                        name="projectName"
                                        label="Project Name"
                                        placeholder="Enter project name"
                                        className={INPUT_CLASS_NAME}
                                    />
                                    <SprintSettings>
                                        <SprintDateField control={form.control} name="currentSprintStartDate" label="Sprint Start Date" />
                                        <SprintDateField control={form.control} name="currentSprintEndDate" label="Sprint End Date" />
                                    </SprintSettings>
                                </div>
                                <div className="mt-8 pt-8 border-t border-border/50">
                                    <div className="flex items-center justify-between">
                                        <Button
                                            type="submit"
                                            size="lg"
                                            disabled={isPending}
                                            className={SUBMIT_CLASS_NAME}
                                        >
                                            {isPending ? "Creating..." : "Create"}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </Form>
                    </TabsContent>

                    <TabsContent value="join" className="space-y-6">
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        Invite Link
                                    </label>
                                    <Input
                                        value={inviteLink}
                                        onChange={(e) => setInviteLink(e.target.value)}
                                        placeholder="Paste the invite link here..."
                                        className={INPUT_CLASS_NAME}
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
                                        onClick={handleJoinWorkspace}
                                        disabled={isJoining || !inviteLink.trim()}
                                        className={SUBMIT_CLASS_NAME}
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
