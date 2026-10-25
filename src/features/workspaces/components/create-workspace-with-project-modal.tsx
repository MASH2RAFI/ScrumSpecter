"use client";

import { ResponsiveModal } from "@/components/responsive-modal";
import { CreateWorkspaceWithProjectForm } from "./create-workspace-with-project-form";
import { useCreateWorkspaceModal } from "../hooks/use-create-workspace-modal";

export const CreateWorkspaceWithProjectModal = () => {
    const { isOpen, setIsOpen, close } = useCreateWorkspaceModal();

    return (
        <ResponsiveModal title="Create workspace" open={isOpen} onOpenChange={setIsOpen}>
            <CreateWorkspaceWithProjectForm onCancel={close}/>
        </ResponsiveModal>
    );
};
