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
import { FolderIcon, ListChecksIcon, UserIcon, SearchIcon } from "lucide-react";
import { TaskStatus } from "../types";
import { useState } from "react";
import { useDebounce } from "react-use";
import { Input } from "@/components/ui/input";
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
        dueDate,
        search,
    }, setFilters] = useTaskFilters();

    // Typing updates local state at once; the URL (and the query) follows after a pause
    const [searchText, setSearchText] = useState(search ?? "");
    useDebounce(() => {
        const next = searchText.trim() || null;
        if (next !== (search ?? null)) {
            setFilters({ search: next });
        }
    }, 300, [searchText]);

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
            <div className="relative w-full lg:w-64">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                    id="task-search"
                    type="search"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search tasks..."
                    aria-label="Search tasks"
                    className="pl-8 h-10 sm:h-8 min-h-[44px] sm:min-h-[32px]"
                />
                <kbd className="hidden lg:inline absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 text-[10px] text-muted-foreground pointer-events-none">/</kbd>
            </div>

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