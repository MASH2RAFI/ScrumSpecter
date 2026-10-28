import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { CreateTaskForm } from "./create-task-form";
import { useCreateTaskModal } from "../hooks/use-create-task-modal";
import { canBeAssigned } from "@/features/members/permissions";
import { MemberRole } from "@/features/members/types";
import { FormSkeleton } from "@/components/page-skeletons";

interface CreateTaskFormWrapperProps {
    onCancel: () => void;
};

export const CreateTaskFormWrapper = ({
    onCancel
}: CreateTaskFormWrapperProps) => {
    const workspaceId = useWorkspaceId();
    const { defaultStatus, defaultStart, defaultDuration } = useCreateTaskModal();

    const { data: projects, isLoading: isLoadingProjects } = useGetProjects({ workspaceId });
    const { data: members, isLoading: isLoadingMembers } = useGetMembers({ workspaceId });

    const projectOptions = projects?.documents.map( (project) => ({
        id: project.$id,
        name: project.name,
    }));

    const memberOptions = members?.documents
        .filter((member) => canBeAssigned(member.role as MemberRole))
        .map((member) => ({ id: member.$id, name: member.name }));

    const isLoading = isLoadingProjects || isLoadingMembers;

    if (isLoading) {
        return (
            <FormSkeleton fields={7} />
        )
    }

    return (
        <div className="w-full h-[714px]">
            <CreateTaskForm 
                onCancel={onCancel}
                projectOptions={ projectOptions ?? [] }
                memberOptions={ memberOptions ?? [] }
                defaultStatus={defaultStatus}
                defaultStart={defaultStart}
                defaultDuration={defaultDuration}
            />
        </div>
    );

}
