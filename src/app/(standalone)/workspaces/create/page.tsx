import { getCurrent } from "@/features/auth/queries";
import { CreateWorkspaceWithProjectForm } from "@/features/workspaces/components/create-workspace-with-project-form";
import { redirect } from "next/navigation";

const WorkspaceCreatePage = async () => {
    const user = await getCurrent();

    if (!user) redirect("/sign-in");

    return (
        <div className="w-full lg:max-w-xl">
            <CreateWorkspaceWithProjectForm />
        </div>
    );
};

export default WorkspaceCreatePage;