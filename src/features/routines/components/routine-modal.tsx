"use client";

import { ResponsiveModal } from "@/components/responsive-modal";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { canBeAssigned } from "@/features/members/permissions";
import { MemberRole } from "@/features/members/types";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { useCreateRoutine } from "../api/use-create-routine";
import { useGetRoutines } from "../api/use-get-routines";
import { useUpdateRoutine } from "../api/use-update-routine";
import { useRoutineModal } from "../hooks/use-routine-modal";
import { RoutineForm } from "./routine-form";
import { FormSkeleton } from "@/components/page-skeletons";

export const RoutineModal = () => {
    const workspaceId = useWorkspaceId();
    const { isOpen, routineId, close } = useRoutineModal();
    const { data: projects, isLoading: isLoadingProjects } = useGetProjects({ workspaceId });
    const { data: members, isLoading: isLoadingMembers } = useGetMembers({ workspaceId });
    const { data: routines, isLoading: isLoadingRoutines } = useGetRoutines({ workspaceId });
    const { mutate: createRoutine, isPending: isCreating } = useCreateRoutine();
    const { mutate: updateRoutine, isPending: isUpdating } = useUpdateRoutine();

    const editing = routineId ? routines?.documents.find((routine) => routine.$id === routineId) : undefined;
    const isLoading = isLoadingProjects || isLoadingMembers || (Boolean(routineId) && isLoadingRoutines);

    return (
        <ResponsiveModal title={editing ? "Edit routine" : "New routine"} open={isOpen} onOpenChange={(open) => !open && close()}>
            {isLoading ? (
                <FormSkeleton fields={5} className="p-0" />
            ) : (
                <RoutineForm
                    // Remount per routine so the form picks up its values
                    key={editing?.$id ?? "new"}
                    initialValues={editing}
                    isPending={isCreating || isUpdating}
                    onCancel={close}
                    projectOptions={projects?.documents.map((project) => ({ id: project.$id, name: project.name })) ?? []}
                    memberOptions={members?.documents
                        .filter((member) => canBeAssigned(member.role as MemberRole))
                        .map((member) => ({ id: member.$id, name: member.name })) ?? []}
                    onSubmit={(values) => editing
                        ? updateRoutine({ param: { routineId: editing.$id }, json: values }, { onSuccess: close })
                        : createRoutine({ json: { ...values, workspaceId } }, { onSuccess: close })}
                />
            )}
        </ResponsiveModal>
    );
};
