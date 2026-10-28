"use client";

import { ResponsiveModal } from "@/components/responsive-modal";
import { PageError } from "@/components/page-error";

import { useGetWorkspace } from "../api/use-get-workspace";
import { useWorkspaceId } from "../hooks/use-workspace-id";
import { useWorkspacePanel } from "../hooks/use-workspace-panel";
import { LazyMembersList, LazyWorkspaceSettings } from "@/components/lazy-parts";
import { FormSkeleton } from "@/components/page-skeletons";

export const WorkspacePanelModal = () => {
    const workspaceId = useWorkspaceId();
    const { panel, close } = useWorkspacePanel();

    return (
        <ResponsiveModal
            title={panel === "settings" ? "Workspace settings" : "Members"}
            open={Boolean(panel && workspaceId)}
            onOpenChange={(open) => !open && close()}
            className={panel === "settings" ? "sm:max-w-2xl" : undefined}
        >
            {panel === "members" && <LazyMembersList onClose={close} />}
            {panel === "settings" && <WorkspaceSettingsPanel workspaceId={workspaceId} />}
        </ResponsiveModal>
    );
};

const WorkspaceSettingsPanel = ({ workspaceId }: { workspaceId: string }) => {
    const { data: workspace, isLoading } = useGetWorkspace({ workspaceId });

    if (isLoading) {
        return (
            <FormSkeleton fields={4} />
        );
    }

    if (!workspace) {
        return <PageError message="Workspace not found" />;
    }

    return <LazyWorkspaceSettings workspace={workspace} />;
};
