"use client";

import { ResponsiveModal } from "@/components/responsive-modal";
import { LazyCreateWorkspaceForm } from "@/components/lazy-parts";
import { useCreateWorkspaceModal } from "../hooks/use-create-workspace-modal";

export const CreateWorkspaceWithProjectModal = () => {
    const { isOpen, setIsOpen, close } = useCreateWorkspaceModal();

    return (
        <ResponsiveModal title="Create workspace" open={isOpen} onOpenChange={setIsOpen}>
            <LazyCreateWorkspaceForm onCancel={close}/>
        </ResponsiveModal>
    );
};
