import { getCurrent } from "@/features/auth/queries";
import { GettingStarted } from "@/features/workspaces/components/getting-started";
import { redirect } from "next/navigation";

const WorkspaceCreatePage = async () => {
    const user = await getCurrent();

    if (!user) redirect("/sign-in");

    return (
        <div className="w-full lg:max-w-2xl">
            <GettingStarted />
        </div>
    );
};

export default WorkspaceCreatePage;