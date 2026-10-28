"use client";

import { ResponsiveModal } from "@/components/responsive-modal";

import { LazyEditTaskForm } from "@/components/lazy-parts";
import { useEditTaskModal } from "../hooks/use-edit-task-modal";

export const EditTaskModal = () => {
    const { taskId, close } = useEditTaskModal();

    return (
        <ResponsiveModal title="Edit task" open={!!taskId} onOpenChange={close}>
            {taskId && (
                <LazyEditTaskForm id={taskId} onCancel={close}/>                
            )}
        </ResponsiveModal>
    );

};