"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { client } from "@/lib/rpc";
import { convertDDMMYYYYToYYYYMMDD, sprintLengthInDays } from "@/lib/sprint-utils";

type RequestType = {
    form: {
        workspaceName: string;
        projectName: string;
        // DD/MM/YYYY, as picked in the form
        currentSprintStartDate: string;
        currentSprintEndDate: string;
    };
};

type ResponseType = {
    workspace: { $id: string; [key: string]: unknown };
    project: { $id: string; [key: string]: unknown };
};

// Creates the workspace, then its first project
export const useCreateWorkspaceWithProject = () => {
    const router = useRouter();
    const queryClient = useQueryClient();

    return useMutation<ResponseType, Error, RequestType>({
        mutationFn: async ({ form }) => {
            const workspaceResponse = await client.api.workspaces["$post"]({
                form: { name: form.workspaceName },
            });
            if (!workspaceResponse.ok) {
                throw new Error("Workspace creation failed");
            }
            const workspace = await workspaceResponse.json();

            const projectResponse = await client.api.projects["$post"]({
                form: {
                    name: form.projectName,
                    workspaceId: workspace.data.$id,
                    sprintDuration: sprintLengthInDays(form.currentSprintStartDate, form.currentSprintEndDate).toString(),
                    sprintNumber: "1",
                    currentSprintStartDate: convertDDMMYYYYToYYYYMMDD(form.currentSprintStartDate),
                    currentSprintEndDate: convertDDMMYYYYToYYYYMMDD(form.currentSprintEndDate),
                },
            });
            if (!projectResponse.ok) {
                throw new Error("Project creation failed");
            }
            const project = await projectResponse.json();

            return {
                workspace: workspace.data,
                project: project.data,
            };
        },
        onSuccess: (data) => {
            toast.success("Workspace and project created successfully");
            router.refresh();
            queryClient.invalidateQueries({ queryKey: ["workspaces"] });
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            router.push(`/workspaces/${data.workspace.$id}/projects/${data.project.$id}`);
        },
        onError: (error) => {
            toast.error(error.message || "Failed to create workspace and project");
        },
    });
};
