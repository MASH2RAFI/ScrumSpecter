"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { SprintDateField, SprintSettings, TextInputField } from "@/features/projects/components/project-form-fields";
import { addDaysDDMMYYYY, formatDateDDMMYYYY } from "@/lib/sprint-utils";

import { createWorkspaceWithProjectSchema } from "../schemas";
import { useCreateWorkspaceWithProject } from "../api/use-create-workspace-with-project";

type FormValues = z.infer<typeof createWorkspaceWithProjectSchema>;

interface CreateWorkspaceWithProjectFormProps {
    onCancel?: () => void;
};

// A new workspace together with its first project (the getting-started page's Create tab and
// the sidebar's "new workspace" popup). Joining one lives in JoinByLinkForm.
export const CreateWorkspaceWithProjectForm = ({ onCancel }: CreateWorkspaceWithProjectFormProps) => {
    const { mutate, isPending } = useCreateWorkspaceWithProject();

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

    return (
        <Card className="w-full">
            <CardHeader className="p-7 pb-0">
                <CardTitle className="text-xl font-bold">Create a workspace</CardTitle>
                <p className="text-sm text-muted-foreground">Name it, then set up its first project and sprint.</p>
            </CardHeader>
            <CardContent className="p-7">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <div className="flex flex-col gap-y-6">
                            <TextInputField
                                control={form.control}
                                name="workspaceName"
                                label="Workspace Name"
                                placeholder="Enter workspace name"
                            />
                            <TextInputField
                                control={form.control}
                                name="projectName"
                                label="Project Name"
                                placeholder="Enter project name"
                            />
                            <SprintSettings>
                                <SprintDateField control={form.control} name="currentSprintStartDate" label="Sprint Start Date" />
                                <SprintDateField control={form.control} name="currentSprintEndDate" label="Sprint End Date" />
                            </SprintSettings>
                        </div>
                        <div className="mt-7 flex items-center justify-between gap-2 border-t border-border/60 pt-6">
                            {onCancel ? (
                                <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
                            ) : <span />}
                            <Button type="submit" size="lg" disabled={isPending}>
                                {isPending ? "Creating..." : "Create"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};
