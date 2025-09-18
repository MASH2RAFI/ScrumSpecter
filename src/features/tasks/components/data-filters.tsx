import { 
    Select,
    SelectContent, 
    SelectItem, 
    SelectSeparator, 
    SelectTrigger, 
    SelectValue
} from "@/components/ui/select";

import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { FolderIcon, ListChecksIcon, UserIcon } from "lucide-react";
import { TaskStatus } from "../types";
import { useTaskFilters } from "../hooks/use-task-filters";
import { SimpleDatePicker } from "@/components/simple-date-picker";


interface DataFiltersProps {
    hideProjectFilter?: boolean;
    hideStatusFilter?: boolean;
    hideDateFilter?: boolean;
};

export const DataFilters = ({ hideProjectFilter, hideStatusFilter, hideDateFilter }: DataFiltersProps) => {

    const workspaceId = useWorkspaceId();

    const { data: projects, isLoading: isLoadingProjects } = useGetProjects({workspaceId})
    const { data: members, isLoading: isLoadingMembers } = useGetMembers({workspaceId})

    const isLoading = isLoadingProjects || isLoadingMembers;

    const projectOptions = projects?.documents.map( (project) => ({
        value: project.$id,
        label: project?.name || "Unknown Project",
    }));

    const memberOptions = members?.documents.map( (member) => ({
        value: member.$id,
        label: member?.name || "Unknown Member",
    }));

    const [{
        status,
        assigneeId,
        projectId,
        dueDate
    }, setFilters] = useTaskFilters();

    const onStatusChange = (value: string) => {
        setFilters({ status: value === "all" ? null : value as TaskStatus });
    };

    const onAssigneeChange = (value: string) => {
        setFilters({ assigneeId: value === "all" ? null : value as string });
    };

    const onProjectChange = (value: string) => {
        setFilters({ projectId: value === "all" ? null : value as string });
    };
    
    if (isLoading) return null;

    return (
        <div className="flex flex-col lg:flex-row gap-3">

            <Select
                defaultValue={assigneeId ?? undefined} 
                onValueChange={(value) => {onAssigneeChange(value)}} 
            >
                <SelectTrigger className="w-full lg:w-auto h-10 sm:h-8 min-h-[44px] sm:min-h-[32px]"> 
                    <div className="flex items-center pr-2"> 
                        <UserIcon className="size-4 mr-2 text-emerald-600" /> 
                        <SelectValue placeholder="All assignees" /> 
                    </div> 
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All assignees</SelectItem>
                    <SelectSeparator />
                    {memberOptions?.map( (member) => (
                    <SelectItem key={member.value} value={member.value}>
                        {member.label}
                    </SelectItem>
                    ))}
                </SelectContent >
            </Select>

            {!hideProjectFilter && ( 
                <Select
                    defaultValue={projectId ?? undefined} 
                    onValueChange={(value) => {onProjectChange(value)}} 
                >
                <SelectTrigger className="w-full lg:w-auto h-10 sm:h-8 min-h-[44px] sm:min-h-[32px]"> 
                    <div className="flex items-center pr-2"> 
                        <FolderIcon className="size-4 mr-2 text-purple-600" /> 
                        <SelectValue placeholder="All projects" /> 
                    </div> 
                </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All projects</SelectItem>
                        <SelectSeparator />
                        {projectOptions?.map( (project) => (
                        <SelectItem key={project.value} value={project.value}>
                            {project.label}
                        </SelectItem>
                        ))}
                    </SelectContent >
                </Select>
            )}

            {!hideDateFilter && (
                <SimpleDatePicker
                    placeholder="Due date"
                    size="sm"
                    value={dueDate ? new Date(dueDate) : undefined}
                    onChange={ (date) => {
                    setFilters ({ dueDate: date ? date.toISOString() : null })
                    }}
                />
            )}

            {!hideStatusFilter && (
                <Select
                    defaultValue={status ?? undefined} 
                    onValueChange={(value) => {onStatusChange(value)}} 
                >
                    <SelectTrigger className="w-full lg:w-auto h-10 sm:h-8 min-h-[44px] sm:min-h-[32px]"> 
                        <div className="flex items-center pr-2"> 
                            <ListChecksIcon className="size-4 mr-2 text-blue-600" /> 
                            <SelectValue placeholder="All statuses" /> 
                        </div> 
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectSeparator />
                        <SelectItem value={TaskStatus.BACKLOG}>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                                Backlog
                            </div>
                        </SelectItem>
                        <SelectItem value={TaskStatus.TODO}>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                Todo
                            </div>
                        </SelectItem>
                        <SelectItem value={TaskStatus.IN_PROGRESS}>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                In Progress
                            </div>
                        </SelectItem>
                        <SelectItem value={TaskStatus.IN_REVIEW}>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                                In Review
                            </div>
                        </SelectItem>
                        <SelectItem value={TaskStatus.DONE}>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
                                Done
                            </div>
                        </SelectItem>
                    </SelectContent >
                </Select>
            )} 
        </div>

    );
};