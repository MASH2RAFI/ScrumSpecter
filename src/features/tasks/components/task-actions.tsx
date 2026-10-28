import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ExternalLinkIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeleteTask } from "../api/use-delete-task";
import { useConfirm } from "@/hooks/use-confirm";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useEditTaskModal } from "../hooks/use-edit-task-modal";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { useTaskPanel } from "../hooks/use-task-panel";
import { useCreateChangeRequest } from "@/features/change-requests/api/use-change-requests";
interface TaskActionsProps {
    id: string;
    projectId: string;
    children: React.ReactNode;
}

export const TaskActions = ({ id, projectId, children}: TaskActionsProps) => {
    const workspaceId = useWorkspaceId();
    const router = useRouter();
    const { open } = useEditTaskModal();
    const { canEditWork, canRequestChanges } = usePermissions({ workspaceId });
    const [ConfirmDialog, confirm] = useConfirm( 
        "Delete task", 
        "You can undo this for a few seconds afterwards.",
        "destructive" 
    );
    const [ConfirmRequestDialog, confirmRequest] = useConfirm(
        "Request deletion",
        "An admin or supervisor is asked to delete this task.",
        "destructive"
    );
    const { mutate: requestDeletion, isPending: isRequesting } = useCreateChangeRequest();

    const { mutate, isPending } = useDeleteTask();

    const onDelete = async () => { 
        const ok = await confirm(); 
        if (!ok) return; 
        mutate({ param: { taskId: id} }); 
    };

    const { open: openTaskPanel } = useTaskPanel();

    const onOpenTask = () => {
        openTaskPanel(id);
    };

    const onOpenProject = () => {
        router.push(`/workspaces/${workspaceId}/projects/${projectId}`);
    }

    return (
        <div className="flex justify-end">
            <ConfirmDialog />
            <ConfirmRequestDialog />
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    {children}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48"> 
                    <DropdownMenuItem 
                        onClick={onOpenTask} 
                        className="font-medium p-[10px]" 
                    > 
                        <ExternalLinkIcon className="size-4 mr-2 stroke-2" /> 
                        Task Details 
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                        onClick={onOpenProject} 
                        className="font-medium p-[10px]" 
                    > 
                        <ExternalLinkIcon className="size-4 mr-2 stroke-2" /> 
                        Open Project
                    </DropdownMenuItem>

                    <DropdownMenuItem 
                        onClick={() => open(id) } 
                        className="font-medium p-[10px]" 
                    > 
                        <PencilIcon className="size-4 mr-2 stroke-2" /> 
                        Edit Task 
                    </DropdownMenuItem>

                    {canEditWork && (
                        <DropdownMenuItem 
                            onClick={onDelete} 
                            disabled={isPending} 
                            className="text-amber-700 focus:text-amber-700 font-medium p-[10px]" 
                        > 
                            <TrashIcon className="size-4 mr-2 stroke-2" /> 
                            Delete Task
                        </DropdownMenuItem>
                    )}
                    {!canEditWork && canRequestChanges && (
                        <DropdownMenuItem
                            onClick={async () => {
                                if (await confirmRequest()) requestDeletion({ kind: "delete", taskId: id });
                            }}
                            disabled={isRequesting}
                            className="text-amber-700 focus:text-amber-700 font-medium p-[10px]"
                        >
                            <TrashIcon className="size-4 mr-2 stroke-2" />
                            Request deletion
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent> 
            </DropdownMenu> 
        </div>
    );
};