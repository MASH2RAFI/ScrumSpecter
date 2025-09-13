"use client";

import { Button } from "@/components/ui/button"
import { 
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import {
    DropdownMenu, 
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ArrowLeftIcon, MoreVerticalIcon } from "lucide-react";
import Link from "next/link";
import { useWorkspaceId } from "../hooks/use-workspace-id";
import { DottedSeparator } from "@/components/dotted-separator";
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { Fragment } from "react";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { Separator } from "@/components/ui/separator";
import { useDeleteMember } from "@/features/members/api/use-delete-member";
import { useUpdateMember } from "@/features/members/api/use-update-member";
import { useLeaveWorkspace } from "@/features/members/api/use-leave-workspace";
import { MemberRole } from "@/features/members/types";
import { useConfirm } from "@/hooks/use-confirm";
import { useCurrent } from "@/features/auth/api/use-current";
import React from "react";

export const MembersList = () => {

    const workspaceId = useWorkspaceId();
    const { isAdmin } = useIsAdmin({ workspaceId }); 
    const { data } = useGetMembers({ workspaceId });
    const { data: currentUser } = useCurrent();

    // Check if current user is the last admin
    const isLastAdmin = React.useMemo(() => {
        if (!data?.documents || !currentUser) return false;
        const adminMembers = data.documents.filter(member => member.role === "ADMIN");
        const currentUserMember = data.documents.find(member => member.userId === currentUser.$id);
        return adminMembers.length === 1 && currentUserMember?.role === "ADMIN";
    }, [data?.documents, currentUser]);

    const [ ConfirmDialog, confirm ] = useConfirm(
        "Remove member",
        "This member will be removed from the workspace",
        "destructive"
    );

    const [ LeaveConfirmDialog, leaveConfirm ] = useConfirm(
        "Leave Workspace",
        "Are you sure you want to leave this workspace? All your assigned tasks will be reassigned to an admin.",
        "destructive"
    );

    const {
        mutate: deleteMember,
        isPending: isDeletingMember
    } = useDeleteMember();

    const {
        mutate: updateMember,
        isPending: isUpdatingMember
    } = useUpdateMember();

    const {
        mutate: leaveWorkspace,
        isPending: isLeavingWorkspace
    } = useLeaveWorkspace();

    const handleUpdateMember = (memberId: string, role: MemberRole) => {
        updateMember({
        json: { role },
        param: { memberId },
        })
    };

    const handleDeleteMember = async (memberId: string) => {

        const ok = await confirm();
        if (!ok) return;

        deleteMember({ param: { memberId }},{
            onSuccess: () => {
                window.location.reload();
            },
        });
    };

    const handleLeaveWorkspace = async () => {
        const ok = await leaveConfirm();
        if (!ok) return;

        leaveWorkspace({
            json: { workspaceId }
        });
    };
    return (
        <Card className="w—full h-full border-none shadow-none">
            <ConfirmDialog />
            <LeaveConfirmDialog />
            <CardHeader className="flex flex-row items-center gap-x-4 p—7 space-y-0">
                <Button asChild variant="secondary" size="sm">
                <Link href={ `/workspaces/${workspaceId}`}>
                    <ArrowLeftIcon className="size-4 mr-2" />
                    Back
                </Link>
                </Button>
                <CardTitle className="text-2xl font-bold">
                    Members list
                </CardTitle>
            </CardHeader>

            <div className="px-7">
                <DottedSeparator />
            </div>

            <CardContent className="p-7">
                {data?.documents.map( (member, index ) => (
                    <Fragment key={member.$id}>
                        <div className="flex items-center gap-2">
                            <MemberAvatar 
                                name={member.name}
                                className="size-10"
                                fallbackClassName="text-lg"
                            
                            />

                            <div className="flex flex-col">
                                <p className="text-sm font-medium">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                            <div className="ml-auto flex gap-2">
                                {/* Leave Workspace button for current user */}
                                {currentUser && member.userId === currentUser.$id && (
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
                                
                                {/* Admin controls for other members */}
                                {isAdmin && member.userId !== currentUser?.$id && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="secondary"
                                                size="icon"
                                            >
                                                <MoreVerticalIcon className="size-4 text-muted-foreground"/>
                                            </Button>                                          
                                        </DropdownMenuTrigger>

                                        <DropdownMenuContent side="bottom" align="end">
                                            <DropdownMenuItem
                                                className="font-medium"
                                                onClick={() => handleUpdateMember(member.$id, MemberRole.ADMIN)}
                                                disabled={isUpdatingMember}
                                            >
                                                Set as Administrator
                                            </DropdownMenuItem>

                                            <DropdownMenuItem
                                                className="font-medium"
                                                onClick={() => handleUpdateMember(member.$id, MemberRole.MEMBER)}
                                                disabled={isUpdatingMember || (member.role === "ADMIN" && isLastAdmin)}
                                                title={member.role === "ADMIN" && isLastAdmin ? "Cannot downgrade the only admin" : ""}
                                            >
                                                Set as Member
                                            </DropdownMenuItem>

                                            <DropdownMenuItem
                                                className="font-medium text-amber-700"
                                                onClick={() => handleDeleteMember( member.$id )}
                                                disabled={isDeletingMember || (member.role === "ADMIN" && isLastAdmin)}
                                                title={member.role === "ADMIN" && isLastAdmin ? "Cannot remove the only admin" : ""}
                                            >
                                                Remove {member.name}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>

                        </div>

                        {index < data.documents.length-1 && (
                            <Separator className="my-2.5 "/>
                        )}

                    </Fragment>
                ))}
            </CardContent>

        </Card>
    );
}