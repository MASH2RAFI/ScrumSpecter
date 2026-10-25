"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { TextInputField } from "@/features/projects/components/project-form-fields";

import { Workspace } from "../types";
import { updateWorkspaceSchema } from "../schemas";
import { useUpdateWorkspace } from "../api/use-update-workspace";
import { useDeleteWorkspace } from "../api/use-delete-workspace";
import { useResetInviteCode } from "../api/use-reset-invite-code";
import { FormActions, SettingsActionButton, SettingsCard, SettingsHeader } from "./settings-sections";

type FormValues = z.infer<typeof updateWorkspaceSchema>;

interface EditWorkspaceFormProps {
    onCancel?: () => void;
    initialValues: Workspace;
};

export const EditWorkspaceForm = ({ onCancel, initialValues }: EditWorkspaceFormProps) => {
    const router = useRouter();
    const { isAdmin } = useIsAdmin({ workspaceId: initialValues.$id });
    const { mutate, isPending } = useUpdateWorkspace();
    const { mutate: deleteWorkspace, isPending: isDeleting } = useDeleteWorkspace();
    const { mutate: resetInviteCode, isPending: isResettingInviteCode } = useResetInviteCode();

    const [DeleteDialog, confirmDelete] = useConfirm(
        "Delete Workspace",
        "This action cannot be undone.",
        "destructive",
    );

    const [ResetDialog, confirmReset] = useConfirm(
        "Reset Invite Link",
        "This will generate a new invite link for your workspace.",
        "destructive",
    );

    const form = useForm<FormValues>({
        resolver: zodResolver(updateWorkspaceSchema),
        defaultValues: { ...initialValues },
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

    const handleResetInviteCode = async () => {
        const ok = await confirmReset();
        if (!ok) return;

        resetInviteCode({
            param: { workspaceId: initialValues.$id },
        });
    };

    const onSubmit = (values: FormValues) => {
        mutate({
            form: { ...values },
            param: { workspaceId: initialValues.$id },
        });
    };

    const fullInviteLink = `${window.location.origin}/workspaces/${initialValues.$id}/join/${initialValues.inviteCode}`;

    const handleCopyInviteLink = () => {
        navigator.clipboard.writeText(fullInviteLink)
            .then(() => toast.success("Invite link copied to clipboard"));
    };

    return (
        <div className="flex flex-col gap-y-4">
            <DeleteDialog />
            <ResetDialog />
            <Card className="w-full h-full border-none shadow-none">
                <SettingsHeader
                    title={initialValues.name}
                    titleClassName="font-bold"
                    onBack={onCancel ?? (() => router.push(`/workspaces/${initialValues.$id}`))}
                />
                <CardContent className="p-7">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <div className="flex flex-col gap-y-4">
                                <TextInputField
                                    control={form.control}
                                    name="name"
                                    label="Workspace"
                                    placeholder="Enter workspace name"
                                    disabled={!isAdmin}
                                />
                            </div>
                            <FormActions
                                onCancel={onCancel}
                                isPending={isPending}
                                submitLabel="Save Changes"
                                showSubmit={isAdmin}
                            />
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <SettingsCard
                title="Invite Members"
                description="Use this link to invite members to your workspace"
                action={isAdmin && (
                    <SettingsActionButton
                        label="Reset Invite link"
                        disabled={isPending || isResettingInviteCode}
                        onClick={handleResetInviteCode}
                    />
                )}
            >
                <div className="mt-4">
                    <div className="flex items-center gap-x-2">
                        <Input disabled value={fullInviteLink} />
                        <Button
                            onClick={handleCopyInviteLink}
                            variant="secondary"
                            className="size-12"
                        >
                            <CopyIcon className="size-5" />
                        </Button>
                    </div>
                </div>
            </SettingsCard>

            {isAdmin && (
                <SettingsCard
                    title="Danger Zone"
                    description="Deleting a workspace is irreversible and will remove all associated data"
                    action={
                        <SettingsActionButton
                            label="Delete Workspace"
                            disabled={isPending || isDeleting}
                            onClick={handleDelete}
                        />
                    }
                />
            )}
        </div>
    );
};
