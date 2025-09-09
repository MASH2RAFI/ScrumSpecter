"use client";

import { DottedSeparator } from "@/components/dotted-separator";
import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { useGetTask } from "@/features/tasks/api/use-get-task";
import { TaskBreadcrumbs } from "@/features/tasks/components/task-breadcrumbs";
import { TaskDescription } from "@/features/tasks/components/task-description";
import { TaskOverview } from "@/features/tasks/components/task-overview";
import { useTaskId } from "@/features/tasks/hooks/use-task-id";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const TaskIdClient = () => {
    const router = useRouter();
    const taskId = useTaskId(); 
    const { data, isLoading, error } = useGetTask({ taskId });

    // Check for workspace not found errors and redirect
    useEffect(() => {
        if (error) {
            // Check if the error indicates workspace not found (401 Unauthorized or 404 Not Found)
            if (error && typeof error === 'object' && 'message' in error) {
                const message = (error as Error).message.toLowerCase();
                const isWorkspaceNotFound = message.includes('unauthorized') || 
                                          message.includes('not found') || 
                                          message.includes('failed to fetch');
                
                if (isWorkspaceNotFound) {
                    // Redirect to create workspace page
                    router.push('/workspaces/create');
                }
            }
        }
    }, [error, router]);

    if (isLoading) { 
        return <PageLoader />
    }

    // If there are errors, show loading while redirect happens
    if (error) {
        return <PageLoader />
    }

    if (!data) {
        return <PageError message="Task not found" />
    }

    return (
        <div className="flex flex-col"> 
            <TaskBreadcrumbs project={data.project} task={data} />
            <DottedSeparator className="my-6" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TaskOverview task={data} />
                <TaskDescription task= { data } />
            </div>
        </div>
    );
};