"use client";

import { PageError } from "@/components/page-error";
import { CardPageSkeleton } from "@/components/page-skeletons";
import { useGetWorkspaceInfo } from "@/features/workspaces/api/use-get-workspace-info";
import { JoinWorkspaceForm } from "@/features/workspaces/components/join-workspace-form";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

export const WorkspaceIdJoinClient = () => {
    const workspaceId = useWorkspaceId();
    const { data: initialValues, isLoading, error } = useGetWorkspaceInfo({ workspaceId });

    if (isLoading) {
        return <CardPageSkeleton />
    }

    if (error) {
        return <PageError message="Failed to load workspace information" />
    }

    if (!initialValues) {
        return <PageError message="Workspace not found" />
    }

    return(
        <div className="w-full lg:max-w-xl">
            <JoinWorkspaceForm initialValues={initialValues} />
        </div>
    )
};