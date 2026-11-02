import { redirect } from "next/navigation";

interface ProjectSettingsPageProps {
    params: Promise<{ workspaceId: string; projectId: string }>;
}

// Editing is a popup on the project page now; keep old links working
const ProjectSettingsPage = async (props: ProjectSettingsPageProps) => {
    const params = await props.params;

    const {
        workspaceId,
        projectId
    } = params;

    redirect(`/workspaces/${workspaceId}/projects/${projectId}?edit-project=${projectId}`);
};

export default ProjectSettingsPage;
