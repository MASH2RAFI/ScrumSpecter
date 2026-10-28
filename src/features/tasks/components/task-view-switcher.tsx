"use client";

import { DottedSeparator } from "@/components/dotted-separator";
import { Button } from "@/components/ui/button";
import { 
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs"
import { CalendarDaysIcon, KanbanSquareIcon, PlusIcon, RepeatIcon, TableIcon } from "lucide-react";
import { useCreateTaskModal } from "../hooks/use-create-task-modal";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { useGetTasks } from "../api/use-get-tasks";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useQueryState } from "nuqs";
import { DataFilters } from "./data-filters";
import { useTaskFilters } from "../hooks/use-task-filters";
import { DataTable } from "./data-table";
import { TaskBulkBar } from "./task-bulk-bar";
import { getColumns } from "./columns";
import { useCallback, useMemo } from "react";
import { splitByRoutineWeek } from "../routine-window";
import { useGetRoutines } from "@/features/routines/api/use-get-routines";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { useBulkUpdateTasks } from "../api/use-bulk-update-tasks";
import { LazyCalendar, LazyKanban } from "@/components/lazy-parts";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { Task, TaskStatus } from "../types";
import { Loading, TableSkeleton } from "@/components/page-skeletons";
 
const VIEW_TABS = [
    { value: "table", label: "Table", icon: TableIcon },
    { value: "kanban", label: "Kanban", icon: KanbanSquareIcon },
    { value: "calendar", label: "Calendar", icon: CalendarDaysIcon },
] as const;

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
        const { canEditWork, canReview, canRequestChanges } = usePermissions({ workspaceId });

    const { weekStart, defaultTaskView } = usePreferences();
    const [view, setView] = useQueryState("task-view", {
        defaultValue: defaultTaskView,
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

    // Each routine chooses the views its tasks appear in (routine form → "Show its tasks in")
    const { data: routines } = useGetRoutines({ workspaceId });
    const { tableTasks, kanbanTasks, calendarTasks, hiddenRoutineTasks } = useMemo(() => {
        const all = tasks?.documents ?? [];
        const offIn = (key: "showInTable" | "showInKanban" | "showInCalendar") =>
            new Set((routines?.documents ?? []).filter((routine) => !routine[key]).map((routine) => routine.$id));
        const only = (list: Task[], hidden: Set<string>) =>
            hidden.size ? list.filter((task) => !task.routineId || !hidden.has(task.routineId)) : list;
        const [offTable, offKanban, offCalendar] = [offIn("showInTable"), offIn("showInKanban"), offIn("showInCalendar")];
        const calendar = only(all, offCalendar);
        // Done routine tasks and those from other weeks only clutter the list views; the calendar keeps them all
        const { visible } = splitByRoutineWeek(all, weekStart);
        return {
            tableTasks: only(visible, offTable),
            kanbanTasks: only(visible, offKanban),
            calendarTasks: calendar,
            // Only the ones the calendar actually shows are worth pointing to
            hiddenRoutineTasks: splitByRoutineWeek(calendar, weekStart).hidden,
        };
    }, [tasks, routines, weekStart]);

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
            className="flex-1 w-full border border-border/70 rounded-card bg-card shadow-soft transition-unified"
        >
            <div className="h-full flex flex-col p-3 sm:p-4">
                {/* One row at every size: the view switch, then New */}
                <div className="flex items-center justify-between gap-2">
                    <TabsList className="grid h-9 flex-1 grid-cols-3 rounded-md bg-muted p-0.5 sm:inline-flex sm:flex-none">
                        {VIEW_TABS.map(({ value, label, icon: Icon }) => (
                            <TabsTrigger
                                key={value}
                                value={value}
                                className="h-8 gap-1.5 rounded-[5px] px-3 text-sm min-h-0 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
                            >
                                <Icon className="size-4 shrink-0" />
                                {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {/* Requesters get the same form; it sends a request instead */}
                    {(canEditWork || canRequestChanges) && (
                        <Button onClick={() => open()} size="sm" className="h-9 shrink-0 min-h-0 px-3">
                            <PlusIcon className="size-4 sm:mr-1.5" />
                            <span className="sr-only sm:not-sr-only">New</span>
                        </Button>
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
                    <Loading>
                        <TableSkeleton />
                    </Loading>

                ):(
                    <>
                        {hiddenRoutineTasks > 0 && view !== "calendar" && (
                            <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <RepeatIcon className="size-3.5 text-primary" />
                                {hiddenRoutineTasks} routine {hiddenRoutineTasks === 1 ? "task" : "tasks"} (done, or from other weeks) {hiddenRoutineTasks === 1 ? "is" : "are"} on the Calendar
                            </p>
                        )}
                        <TabsContent value="table" className="mt-0">
                            <DataTable
                                columns={getColumns(tableTasks)}
                                data={tableTasks}
                                // Ticking rows only helps those who may change other people's tasks
                                selection={canReview ? {
                                    getRowId: (task) => task.$id,
                                    renderBar: (selected, clear) => <TaskBulkBar tasks={selected} clear={clear} canEditWork={canEditWork} canReview={canReview} />,
                                } : undefined}
                            />
                        </TabsContent>
                        <TabsContent value="kanban" className="mt-0">
                            <LazyKanban onChange={onKanbanChange} data={kanbanTasks}/>
                        </TabsContent>
                        <TabsContent value="calendar" className="mt-0 h-full overflow-auto">
                            <div className="h-full min-h-[600px]">
                                <LazyCalendar data={calendarTasks} />
                            </div>
                        </TabsContent>
                    </>                    
                )
                }

            </div>
        </Tabs>
    );
};