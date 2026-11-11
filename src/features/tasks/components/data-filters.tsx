"use client";

import { useState, type ReactNode } from "react";
import { SearchIcon, SlidersHorizontalIcon, StarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimpleDatePicker } from "@/components/simple-date-picker";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { useCurrent } from "@/features/auth/api/use-current";
import { usePreferences, useSavePreferences } from "@/features/auth/hooks/use-preferences";
import { EMPTY_TASK_FILTER, TASK_SORTS, type UserPreferences } from "@/features/auth/preferences-core";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useProjectId } from "@/features/projects/hooks/use-project-id";

import { useGetTaskFacets, type UseGetTasksProps } from "../api/use-get-tasks";
import { useTaskFilters } from "../hooks/use-task-filters";
import { useTaskFilter } from "../hooks/use-saved-filters";
import { TaskStatus } from "../types";
import { parseSearch } from "../search-tokens";
import { ProjectVisibility } from "./project-visibility";

export const STATUS_CHIPS: { status: TaskStatus; label: string; dot: string }[] = [
    { status: TaskStatus.BACKLOG, label: "Backlog", dot: "bg-rose-400" },
    { status: TaskStatus.TODO, label: "Todo", dot: "bg-slate-400" },
    { status: TaskStatus.IN_PROGRESS, label: "In Progress", dot: "bg-amber-500" },
    { status: TaskStatus.IN_REVIEW, label: "In Review", dot: "bg-sky-500" },
    { status: TaskStatus.DONE, label: "Done", dot: "bg-emerald-600" },
];

const SORT_LABELS: Record<UserPreferences["taskSort"], string> = {
    newest: "Newest first",
    dueDate: "Due date",
    name: "Name, A to Z",
    storyPoints: "Story points",
};

// One filter choice: a small toggle with its live count
export const FilterChip = ({ pressed, onClick, count, children, label }: {
    pressed: boolean;
    onClick: () => void;
    count?: number;
    children: ReactNode;
    // The accessible name when the visible content isn't enough
    label?: string;
}) => (
    <button
        type="button"
        aria-pressed={pressed}
        aria-label={label}
        onClick={onClick}
        className={cn(
            "inline-flex h-6 min-h-0 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-xs font-medium leading-none transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pressed ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/50 text-foreground hover:bg-accent",
        )}
    >
        {children}
        {count !== undefined && (
            <span className={cn("tabular-nums text-[10px] font-semibold", pressed ? "text-primary-foreground/80" : "text-muted-foreground")}>{count}</span>
        )}
    </button>
);

// A labelled row of the filter block; the label sits on the first line of controls
export const FilterRow = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
    <div className={cn("grid grid-cols-[3.25rem_1fr] items-start gap-1.5 border-t border-border/70 px-2 py-1 first:border-t-0", className)}>
        <span className="text-[9.5px] font-bold uppercase leading-7 tracking-wider text-muted-foreground">{label}</span>
        <div className="flex min-h-7 min-w-0 flex-wrap items-center gap-1">{children}</div>
    </div>
);

interface DataFiltersProps {
    // The list query the table makes (for the chips' counts)
    base: UseGetTasksProps;
    hideProjectFilter?: boolean;
    hideDateFilter?: boolean;
    // How the search words were read (search-tokens.ts), shown under the box
    understood?: string[];
};

