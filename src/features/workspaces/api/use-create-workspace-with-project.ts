"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { client } from "@/lib/rpc";
import { calculateSprintEndDate, convertDDMMYYYYToYYYYMMDD } from "@/lib/sprint-utils";

type RequestType = {
    form: {
        workspaceName: string;
        projectName: string;
        sprintDuration: number;
        startingSprintDate: string;
    };
};

type ResponseType = {
    workspace: { $id: string; [key: string]: unknown };
    project: { $id: string; [key: string]: unknown };
};

export const useCreateWorkspaceWithProject = () => {
    const router = useRouter();
    const queryClient = useQueryClient();

    const mutation = useMutation<
        ResponseType,
        Error,
        RequestType
    >({
        mutationFn: async ({ form }) => {
            // First create the workspace
            const workspaceResponse = await client.api.workspaces["$post"]({ 
                form: { name: form.workspaceName } 
            });
            
            if (!workspaceResponse.ok) {
                throw new Error("Workspace creation failed");
            }
            
            const workspace = await workspaceResponse.json();
            
            // Convert DD/MM/YYYY to YYYY-MM-DD for calculations
            const startDateString = convertDDMMYYYYToYYYYMMDD(form.startingSprintDate);
            const startDate = new Date(startDateString);
            const endDate = calculateSprintEndDate(startDate, form.sprintDuration);
            
            // Then create the project
            const projectResponse = await client.api.projects["$post"]({ 
                form: { 
                    name: form.projectName,
                    workspaceId: workspace.data.$id,
                    sprintDuration: form.sprintDuration.toString(),
                    sprintNumber: "1",
                    currentSprintStartDate: startDateString,
                    currentSprintEndDate: endDate.toISOString().split('T')[0]
                } 
            });
            
            if (!projectResponse.ok) {
                throw new Error("Project creation failed");
            }
            
            const project = await projectResponse.json();
            
            return {
                workspace: workspace.data,
                project: project.data
            };
        },
        onSuccess: (data) => {
            toast.success("Workspace and project created successfully");
            
            router.refresh();
            queryClient.invalidateQueries({ queryKey: ["workspaces"] });
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            
            // Navigate to the project
            router.push(`/workspaces/${data.workspace.$id}/projects/${data.project.$id}`);
        },
        onError: (error) => {
            toast.error(error.message || "Failed to create workspace and project");
        }
    });
    
    return mutation;
};
