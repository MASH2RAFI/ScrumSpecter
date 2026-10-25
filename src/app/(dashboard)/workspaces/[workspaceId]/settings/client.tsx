"use client";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { EditWorkspaceForm } from "@/features/workspaces/components/edit-workspace-form";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useRedirectOnAccessError } from "@/hooks/use-redirect-on-access-error";
import { isAccessError } from "@/lib/api-error";

export const WorkspaceIdSettingsClient = () => {
    const workspaceId = useWorkspaceId();
    const { data: initialValues, isLoading, error } = useGetWorkspace({ workspaceId });

    useRedirectOnAccessError(error);

    // Keep showing the loader while an access-error redirect happens
    if (isLoading || isAccessError(error)) {
        return <PageLoader />
    }

    if (!initialValues) {
        return <PageError message="Workspace not found" />
    }

    return (
        <div className="w-full lg:max-w-x1">
            <EditWorkspaceForm initialValues={initialValues} />
        </div>
    );
};
