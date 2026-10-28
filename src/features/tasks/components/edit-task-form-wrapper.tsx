import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { useGetTask } from "../api/use-get-task";
import { EditTaskForm } from "./edit-task-form";
import { canBeAssigned } from "@/features/members/permissions";
import { MemberRole } from "@/features/members/types";
import { FormSkeleton } from "@/components/page-skeletons";

interface EditTaskFormWrapperProps {
    onCancel: () => void;
    id: string;
};

export const EditTaskFormWrapper = ({
    onCancel,
    id,
}: EditTaskFormWrapperProps) => {
    const workspaceId = useWorkspaceId();
    const { data: initialValues, isLoading: isLoadingTask } = useGetTask({
        taskId: id,
    });
    const { data: projects, isLoading: isLoadingProjects } = useGetProjects({ workspaceId });
    const { data: members, isLoading: isLoadingMembers } = useGetMembers({ workspaceId });

    const projectOptions = projects?.documents.map( (project) => ({
        id: project.$id,
        name: project.name,
    }));

    const memberOptions = members?.documents
        .filter((member) => canBeAssigned(member.role as MemberRole))
        .map((member) => ({ id: member.$id, name: member.name }));

    const isLoading = isLoadingProjects || isLoadingMembers || isLoadingTask;

    if (isLoading) {
        return (
            <FormSkeleton fields={7} />
        )
    }

    if (!initialValues) {
        return null;
    }

    return (
        <div>
            <EditTaskForm
                onCancel={onCancel}
                initialValues={initialValues}
                projectOptions={ projectOptions ?? [] }
                memberOptions={ memberOptions ?? [] }
            />
        </div>
    );

}
