"use client";

import { cn } from "@/lib/utils";
import { SIDEBAR_FADE, useSidebar } from "./sidebar-context";

import { useState } from "react";
import { PlusIcon, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useGetWorkspaces } from "@/features/workspaces/api/use-get-workspaces";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { WorkspaceAvatar } from "./workspace-avatar";
import { useRouter } from "next/navigation";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCreateWorkspaceModal } from "@/features/workspaces/hooks/use-create-workspace-modal";
import { useJoinWorkspaceModal } from "@/hooks/use-join-workspace-modal";
import { JoinWorkspaceModal } from "./join-workspace-modal";
import { Loading } from "@/components/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export const WorkspaceSwitcher = () => {
    const workspaceId = useWorkspaceId();
    const router = useRouter();
    const { open } = useCreateWorkspaceModal();
    const { open: openJoinModal, isOpen: isJoinModalOpen, close: closeJoinModal } = useJoinWorkspaceModal();
    const { data: workspaces, isLoading, error } = useGetWorkspaces();
    const { setMenuOpen } = useSidebar();
    // Controlled, so "New workspace" at the bottom of the list can close it
    const [listOpen, setListOpen] = useState(false);
    const onListOpenChange = (next: boolean) => {
        setListOpen(next);
        setMenuOpen(next);
    };

    const onSelect = ( id:string ) => {
        router.push(`/workspaces/${id}`)
    };

    return (
        <div className="flex flex-col gap-y-2">
            <div className={cn("flex items-center justify-between", SIDEBAR_FADE)}>
                <p className="text-xs uppercase font-medium text-muted-foreground">Workspaces</p>
                <div className="flex items-center gap-2">
                    <UserPlus
                        onClick={openJoinModal}
                        className="size-5 text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                    />
                </div>
            </div>

            {isLoading ? (
                <Loading>
                    {/* Just the avatar's square while the sidebar is folded */}
                    <Skeleton className="h-10 w-full group-data-[collapsed=true]/sidebar:w-10" />
                </Loading>
            ) : error ? (
                <div className="w-full bg-destructive/10 border border-destructive/20 rounded-md p-3">
                    <p className="text-xs text-destructive text-center">Failed to load workspaces</p>
                </div>
            ) : (
                <Select onValueChange={onSelect} value={workspaceId} open={listOpen} onOpenChange={onListOpenChange}>
                    <SelectTrigger className="w-full bg-muted border border-border font-medium p-2 hover:bg-accent transition-colors group-data-[collapsed=true]/sidebar:border-transparent group-data-[collapsed=true]/sidebar:bg-transparent group-data-[collapsed=true]/sidebar:px-0.5">
                        <SelectValue placeholder="No workspace selected" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border">
                        {workspaces?.documents && workspaces.documents.length > 0 ? (
                            workspaces.documents.map((workspace) => (
                                <SelectItem key={workspace.$id} value={workspace.$id}>
                                    <div className="flex justify-start items-center gap-3 font-medium">
                                        <WorkspaceAvatar name={workspace.name}/>
                                        <span className={cn("truncate text-foreground", SIDEBAR_FADE)}>{workspace.name}</span>
                                    </div>
                                </SelectItem>
                            ))
                        ) : (
                            <div className="p-2 text-center">
                                <p className="text-xs text-muted-foreground">No workspaces found</p>
                            </div>
                        )}
                        <SelectSeparator />
                        <div className="flex justify-center p-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-primary"
                                onClick={() => {
                                    onListOpenChange(false);
                                    open();
                                }}
                            >
                                <PlusIcon className="mr-1.5 size-4" />
                                New workspace
                            </Button>
                        </div>
                    </SelectContent>
                </Select>
            )}

            <JoinWorkspaceModal
                isOpen={isJoinModalOpen}
                onClose={closeJoinModal}
            />
        </div>
    );
}