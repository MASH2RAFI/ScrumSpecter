"use client";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { useGetTask } from "@/features/tasks/api/use-get-task";
import { TaskDescription } from "@/features/tasks/components/task-description";
import { TaskOverview } from "@/features/tasks/components/task-overview";
import { useTaskId } from "@/features/tasks/hooks/use-task-id";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TaskBreadcrumbs } from "@/features/tasks/components/task-breadcrumbs";
import { DottedSeparator } from "@/components/dotted-separator";

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
    <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        <div className="flex-1 min-w-0 lg:w-2/3 xl:w-3/4">
            <TaskBreadcrumbs project={data.project} task={data} />
            <DottedSeparator className="my-6" />
            <TaskOverview task={data} />
        </div>
        <div className="flex-1 min-w-0 lg:w-1/3 xl:w-1/4 lg:sticky lg:top-20 lg:self-start">
            {/* Outer container with fixed height and border */}
            <div className="border rounded-lg lg:overflow-hidden">
                {/* Inner scrollable container */}
                <div className="h-full overflow-y-auto">
                    <TaskDescription task={data} />
                </div>
            </div>
        </div>
    </div>
    );
};