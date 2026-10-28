"use client";

import { PageError } from "@/components/page-error";
import { PageSkeleton } from "@/components/page-skeletons";
import { useGetTask } from "@/features/tasks/api/use-get-task";
import { TaskDescription } from "@/features/tasks/components/task-description";
import { TaskOverview } from "@/features/tasks/components/task-overview";
import { useTaskId } from "@/features/tasks/hooks/use-task-id";
import { useRedirectOnAccessError } from "@/hooks/use-redirect-on-access-error";
import { isAccessError } from "@/lib/api-error";
import { TaskBreadcrumbs } from "@/features/tasks/components/task-breadcrumbs";
import { DottedSeparator } from "@/components/dotted-separator";

export const TaskIdClient = () => {
    const taskId = useTaskId();
    const { data, isLoading, error } = useGetTask({ taskId });

    useRedirectOnAccessError(error);

    // Keep showing the loader while an access-error redirect happens
    if (isLoading || isAccessError(error)) {
        return <PageSkeleton />
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
