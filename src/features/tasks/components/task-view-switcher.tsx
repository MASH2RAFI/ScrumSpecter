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
import { useCurrentWeek, useGetTasks, type UseGetTasksProps } from "../api/use-get-tasks";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useQueryState } from "nuqs";
import { DataFilters } from "./data-filters";
import { useTaskFilters } from "../hooks/use-task-filters";
import { DataTable } from "./data-table";
import { TaskBulkBar } from "./task-bulk-bar";
import { getColumns } from "./columns";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import Link from "next/link";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { useBulkUpdateTasks } from "../api/use-bulk-update-tasks";
import { LazyCalendar, LazyKanban } from "@/components/lazy-parts";
import { ProjectVisibility } from "./project-visibility";
import { useTaskPanel } from "../hooks/use-task-panel";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { TaskStatus } from "../types";
import { Loading, TableSkeleton } from "@/components/page-skeletons";
 
const VIEW_TABS = [
    { value: "table", label: "Table", icon: TableIcon },
    { value: "kanban", label: "Kanban", icon: KanbanSquareIcon },
    { value: "calendar", label: "Calendar", icon: CalendarDaysIcon },
] as const;

const PAGE_SIZE = 25;
// Kanban's Done column only ever grows; it shows the most recently finished
const DONE_LIMIT = 100;

type BaseQuery = Pick<UseGetTasksProps, "workspaceId" | "status" | "assigneeId" | "projectId" | "dueDate" | "search" | "excludeProjects">;

const SORTABLE = ["name", "project", "assignee", "dueDate", "storyPoints", "status"] as const;

const RoutineNote = ({ count }: { count: number }) => count > 0 ? (
    <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <RepeatIcon className="size-3.5 text-primary" />
        {count} routine {count === 1 ? "task" : "tasks"} (done, or from other weeks) {count === 1 ? "is" : "are"} on the Calendar
    </p>
) : null;

// One page at a time from the server, sorted there too
const TableView = ({ base, canReview, canEditWork }: { base: BaseQuery; canReview: boolean; canEditWork: boolean }) => {
    const week = useCurrentWeek();
    const { open: openTask } = useTaskPanel();
    const [pageIndex, setPageIndex] = useState(0);
    const [sorting, setSorting] = useState<SortingState>([]);
    // A different filter starts again from the first page
    const filterKey = JSON.stringify(base);
    useEffect(() => setPageIndex(0), [filterKey]);

    const sort = sorting[0];
    const sortBy = sort && (SORTABLE as readonly string[]).includes(sort.id) ? sort.id as (typeof SORTABLE)[number] : undefined;
    const { data, isLoading } = useGetTasks({
        ...base,
        ...week,
        scope: "table",
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
        sortBy,
        sortDir: sort ? (sort.desc ? "desc" : "asc") : undefined,
    });

    if (isLoading || !data) return <Loading><TableSkeleton /></Loading>;
    const tasks = data.documents;
    return (
        <>
            <RoutineNote count={data.hiddenRoutineTasks} />
            <DataTable
                columns={getColumns(tasks)}
                data={tasks}
                server={{
                    pageIndex,
                    pageCount: Math.max(1, Math.ceil(data.total / PAGE_SIZE)),
                    onPageChange: setPageIndex,
                    sorting,
                    onSortingChange: (next) => { setSorting(next); setPageIndex(0); },
                }}
                onRowClick={(task) => openTask(task.$id)}
                // Ticking rows only helps those who may change other people's tasks
                selection={canReview ? {
                    getRowId: (task) => task.$id,
                    renderBar: (selected, clear) => <TaskBulkBar tasks={selected} clear={clear} canEditWork={canEditWork} canReview={canReview} />,
                } : undefined}
            />
        </>
    );
};

