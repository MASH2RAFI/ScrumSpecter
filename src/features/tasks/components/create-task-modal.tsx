"use client";

import { ResponsiveModal } from "@/components/responsive-modal";

import { useCreateTaskModal } from "../hooks/use-create-task-modal";
import { LazyCreateTaskForm } from "@/components/lazy-parts";

export const CreateTaskModal = () => {
    const { isOpen, setIsOpen, close } = useCreateTaskModal();

    return (
        <ResponsiveModal title="Create task" open={isOpen} onOpenChange={setIsOpen}>
            <LazyCreateTaskForm onCancel={close}/>
        </ResponsiveModal>
    );

};