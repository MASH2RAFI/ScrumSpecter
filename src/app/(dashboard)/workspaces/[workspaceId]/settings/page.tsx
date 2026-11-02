import { redirect } from "next/navigation";

interface SettingsPageProps {
    params: Promise<{ workspaceId: string }>;
}

// Settings is a popup now; keep old links working
const SettingsPage = async (props: SettingsPageProps) => {
    const params = await props.params;

    const {
        workspaceId
    } = params;

    redirect(`/workspaces/${workspaceId}?workspace-panel=settings`);
};

export default SettingsPage;
