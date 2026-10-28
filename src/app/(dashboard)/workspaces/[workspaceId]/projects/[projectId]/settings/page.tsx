import { redirect } from "next/navigation";

interface ProjectSettingsPageProps {
    params: { workspaceId: string; projectId: string };
}

// Editing is a popup on the project page now; keep old links working
const ProjectSettingsPage = ({ params: { workspaceId, projectId } }: ProjectSettingsPageProps) => {
    redirect(`/workspaces/${workspaceId}/projects/${projectId}?edit-project=${projectId}`);
};

export default ProjectSettingsPage;
