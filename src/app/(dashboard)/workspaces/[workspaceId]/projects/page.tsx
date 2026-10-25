import { getCurrent } from "@/features/auth/queries";
import { getProjects } from "@/features/projects/queries";
import { Project } from "@/features/projects/types";
import { redirect } from "next/navigation";
import { ProjectsClient } from "./client";

interface ProjectsPageProps {
    params: {
        workspaceId: string;
    };
}

export default async function ProjectsPage({ params }: ProjectsPageProps) {
    const user = await getCurrent();

    if (!user) redirect("/sign-in");

    const projects = await getProjects({ workspaceId: params.workspaceId });

    return <ProjectsClient projects={projects as { documents: Project[]; total: number }} workspaceId={params.workspaceId} />;
}
