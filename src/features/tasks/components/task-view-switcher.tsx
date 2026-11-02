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
import { useCallback, useMemo, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import Link from "next/link";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import type { UserPreferences } from "@/features/auth/preferences";
import { useBulkUpdateTasks } from "../api/use-bulk-update-tasks";
import { LazyCalendar, LazyKanban } from "@/components/lazy-parts";
import { ProjectVisibility } from "./project-visibility";
import { useTaskPanel } from "../hooks/use-task-panel";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { TaskStatus } from "../types";
import { Loading, TableSkeleton } from "@/components/page-skeletons";
import { TaskExportMenu } from "@/features/export/components/task-export-menu";
import { useGetStarIds } from "@/features/stars/api/use-stars";
 
const VIEW_TABS = [
    { value: "table", label: "Table", icon: TableIcon },
    { value: "kanban", label: "Kanban", icon: KanbanSquareIcon },
    { value: "calendar", label: "Calendar", icon: CalendarDaysIcon },
] as const;

// Kanban's Done column only ever grows; it shows the most recently finished
const DONE_LIMIT = 100;

type BaseQuery = Pick<UseGetTasksProps, "workspaceId" | "status" | "assigneeId" | "projectId" | "from" | "to" | "search" | "excludeProjects">;

const SORTABLE = ["name", "project", "assignee", "dueDate", "storyPoints", "status"] as const;

// The account's starting sort (Account settings), used until a column header is clicked
const DEFAULT_SORTS: Record<UserPreferences["taskSort"], { sortBy: UseGetTasksProps["sortBy"]; sortDir: "asc" | "desc" } | undefined> = {
    newest: undefined,
    dueDate: { sortBy: "dueDate", sortDir: "asc" },
    name: { sortBy: "name", sortDir: "asc" },
    storyPoints: { sortBy: "storyPoints", sortDir: "desc" },
};

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
    const { taskSort, taskPageSize: pageSize, showDoneInTable } = usePreferences();
    // A different filter (or page size) starts again from the first page
    const filterKey = JSON.stringify([base, pageSize]);
    const [shownFilter, setShownFilter] = useState(filterKey);
    if (filterKey !== shownFilter) {
        setShownFilter(filterKey);
        setPageIndex(0);
    }

    const sort = sorting[0];
    const sortBy = sort && (SORTABLE as readonly string[]).includes(sort.id) ? sort.id as (typeof SORTABLE)[number] : undefined;
    const { data, isLoading } = useGetTasks({
        ...base,
        ...week,
        scope: "table",
        limit: pageSize,
        offset: pageIndex * pageSize,
        ...(sort ? { sortBy, sortDir: sort.desc ? "desc" : "asc" } : DEFAULT_SORTS[taskSort]),
        // Done tasks left out when the account says so, unless the status filter asks for them
        openOnly: !showDoneInTable && !base.status ? true : undefined,
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
                    pageCount: Math.max(1, Math.ceil(data.total / pageSize)),
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

type CalendarRange = { from: string; to: string };

// Only the dates on screen (the calendar reports its range), plus tasks with no date yet.
// The calendar hides the due filter, so its from/to never apply here. The range lives in the
// switcher, so Export can download the dates on screen.
const CalendarView = ({ base, range, setRange }: {
    base: BaseQuery;
    range: CalendarRange | null;
    setRange: React.Dispatch<React.SetStateAction<CalendarRange | null>>;
}) => {
    const { data: dated } = useGetTasks({ ...base, scope: "calendar", from: range?.from, to: range?.to, enabled: Boolean(range) });
    const { data: unscheduled } = useGetTasks({ ...base, scope: "calendar", unscheduled: true, from: undefined, to: undefined, limit: 100 });
    const tasks = useMemo(() => [...(dated?.documents ?? []), ...(unscheduled?.documents ?? [])], [dated, unscheduled]);
    const onRangeChange = useCallback((from: Date, to: Date) => {
        setRange((current) => current?.from === from.toISOString() && current?.to === to.toISOString()
            ? current
            : { from: from.toISOString(), to: to.toISOString() });
    }, [setRange]);

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
    // Starts the star buttons' shared query with the page's other requests, not after the rows render
    useGetStarIds(workspaceId);
    const { canEditWork, canReview, canRequestChanges } = usePermissions({ workspaceId });

    const { defaultTaskView, hiddenProjects } = usePreferences();
    const [view, setView] = useQueryState("task-view", {
        defaultValue: defaultTaskView,
    });

    const paramProjectId = useProjectId();
    const { open } = useCreateTaskModal();
    const week = useCurrentWeek();
    const [calendarRange, setCalendarRange] = useState<CalendarRange | null>(null);

    const filterProject = paramProjectId || projectId;
    // The due filter is a local midnight; match that whole local day, not the exact instant
    // (a hand-edited, unparseable value is ignored)
    const picked = dueDate ? new Date(dueDate) : null;
    const day = picked && !isNaN(picked.getTime()) ? picked : null;
    // My Tasks leaves out the projects hidden with their eye; picking a project explicitly
    // (or a project's own page) still shows it
    const base: BaseQuery = {
        workspaceId, status, assigneeId, projectId: filterProject, search,
        from: day?.toISOString(),
        to: day ? new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString() : undefined,
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
                    <div className="flex shrink-0 items-center gap-2">
                        <TaskExportMenu filters={base} week={week} calendarRange={view === "calendar" ? calendarRange : null} />
                        {/* Requesters get the same form; it sends a request instead */}
                        {(canEditWork || canRequestChanges) && (
                            <Button onClick={() => open()} size="sm" className="h-9 shrink-0 min-h-0 px-3">
                                <PlusIcon className="size-4 sm:mr-1.5" />
                                <span className="sr-only sm:not-sr-only">New</span>
                            </Button>
                        )}
                    </div>
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
                    <CalendarView base={base} range={calendarRange} setRange={setCalendarRange} />
                </TabsContent>
            </div>
        </Tabs>
    );
};
