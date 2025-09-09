"use client";

import { RiAddCircleFill } from "react-icons/ri";
import { Loader, UserPlus } from "lucide-react";

import { useGetWorkspaces } from "@/features/workspaces/api/use-get-workspaces";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { WorkspaceAvatar } from "./workspace-avatar";
import { useRouter } from "next/navigation";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useCreateWorkspaceModal } from "@/features/workspaces/hooks/use-create-workspace-modal";
import { useJoinWorkspaceModal } from "@/hooks/use-join-workspace-modal";
import { JoinWorkspaceModal } from "./join-workspace-modal";

export const WorkspaceSwitcher = () => { 
    const workspaceId = useWorkspaceId();
    const router = useRouter();
    const { open } = useCreateWorkspaceModal();
    const { open: openJoinModal, isOpen: isJoinModalOpen, close: closeJoinModal } = useJoinWorkspaceModal();
    const { data: workspaces, isLoading, error } = useGetWorkspaces(); 
    
    const onSelect = ( id:string ) => {
        router.push(`/workspaces/${id}`)
    };

    return (
        <div className="flex flex-col gap-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs uppercase font-medium text-muted-foreground">Workspaces</p>
                <div className="flex items-center gap-2">
                    <UserPlus 
                        onClick={openJoinModal} 
                        className="size-5 text-muted-foreground cursor-pointer hover:text-primary transition-colors" 
                    />
                    <RiAddCircleFill 
                        onClick={open} 
                        className="size-5 text-muted-foreground cursor-pointer hover:text-primary transition-colors" 
                    /> 
                </div>
            </div>
            
            {isLoading ? (
                <div className="w-full bg-muted border border-border rounded-md p-3 flex items-center justify-center">
                    <Loader className="size-4 animate-spin text-muted-foreground" />
                </div>
            ) : error ? (
                <div className="w-full bg-destructive/10 border border-destructive/20 rounded-md p-3">
                    <p className="text-xs text-destructive text-center">Failed to load workspaces</p>
                </div>
            ) : (
                <Select onValueChange={onSelect} value={workspaceId}>
                    <SelectTrigger className="w-full bg-muted border border-border font-medium p-2 hover:bg-accent transition-colors">
                        <SelectValue placeholder="No workspace selected" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border">
                        {workspaces?.documents && workspaces.documents.length > 0 ? (
                            workspaces.documents.map((workspace) => (
                                <SelectItem key={workspace.$id} value={workspace.$id}> 
                                    <div className="flex justify-start items-center gap-3 font-medium">
                                        <WorkspaceAvatar name={workspace.name}/>
                                        <span className="truncate text-foreground">{workspace.name}</span>
                                    </div>
                                </SelectItem>
                            ))
                        ) : (
                            <div className="p-2 text-center">
                                <p className="text-xs text-muted-foreground">No workspaces found</p>
                            </div>
                        )}
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