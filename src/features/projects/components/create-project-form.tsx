"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { DottedSeparator } from "@/components/dotted-separator";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { FormActions } from "@/features/workspaces/components/settings-sections";
import { addDaysDDMMYYYY, convertDDMMYYYYToYYYYMMDD, formatDateDDMMYYYY, sprintLengthInDays } from "@/lib/sprint-utils";

import { projectFormSchema } from "../schemas";
import { useCreateProject } from "../api/use-create-project";
import { SprintDateField, SprintSettings, TextInputField } from "./project-form-fields";

type FormValues = z.infer<typeof projectFormSchema>;

interface CreateProjectFormProps {
    onCancel?: () => void;
};

export const CreateProjectForm = ({ onCancel }: CreateProjectFormProps) => {
    const workspaceId = useWorkspaceId();
    const router = useRouter();
    const { mutate, isPending } = useCreateProject();
    const today = formatDateDDMMYYYY(new Date());
    const form = useForm<FormValues>({
        resolver: zodResolver(projectFormSchema),
        defaultValues: {
            name: "",
            currentSprintStartDate: today,
            currentSprintEndDate: addDaysDDMMYYYY(today, 29),
        },
    });

    const onSubmit = (values: FormValues) => {
        const finalValues = {
            name: values.name,
            workspaceId,
            // Kept for the dashboard and analytics, which work in sprint lengths
            sprintDuration: sprintLengthInDays(values.currentSprintStartDate, values.currentSprintEndDate).toString(),
            sprintNumber: "1",
            currentSprintStartDate: convertDDMMYYYYToYYYYMMDD(values.currentSprintStartDate),
            currentSprintEndDate: convertDDMMYYYYToYYYYMMDD(values.currentSprintEndDate),
        };
        mutate({ form: finalValues }, {
            onSuccess: ({ data }) => {
                form.reset();
                router.push(`/workspaces/${workspaceId}/projects/${data.$id}`);
            },
        });
    };

    return (
        <Card className="w-full border-none shadow-none">
            <CardHeader className="flex p-7">
                <CardTitle className="font-bold">
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
                            <TextInputField
                                control={form.control}
                                name="name"
                                label="Project Name"
                                placeholder="Enter project name"
                            />
                            <SprintSettings>
                                <SprintDateField control={form.control} name="currentSprintStartDate" label="Sprint Start Date" />
                                <SprintDateField control={form.control} name="currentSprintEndDate" label="Sprint End Date" />
                            </SprintSettings>
                        </div>
                        <FormActions onCancel={onCancel} isPending={isPending} submitLabel="Create Project" />
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};
