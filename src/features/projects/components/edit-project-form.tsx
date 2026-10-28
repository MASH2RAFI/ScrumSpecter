"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useConfirm } from "@/hooks/use-confirm";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import {
    FormActions,
    SettingsActionButton,
    SettingsCard,
    SettingsHeader,
} from "@/features/workspaces/components/settings-sections";
import { addDaysDDMMYYYY, convertDDMMYYYYToYYYYMMDD, convertYYYYMMDDToDDMMYYYY, formatDateDDMMYYYY, sprintLengthInDays } from "@/lib/sprint-utils";

import { Project } from "../types";
import { projectFormSchema } from "../schemas";
import { useUpdateProject } from "../api/use-update-project";
import { useDeleteProject } from "../api/use-delete-project";
import { SprintDateField, SprintSettings, TextInputField } from "./project-form-fields";

type FormValues = z.infer<typeof projectFormSchema>;

interface EditProjectFormProps {
    onCancel?: () => void;
    initialValues: Project;
};

// Older rows were saved as DD/MM/YYYY by this form; accept both
const toFormDate = (value?: string | null) => {
    if (!value) return "";
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? convertYYYYMMDDToDDMMYYYY(value) : value;
};

export const EditProjectForm = ({ onCancel, initialValues }: EditProjectFormProps) => {
    const router = useRouter();
    const { mutate, isPending } = useUpdateProject();
    const { mutate: deleteProject, isPending: isDeletingProject } = useDeleteProject();
    const { canEditWork } = usePermissions({ workspaceId: initialValues.workspaceId });

    const [DeleteDialog, confirmDelete] = useConfirm(
        "Delete Project",
        "This action cannot be undone.",
        "destructive",
    );

    // Stored as YYYY-MM-DD; the date fields work in DD/MM/YYYY
    const startDate = toFormDate(initialValues.currentSprintStartDate) || formatDateDDMMYYYY(new Date());
    const form = useForm<FormValues>({
        resolver: zodResolver(projectFormSchema),
        defaultValues: {
            name: initialValues.name,
            currentSprintStartDate: startDate,
            // Older projects may only have a duration
            currentSprintEndDate: toFormDate(initialValues.currentSprintEndDate)
                || addDaysDDMMYYYY(startDate, (initialValues.sprintDuration || 30) - 1),
        },
    });

    const handleDelete = async () => {
        const ok = await confirmDelete();
        if (!ok) return;

        deleteProject({
            param: { projectId: initialValues.$id },
        }, {
            onSuccess: () => {
                onCancel?.();
                router.push(`/workspaces/${initialValues.workspaceId}`);
            },
        });
    };

    const onSubmit = (values: FormValues) => {
        // Only admins may change the sprint; members can still rename the project
        const sprint = canEditWork ? {
            sprintDuration: sprintLengthInDays(values.currentSprintStartDate, values.currentSprintEndDate).toString(),
            // Store YYYY-MM-DD, the same format project creation uses
            currentSprintStartDate: convertDDMMYYYYToYYYYMMDD(values.currentSprintStartDate),
            currentSprintEndDate: convertDDMMYYYYToYYYYMMDD(values.currentSprintEndDate),
        } : {};
        const finalValues = {
            name: values.name,
            workspaceId: initialValues.workspaceId,
            sprintNumber: initialValues.sprintNumber?.toString() || "1",
            ...sprint,
        };

        // useUpdateProject already shows the success/error toasts
        mutate({
            form: finalValues,
            param: { projectId: initialValues.$id },
        }, {
            onSuccess: () => onCancel?.(),
        });
    };

    return (
        <div className="flex flex-col gap-y-4">
            <DeleteDialog />
            <Card className="w-full h-full border-none shadow-none">
                <SettingsHeader
                    title={initialValues.name}
                    titleClassName="text-xl font-bold"
                    onBack={onCancel ?? (() => router.push(`/workspaces/${initialValues.workspaceId}/projects/${initialValues.$id}`))}
                />
                <CardContent className="p-7">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <div className="flex flex-col gap-y-4">
                                {canEditWork && (
                                    <TextInputField
                                        control={form.control}
                                        name="name"
                                        label="Project Name"
                                        placeholder="Enter project name"
                                    />
                                )}
                                <SprintSettings>
                                    {canEditWork && (
                                        <>
                                            <SprintDateField control={form.control} name="currentSprintStartDate" label="Sprint Start Date" iconLabel />
                                            <SprintDateField control={form.control} name="currentSprintEndDate" label="Sprint End Date" iconLabel />
                                        </>
                                    )}
                                </SprintSettings>
                            </div>
                            <FormActions onCancel={onCancel} isPending={isPending} submitLabel="Save Changes" />
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <SettingsCard
                title="Danger Zone"
                description="Deleting a project is irreversible and will remove all associated data"
                action={canEditWork && (
                    <SettingsActionButton
                        label="Delete Project"
                        disabled={isPending || isDeletingProject}
                        onClick={handleDelete}
                    />
                )}
            />
        </div>
    );
};
