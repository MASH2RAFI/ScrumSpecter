"use client";

import { ResponsiveModal } from "@/components/responsive-modal";
import { LazyCreateProjectForm } from "@/components/lazy-parts";
import { useCreateProjectModal } from "../hooks/use-create-project-modal";

export const CreateProjectModal = () => {
    const { isOpen, setIsOpen, close } = useCreateProjectModal();

    return (
        <ResponsiveModal title="Create project" open={isOpen} onOpenChange={setIsOpen}>
            <LazyCreateProjectForm onCancel={close}/>
        </ResponsiveModal>
    );
};