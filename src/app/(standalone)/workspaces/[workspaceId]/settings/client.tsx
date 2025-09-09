"use client";

import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { EditWorkspaceForm } from "@/features/workspaces/components/edit-workspace-form";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const WorkspaceIdSettingsClient = () => {
    const router = useRouter();
    const workspaceId = useWorkspaceId(); 
    const { data: initialValues, isLoading, error } = useGetWorkspace({ workspaceId });

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

    if (!initialValues) {
        return <PageError message="Workspace not found" />
    }
    return(
    <div className="w-full lg:max-w-x1">
        <EditWorkspaceForm initialValues={initialValues} />
    </div>
    )
}