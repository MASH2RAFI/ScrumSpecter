"use client";

import { DottedSeparator } from "@/components/dotted-separator";
import { Button } from "@/components/ui/button";
import { 
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs"
import { Loader, PlusIcon, RepeatIcon } from "lucide-react";
import { useCreateTaskModal } from "../hooks/use-create-task-modal";
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { useGetTasks } from "../api/use-get-tasks";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useQueryState } from "nuqs";
import { DataFilters } from "./data-filters";
import { useTaskFilters } from "../hooks/use-task-filters";
import { DataTable } from "./data-table";
import { getColumns } from "./columns";
import { Datakanban } from "./data-kanban";
import { useCallback, useMemo } from "react";
import { splitByRoutineWindow } from "../routine-window";
import { useBulkUpdateTasks } from "../api/use-bulk-update-tasks";
import { DataCalendar } from "./data-calendar";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { TaskStatus } from "../types";
 
interface TaskViewSwitcherProps {
    hideProjectFilter?: boolean;
};


export const TaskViewSwitcher = ({ hideProjectFilter }: TaskViewSwitcherProps) => {
        const [{
            status,
            assigneeId,
            projectId,
            dueDate,
            search,
        }] = useTaskFilters();
        
        const workspaceId = useWorkspaceId();
        const { isAdmin } = useIsAdmin({ workspaceId });

    const [view, setView] = useQueryState("task-view", {
        defaultValue: "table",
    });

    const paramProjectId = useProjectId();
    const { open } = useCreateTaskModal();    

    const { mutate: bulkUpdate } = useBulkUpdateTasks();

    const {
        data: tasks,
        isLoading: isLoadingTasks
    }  = useGetTasks({ 
            workspaceId,
            status,
            assigneeId,
            projectId: paramProjectId || projectId,
            dueDate,
            search,
        });


    // Routine tasks beyond the coming week only clutter the list views; the calendar keeps them all
    const { visible: listTasks, hidden: hiddenRoutineTasks } = useMemo(
        () => splitByRoutineWindow(tasks?.documents ?? []),
        [tasks]
    );

    const onKanbanChange = useCallback((
        tasks: { $id: string; status: TaskStatus; position: number }[]
    )    => {
        bulkUpdate({ 
            json:{ tasks },
        });;
    }, [bulkUpdate]);


    return (
        <Tabs 
            defaultValue={view}
            onValueChange={setView}
            className="flex-1 w-full border border-border rounded-unified-lg bg-background shadow-unified transition-unified"
        >
            <div className="h-full flex flex-col p-3 sm:p-4">
                <div className="flex flex-col gap-y-3 sm:gap-y-2 lg:flex-row justify-between items-stretch sm:items-center">
                    <TabsList className="w-full lg:w-auto bg-transparent p-0 h-auto">
                        <TabsTrigger
                            className="h-10 sm:h-8 w-full lg:w-auto bg-muted text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-unified-sm transition-unified text-sm sm:text-base min-h-[44px] sm:min-h-[32px]"
                            value="table"
                        >
                            Table
                        </TabsTrigger>

                        <TabsTrigger
                            className="h-10 sm:h-8 w-full lg:w-auto bg-muted text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-unified-sm transition-unified text-sm sm:text-base min-h-[44px] sm:min-h-[32px]"
                            value="kanban"
                        >
                            Kanban
                        </TabsTrigger>

                        <TabsTrigger
                            className="h-10 sm:h-8 w-full lg:w-auto bg-muted text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-unified-sm transition-unified text-sm sm:text-base min-h-[44px] sm:min-h-[32px]"
                            value="calendar"
                        >
                            Calendar
                        </TabsTrigger>
                    </TabsList>
                    {isAdmin && (
                        <div className="flex gap-2">
                            <Button
                                onClick={() => open()}
                                size="sm"
                                className="w-full lg:w-auto min-h-[44px] sm:min-h-[32px] text-sm sm:text-base"
                            >
                                <PlusIcon className="size-4 mr-2" />
                                New
                            </Button>
                        </div>
                    )}
                </div>

                <DottedSeparator className="my-4" />
                    <DataFilters 
                        hideProjectFilter={hideProjectFilter} 
                        hideStatusFilter={view === "kanban"}
                        hideDateFilter={view === "calendar"}
                    />
                <DottedSeparator className="my-4" />
                {isLoadingTasks ? (
                    <div className="w-full border border-border rounded-lg h-[200px] flex flex-col items-center justify-center bg-muted/20">
                        <Loader className="size-5 animate-spin text-muted-foreground" />
                    </div>

                ):(
                    <>
                        {hiddenRoutineTasks > 0 && view !== "calendar" && (
                            <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <RepeatIcon className="size-3.5 text-primary" />
                                {hiddenRoutineTasks} later routine {hiddenRoutineTasks === 1 ? "task" : "tasks"} this sprint {hiddenRoutineTasks === 1 ? "is" : "are"} on the Calendar
                            </p>
                        )}
                        <TabsContent value="table" className="mt-0">
                            <DataTable columns={getColumns(listTasks)} data={listTasks} />
                        </TabsContent>
                        <TabsContent value="kanban" className="mt-0">
                            <Datakanban onChange={onKanbanChange} data={listTasks}/>
                        </TabsContent>
                        <TabsContent value="calendar" className="mt-0 h-full overflow-auto">
                            <div className="h-full min-h-[600px]">
                                <DataCalendar data={tasks?.documents ?? []} />
                            </div>
                        </TabsContent>
                    </>                    
                )
                }

            </div>
        </Tabs>
    );
};