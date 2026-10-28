"use client";

import { ResponsiveModal } from "@/components/responsive-modal";

import { useGetProject } from "../api/use-get-project";
import { useEditProjectModal } from "../hooks/use-edit-project-modal";
import { EditProjectForm } from "./edit-project-form";
import { FormSkeleton } from "@/components/page-skeletons";

export const EditProjectModal = () => {
    const { projectId, close } = useEditProjectModal();

    return (
        <ResponsiveModal title="Edit project" open={Boolean(projectId)} onOpenChange={(open) => !open && close()}>
            {projectId && <EditProjectModalContent projectId={projectId} onClose={close} />}
        </ResponsiveModal>
    );
};

const EditProjectModalContent = ({ projectId, onClose }: { projectId: string; onClose: () => void }) => {
    const { data: project, isLoading } = useGetProject({ projectId });

    if (isLoading) {
        return (
            <FormSkeleton fields={4} />
        );
    }

    if (!project) {
        return <p className="p-7 text-sm text-muted-foreground">Project not found</p>;
    }

    return <EditProjectForm key={project.$id} initialValues={project} onCancel={onClose} />;
};
