"use client";

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
import { DEFAULT_SORTS } from "../default-sorts";
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
import { useTaskPanel } from "../hooks/use-task-panel";
import { useProjectId } from "@/features/projects/hooks/use-project-id";
import { TaskStatus } from "../types";
import { useTaskFilter } from "../hooks/use-saved-filters";
import { parseSearch } from "../search-tokens";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
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

type BaseQuery = Pick<UseGetTasksProps, "workspaceId" | "status" | "assigneeId" | "projectId" | "from" | "to" | "search" | "excludeProjects" | "starred" | "assignees" | "statuses" | "overdue">;

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
        openOnly: !showDoneInTable && !base.statuses?.length ? true : undefined,
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
                cards
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
            <LazyCalendar data={tasks} onRangeChange={onRangeChange} unscheduledTotal={unscheduled?.total} />
        </div>
    );
};

interface TaskViewSwitcherProps {
    hideProjectFilter?: boolean;
};

export const TaskViewSwitcher = ({ hideProjectFilter }: TaskViewSwitcherProps) => {
    const [{ status, assigneeId, projectId, dueDate, search }] = useTaskFilters();
    const workspaceId = useWorkspaceId();
    // The saved filter (Home follows it), then what this visit's link and search add
    const paramProjectId = useProjectId();
    const { filter } = useTaskFilter(workspaceId, paramProjectId);
    const { data: members } = useGetMembers({ workspaceId });
    const { data: projects } = useGetProjects({ workspaceId });
    const tokens = parseSearch(
        search,
        (members?.documents ?? []).map((member) => ({ id: member.$id, name: member.name })),
        (projects?.documents ?? []).map((project) => ({ id: project.$id, name: project.name })),
    );
    // Starts the star buttons' shared query with the page's other requests, not after the rows render
    useGetStarIds(workspaceId);
    const { canEditWork, canReview, canRequestChanges } = usePermissions({ workspaceId });

    const { defaultTaskView, hiddenProjects } = usePreferences();
    const [view, setView] = useQueryState("task-view", {
        defaultValue: defaultTaskView,
    });

    const { open } = useCreateTaskModal();
    const week = useCurrentWeek();
    const [calendarRange, setCalendarRange] = useState<CalendarRange | null>(null);

    const filterProject = paramProjectId || tokens.projectId || projectId;
    // The due filter is a local midnight; match that whole local day, not the exact instant
    // (a hand-edited, unparseable value is ignored)
    const picked = dueDate ? new Date(dueDate) : null;
    const day = picked && !isNaN(picked.getTime()) ? picked : null;
    // My Tasks leaves out the projects hidden with their eye; picking a project explicitly
    // (or a project's own page) still shows it
    const dueFrom = tokens.due?.from ?? day;
    const dueTo = tokens.due?.to ?? (day ? new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1) : undefined);
    const base: BaseQuery = {
        workspaceId, assigneeId, projectId: filterProject, search: tokens.text || undefined,
        from: dueFrom?.toISOString(),
        to: dueTo?.toISOString(),
        excludeProjects: filterProject ? undefined : hiddenProjects,
        // Search shortcuts take over their row; a link's status beats the saved statuses
        assignees: tokens.people ?? filter.people,
        statuses: tokens.statuses ?? (status ? [status] : filter.statuses),
        starred: tokens.starred || filter.starred || undefined,
        overdue: tokens.overdue || filter.overdue || undefined,
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
                                className="h-8 min-w-0 gap-1.5 rounded-[5px] px-1.5 text-[13px] min-h-0 max-[359px]:px-1 max-[359px]:text-xs sm:px-3 sm:text-sm data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
                            >
                                {/* Phones: a third of the row is too narrow for "Calendar" and an icon */}
                                <Icon className="hidden size-4 shrink-0 sm:block" />
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

                <div className="my-3">
                    <DataFilters
                        base={{ ...base, scope: "table", ...week }}
                        understood={tokens.understood}
                        hideProjectFilter={hideProjectFilter}
                        hideDateFilter={view === "calendar"}
                    />
                </div>
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