// Every open task, and the latest finished ones
const KanbanView = ({ base }: { base: BaseQuery }) => {
    const week = useCurrentWeek();
    const workspaceId = base.workspaceId;
    const { mutate: bulkUpdate } = useBulkUpdateTasks();
    const { data, isLoading } = useGetTasks({ ...base, ...week, scope: "kanban", doneLimit: DONE_LIMIT });
    const onChange = useCallback((tasks: { $id: string; status: TaskStatus; position: number }[]) => {
        bulkUpdate({ json: { tasks } });
    }, [bulkUpdate]);

    if (isLoading || !data) return <Loading><TableSkeleton rows={4} /></Loading>;
    const olderDone = (data.doneTotal ?? 0) - Math.min(data.doneTotal ?? 0, DONE_LIMIT);
    return (
        <>
            <RoutineNote count={data.hiddenRoutineTasks} />
            {olderDone > 0 && (
                <p className="mb-3 text-xs text-muted-foreground">
                    Done shows the {DONE_LIMIT} most recently finished; {olderDone} older {olderDone === 1 ? "one is" : "ones are"} in the{" "}
                    <Link href={`/workspaces/${workspaceId}/tasks?task-view=table&status=${TaskStatus.DONE}`} className="font-medium text-primary hover:underline">table</Link>.
                </p>
            )}
            <LazyKanban onChange={onChange} data={data.documents} />
        </>
    );
};

// Only the dates on screen (the calendar reports its range), plus tasks with no date yet
const CalendarView = ({ base }: { base: BaseQuery }) => {
    const [range, setRange] = useState<{ from: string; to: string } | null>(null);
    const { data: dated } = useGetTasks({ ...base, scope: "calendar", from: range?.from, to: range?.to, enabled: Boolean(range) });
    const { data: unscheduled } = useGetTasks({ ...base, scope: "calendar", unscheduled: true, limit: 100 });
    const tasks = useMemo(() => [...(dated?.documents ?? []), ...(unscheduled?.documents ?? [])], [dated, unscheduled]);
    const onRangeChange = useCallback((from: Date, to: Date) => {
        setRange((current) => current?.from === from.toISOString() && current?.to === to.toISOString()
            ? current
            : { from: from.toISOString(), to: to.toISOString() });
    }, []);

    return (
        <div className="h-full min-h-[600px]">
            <LazyCalendar data={tasks} onRangeChange={onRangeChange} />
        </div>
    );
};

interface TaskViewSwitcherProps {
    hideProjectFilter?: boolean;
};

export const TaskViewSwitcher = ({ hideProjectFilter }: TaskViewSwitcherProps) => {
    const [{ status, assigneeId, projectId, dueDate, search }] = useTaskFilters();
    const workspaceId = useWorkspaceId();
    const { canEditWork, canReview, canRequestChanges } = usePermissions({ workspaceId });

    const { defaultTaskView, hiddenProjects } = usePreferences();
    const [view, setView] = useQueryState("task-view", {
        defaultValue: defaultTaskView,
    });

    const paramProjectId = useProjectId();
    const { open } = useCreateTaskModal();

    const filterProject = paramProjectId || projectId;
    // My Tasks leaves out the projects hidden with their eye; picking a project explicitly
    // (or a project's own page) still shows it
    const base: BaseQuery = {
        workspaceId, status, assigneeId, projectId: filterProject, dueDate, search,
        excludeProjects: filterProject ? undefined : hiddenProjects,
    };

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

                {/* My Tasks only: show or hide each project's tasks */}
                {!hideProjectFilter && (
                    <div className="mt-4">
                        <ProjectVisibility workspaceId={workspaceId} />
                    </div>
                )}
                <DottedSeparator className="my-4" />
                    <DataFilters 
                        hideProjectFilter={hideProjectFilter} 
                        hideStatusFilter={view === "kanban"}
                        hideDateFilter={view === "calendar"}
                    />
                <DottedSeparator className="my-4" />
                {/* Only the open tab is mounted, so only its tasks load */}
                <TabsContent value="table" className="mt-0">
                    <TableView base={base} canReview={canReview} canEditWork={canEditWork} />
                </TabsContent>
                <TabsContent value="kanban" className="mt-0">
                    <KanbanView base={base} />
                </TabsContent>
                <TabsContent value="calendar" className="mt-0 h-full overflow-auto">
                    <CalendarView base={base} />
                </TabsContent>
            </div>
        </Tabs>
    );
};