// My Tasks' filter block: search (with field shortcuts), due date and sort; then whose tasks, which
// statuses (plus Starred and Overdue), and the project eyes. The choices are saved on the account
// per workspace, and Home follows them; a project's page keeps its own. Within a row a choice means "any of"; Starred and Overdue
// narrow what's left.
export const DataFilters = ({ base, hideProjectFilter, hideDateFilter, understood = [] }: DataFiltersProps) => {
    const workspaceId = useWorkspaceId();
    const { data: members } = useGetMembers({ workspaceId });
    const { data: currentUser } = useCurrent();
    const { filter, setFilter } = useTaskFilter(workspaceId, useProjectId());
    const { taskSort } = usePreferences();
    const savePreferences = useSavePreferences();
    const [{ search, dueDate, status: urlStatus }, setUrl] = useTaskFilters();
    const { data: facets } = useGetTaskFacets(base);

    // Typing updates local state at once; the URL (and the query) follows after a pause
    const [searchText, setSearchText] = useState(search ?? "");
    const [filtersOpen, setFiltersOpen] = useState(false);
    useDebounce(() => {
        const next = searchText.trim() || null;
        if (next !== (search ?? null)) setUrl({ search: next });
    }, 300, [searchText]);

    // A link like Home's "Done" card picks a status for this visit; the saved choice otherwise
    const statuses = urlStatus ? [urlStatus] : filter.statuses;
    const toggleStatus = (status: TaskStatus) => {
        const next = statuses.includes(status) ? statuses.filter((s) => s !== status) : [...statuses, status];
        setFilter({ statuses: next });
        if (urlStatus) setUrl({ status: null });
    };
    const togglePerson = (id: string) =>
        setFilter({ people: filter.people.includes(id) ? filter.people.filter((p) => p !== id) : [...filter.people, id] });
    // Enter turns what the search understood into chips (saved), leaving the other words in the box.
    // People and statuses replace their row; Starred and Overdue switch on; today/tomorrow pick the
    // due date. Project words stay as typed (projects have eyes, not chips).
    const lockIn = () => {
        const tokens = parseSearch(
            searchText,
            (members?.documents ?? []).map((member) => ({ id: member.$id, name: member.name })),
            [],
        );
        const changes: Partial<typeof filter> = {};
        if (tokens.people) changes.people = [...new Set(tokens.people)];
        if (tokens.statuses) changes.statuses = tokens.statuses;
        if (tokens.starred) changes.starred = true;
        if (tokens.overdue) changes.overdue = true;
        if (!Object.keys(changes).length && !tokens.due) return;
        setFilter(changes);
        const text = tokens.text;
        setSearchText(text);
        setUrl({ search: text || null, status: null, ...(tokens.due && { dueDate: tokens.due.from.toISOString() }) });
    };
    const reset = () => {
        setFilter(EMPTY_TASK_FILTER);
        setUrl({ status: null, assigneeId: null, projectId: null, dueDate: null, search: null });
        setSearchText("");
    };

    // Me first, then everyone else (placeholders too), by name
    const me = members?.documents.find((member) => member.userId === currentUser?.$id);
    const others = (members?.documents ?? []).filter((member) => member.$id !== me?.$id)
        .sort((a, b) => a.name.localeCompare(b.name));
    const personCount = (memberId: string | undefined) => (memberId && facets ? facets.people[memberId] ?? 0 : undefined);
    const nothingPicked = !statuses.length && !filter.starred && !filter.overdue;
    const active = filter.people.length + statuses.length + Number(filter.starred) + Number(filter.overdue);

    return (
        <div className="rounded-lg border border-border/70 text-sm" data-testid="task-filters">
            <FilterRow label="Search">
                <div className="relative min-w-[12rem] flex-1">
                    <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        id="task-search"
                        type="search"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lockIn(); } }}
                        placeholder="Search: theo in review, overdue, starred…"
                        aria-label="Search tasks"
                        className="h-7 min-h-0 pl-7 text-base md:text-xs"
                    />
                </div>
                {!hideDateFilter && (
                    <SimpleDatePicker
                        placeholder="Due date"
                        size="sm"
                        className="h-7 text-xs"
                        value={dueDate ? new Date(dueDate) : undefined}
                        onChange={(date) => setUrl({ dueDate: date ? date.toISOString() : null })}
                    />
                )}
                <Select value={taskSort} onValueChange={(value) => savePreferences({ taskSort: value as UserPreferences["taskSort"] })}>
                    <SelectTrigger className="h-7 min-h-0 w-auto gap-1 text-xs" aria-label="Sort">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {TASK_SORTS.map((sort) => <SelectItem key={sort} value={sort}>{SORT_LABELS[sort]}</SelectItem>)}
                    </SelectContent>
                </Select>
                {/* Phones: the rows below fold away behind this */}
                <Button
                    type="button"
                    variant={filtersOpen || active ? "secondary" : "outline"}
                    className="h-7 min-h-0 shrink-0 gap-1 px-2 text-xs lg:hidden"
                    aria-expanded={filtersOpen}
                    aria-controls="task-filter-rows"
                    onClick={() => setFiltersOpen((open) => !open)}
                >
                    <SlidersHorizontalIcon className="size-3.5" />
                    Filters
                    {active > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 text-primary-foreground">{active}</span>}
                </Button>
            </FilterRow>
            {search && understood.length > 0 && (
                <p className="border-t border-border/70 px-2 py-1 text-[11px] text-muted-foreground" aria-live="polite" data-testid="search-understood">
                    Showing <span className="font-semibold text-foreground">{understood.join(" · ")}</span>
                    <span className="hidden sm:inline"> · Enter turns these into filters · &quot;quotes&quot; search names only</span>
                </p>
            )}

            <div id="task-filter-rows" className={cn(!filtersOpen && "hidden lg:block")}>
                <FilterRow label="Show">
                    <FilterChip pressed={filter.people.length === 0} onClick={() => setFilter({ people: [] })} count={facets?.everyone}>
                        Everyone
                    </FilterChip>
                    {me && (
                        <FilterChip pressed={filter.people.includes("me")} onClick={() => togglePerson("me")} count={personCount(me.$id)}>
                            <span aria-hidden><MemberAvatar name={me.name} className="size-4" fallbackClassName="text-[8px]" /></span>
                            Me
                        </FilterChip>
                    )}
                    {others.map((member) => (
                        <FilterChip key={member.$id} pressed={filter.people.includes(member.$id)} onClick={() => togglePerson(member.$id)} count={personCount(member.$id)}>
                            <span aria-hidden><MemberAvatar name={member.name} className="size-4" fallbackClassName="text-[8px]" /></span>
                            {member.name}
                        </FilterChip>
                    ))}
                </FilterRow>

                <FilterRow label="Filter">
                    <FilterChip
                        pressed={nothingPicked}
                        onClick={() => { setFilter({ statuses: [], starred: false, overdue: false }); setUrl({ status: null }); }}
                        count={facets?.allStatuses}
                    >
                        All
                    </FilterChip>
                    {STATUS_CHIPS.map(({ status, label, dot }) => (
                        <FilterChip key={status} pressed={statuses.includes(status)} onClick={() => toggleStatus(status)} count={facets ? facets.statuses[status] ?? 0 : undefined}>
                            <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
                            {label}
                        </FilterChip>
                    ))}
                    <span className="mx-0.5 h-3.5 w-px bg-border" aria-hidden />
                    <FilterChip pressed={filter.starred} onClick={() => setFilter({ starred: !filter.starred })} count={facets?.starred}>
                        <StarIcon className={cn("size-3", filter.starred ? "fill-current" : "fill-amber-400 text-amber-500")} aria-hidden />
                        Starred
                    </FilterChip>
                    <FilterChip pressed={filter.overdue} onClick={() => setFilter({ overdue: !filter.overdue })} count={facets?.overdue}>
                        Overdue
                    </FilterChip>
                    <button type="button" onClick={reset} className="ml-auto h-6 min-h-0 px-1 text-xs font-semibold text-primary hover:underline">
                        Reset
                    </button>
                </FilterRow>

                {!hideProjectFilter && (
                    <FilterRow label="Projects">
                        <ProjectVisibility workspaceId={workspaceId} compact />
                    </FilterRow>
                )}
            </div>
        </div>
    );
};
