"use client";

import { Fragment, useMemo } from "react";
import { CheckIcon, MoreVerticalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DottedSeparator } from "@/components/dotted-separator";
import { useConfirm } from "@/hooks/use-confirm";
import { useCurrent } from "@/features/auth/api/use-current";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useDeleteMember } from "@/features/members/api/use-delete-member";
import { useUpdateMember } from "@/features/members/api/use-update-member";
import { useLeaveWorkspace } from "@/features/members/api/use-leave-workspace";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { MemberRole } from "@/features/members/types";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/features/members/permissions";
import { useReplacePlaceholder } from "@/features/members/api/use-placeholders";
import { AddPlaceholderForm } from "@/features/members/components/add-placeholder-form";

import { useWorkspaceId } from "../hooks/use-workspace-id";

export const MembersList = ({ onClose }: { onClose?: () => void }) => {
    const workspaceId = useWorkspaceId();
    const { isAdmin } = usePermissions({ workspaceId });
    const { data } = useGetMembers({ workspaceId });
    const { data: currentUser } = useCurrent();

    const isLastAdmin = useMemo(() => {
        if (!data?.documents || !currentUser) return false;
        const adminCount = data.documents.filter((member) => member.role === "ADMIN").length;
        const currentMember = data.documents.find((member) => member.userId === currentUser.$id);
        return adminCount === 1 && currentMember?.role === "ADMIN";
    }, [data?.documents, currentUser]);

    const [ConfirmDialog, confirm] = useConfirm(
        "Remove member",
        "This member will be removed from the workspace",
        "destructive"
    );

    const [LeaveConfirmDialog, leaveConfirm] = useConfirm(
        "Leave Workspace",
        "Are you sure you want to leave this workspace? All your assigned tasks will be reassigned to an admin.",
        "destructive"
    );

    const { mutate: deleteMember, isPending: isDeletingMember } = useDeleteMember();
    const { mutate: updateMember, isPending: isUpdatingMember } = useUpdateMember();
    const { mutate: leaveWorkspace, isPending: isLeavingWorkspace } = useLeaveWorkspace();
    const { mutate: replacePlaceholder, isPending: isReplacing } = useReplacePlaceholder();
    // Who a placeholder's tasks can go to
    const people = data?.documents.filter((member) => !member.isPlaceholder) ?? [];

    const handleUpdateMember = (memberId: string, role: MemberRole) => {
        updateMember({
            json: { role },
            param: { memberId },
        });
    };

    const handleDeleteMember = async (memberId: string) => {
        const ok = await confirm();
        if (!ok) return;

        // The list and tasks refresh by themselves; no reload needed
        deleteMember({ param: { memberId } });
    };

    const handleLeaveWorkspace = async () => {
        const ok = await leaveConfirm();
        if (!ok) return;

        leaveWorkspace({ json: { workspaceId } }, { onSuccess: () => onClose?.() });
    };

    return (
        <Card className="h-full border-none shadow-none">
            <ConfirmDialog />
            <LeaveConfirmDialog />
            <CardHeader className="flex flex-row items-center gap-x-4 space-y-0">
                <CardTitle className="text-2xl font-bold">
                    Members
                </CardTitle>
            </CardHeader>

            <div className="px-7">
                <DottedSeparator />
            </div>

            <CardContent className="p-7">
                {data?.documents.map((member, index) => {
                    const isSelf = !!currentUser && member.userId === currentUser.$id;
                    const isProtectedAdmin = member.role === "ADMIN" && isLastAdmin;

                    return (
                        <Fragment key={member.$id}>
                            <div className="flex items-center gap-2">
                                <MemberAvatar
                                    name={member.name}
                                    className="size-10"
                                    fallbackClassName="text-lg"
                                />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        {member.name}
                                        {member.isPlaceholder
                                            ? <Badge variant="outline">Placeholder</Badge>
                                            : <Badge variant="secondary" title={ROLE_DESCRIPTIONS[member.role as MemberRole]}>{ROLE_LABELS[member.role as MemberRole]}</Badge>}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {member.isPlaceholder
                                            ? member.email ? `Hands over when ${member.email} joins` : "Hasn't joined"
                                            : member.email}
                                    </p>
                                </div>
                                <div className="ml-auto flex gap-2">
                                    {isSelf && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={handleLeaveWorkspace}
                                            disabled={isLeavingWorkspace || isLastAdmin}
                                            className="text-xs"
                                            title={isLastAdmin ? "Cannot leave as the only admin. Promote another member to admin first." : ""}
                                        >
                                            {isLastAdmin ? "Cannot Leave (Last Admin)" : "Leave Workspace"}
                                        </Button>
                                    )}

                                    {isAdmin && member.isPlaceholder && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="secondary" size="icon" aria-label={`Options for ${member.name}`}>
                                                    <MoreVerticalIcon className="size-4 text-muted-foreground" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent side="bottom" align="end">
                                                <DropdownMenuLabel className="text-xs text-muted-foreground">Replace with</DropdownMenuLabel>
                                                {people.length === 0 && (
                                                    <DropdownMenuItem disabled>Nobody else has joined yet</DropdownMenuItem>
                                                )}
                                                {people.map((person) => (
                                                    <DropdownMenuItem
                                                        key={person.$id}
                                                        disabled={isReplacing}
                                                        onClick={() => replacePlaceholder({ placeholderId: member.$id, memberId: person.$id })}
                                                    >
                                                        {person.name}
                                                    </DropdownMenuItem>
                                                ))}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="font-medium text-amber-700"
                                                    onClick={() => handleDeleteMember(member.$id)}
                                                    disabled={isDeletingMember}
                                                >
                                                    Remove placeholder
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}

                                    {isAdmin && !member.isPlaceholder && member.userId !== currentUser?.$id && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="secondary" size="icon" aria-label={`Options for ${member.name}`}>
                                                    <MoreVerticalIcon className="size-4 text-muted-foreground" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent side="bottom" align="end" className="w-72">
                                                <DropdownMenuLabel className="text-xs text-muted-foreground">Role</DropdownMenuLabel>
                                                {Object.values(MemberRole).map((role) => (
                                                    <DropdownMenuItem
                                                        key={role}
                                                        onClick={() => handleUpdateMember(member.$id, role)}
                                                        disabled={isUpdatingMember || member.role === role || (isProtectedAdmin && role !== MemberRole.ADMIN)}
                                                        className="flex-col items-start gap-0"
                                                    >
                                                        <span className="flex w-full items-center justify-between font-medium">
                                                            {ROLE_LABELS[role]}
                                                            {member.role === role && <CheckIcon className="size-4" />}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
                                                    </DropdownMenuItem>
                                                ))}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="font-medium text-amber-700"
                                                    onClick={() => handleDeleteMember(member.$id)}
                                                    disabled={isDeletingMember || isProtectedAdmin}
                                                    title={isProtectedAdmin ? "Cannot remove the only admin" : ""}
                                                >
                                                    Remove {member.name}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </div>

                            {index < data.documents.length - 1 && (
                                <Separator className="my-2.5" />
                            )}
                        </Fragment>
                    );
                })}
                {isAdmin && (
                    <div className="mt-6">
                        <AddPlaceholderForm workspaceId={workspaceId} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
