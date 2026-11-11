import { cloneElement, isValidElement, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useAnimate, useReducedMotionConfig } from "motion/react";
import {
    addDays,
    addMonths,
    addWeeks,
    endOfMonth,
    format,
    getDay,
    parse,
    startOfMonth,
    startOfWeek,
    subDays,
    subMonths,
    subWeeks,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { Calendar, dateFnsLocalizer, type DateHeaderProps, type DayLayoutFunction } from "react-big-calendar";
import overlap from "react-big-calendar/lib/utils/layout-algorithms/overlap";
import withDragAndDrop, { type EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { toast } from "sonner";

import { EASE } from "@/components/motion";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { weekRange } from "@/lib/week";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrent } from "@/features/auth/api/use-current";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { CALENDAR_VIEWS as VIEW_LIST } from "@/features/auth/preferences-core";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { holidayNotice, useGetHolidays, type Holiday } from "@/features/workspaces/api/use-holidays";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { Task } from "../types";
import { useUpdateTask } from "../api/use-update-task";
import { useDeleteTask } from "../api/use-delete-task";
import { DropBin, useDropBin } from "@/components/drop-bin";
import { toastWithUndo } from "../api/undo";
import { useCalendarPrefs } from "@/features/auth/hooks/use-calendar-prefs";
import { useCreateTaskModal } from "../hooks/use-create-task-modal";
import { useTaskPanel } from "../hooks/use-task-panel";
import { combineDateAndTime, DEFAULT_DURATION_MINUTES, taskTimeRange, toTimeInput } from "../task-time";
import { CalendarToolbar, type CalendarView } from "./calendar-toolbar";

// Mutable copy: nuqs and react-big-calendar take plain arrays
const CALENDAR_VIEWS = [...VIEW_LIST];
import { IssueCard, TASK_DRAG_TYPE } from "./issue-card";
import { MultipleTasksPopup } from "./multiple-tasks-popup";
import { UnscheduledPanel } from "./unscheduled-panel";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./data-calendar.css";

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    task: Task;
    allDay: boolean;
    // A task with a due date but no time block, drawn over the working day on the week/day grid
    untimed?: boolean;
}

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar);

// A day's cards cascade together: each later one starts a little further right and sits on top of the one before, so
// every card shows (a card hovered pops to the front: data-calendar.css). All-day tasks, which fill the working day,
// are cards like the rest; on a day with a lot of them the cards get narrow, as there is no room for more.
const layoutDay: DayLayoutFunction<CalendarEvent> = (args) => overlap(args);

// Grid row height for one time slot in week/day views
const SLOT_HEIGHT_PX = 44;

const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

// Local midnight of a YYYY-MM-DD day: new Date("yyyy-MM-dd") is UTC and shows a day early west of UTC
const fromDayKey = (key: string) => parse(key, "yyyy-MM-dd", new Date());

// Whole days at the same clock time: how the all-day row reports selections and drops (its days
// start at the calendar's first visible hour, not midnight). A time-grid range stays inside one day.
const isWholeDays = (start: Date, end: Date) => end > start
    && start.getHours() === end.getHours() && start.getMinutes() === end.getMinutes() && start.getSeconds() === end.getSeconds();

// The List view: two weeks from the chosen day
const AGENDA_DAYS = 14;

const title = (date: Date, view: CalendarView, weekStart: 0 | 1 | 6) => {
    if (view === "month") return format(date, "MMMM yyyy");
    if (view === "agenda") {
        const last = addDays(date, AGENDA_DAYS - 1);
        return `${format(date, "MMM d")} – ${format(last, date.getMonth() === last.getMonth() ? "d, yyyy" : "MMM d, yyyy")}`;
    }
    if (view === "day") return format(date, "EEEE, MMM d, yyyy");
    const { start, end } = weekRange(date, weekStart);
    const last = subDays(end, 1);
    return `${format(start, "MMM d")} – ${format(last, start.getMonth() === last.getMonth() ? "d, yyyy" : "MMM d, yyyy")}`;
};

// Timed tasks first, earliest first; then by name
const byTimeThenName = (a: Task, b: Task) =>
    (a.startAt ? new Date(a.startAt).getTime() : Infinity) - (b.startAt ? new Date(b.startAt).getTime() : Infinity)
    || a.name.localeCompare(b.name);

interface DataCalendarProps {
    data: Task[];
    // The dates on screen, [from, to), so only those tasks need loading
    onRangeChange?: (from: Date, to: Date) => void;
    // Every task without a date, when `data` holds only the first of them
    unscheduledTotal?: number;
}

// What the grid shows: whole weeks around the month, the week, or the day
const visibleRange = (date: Date, view: CalendarView, weekStart: 0 | 1 | 6) => {
    if (view === "month") {
        const from = startOfWeek(startOfMonth(date), { weekStartsOn: weekStart });
        return { from, to: addDays(startOfWeek(endOfMonth(date), { weekStartsOn: weekStart }), 7) };
    }
    if (view === "week") {
        const { start, end } = weekRange(date, weekStart);
        return { from: start, to: end };
    }
    const from = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return { from, to: addDays(from, view === "agenda" ? AGENDA_DAYS : 1) };
};

// The view and visible hours come from the account and the workspace: drawing before they arrive
// would redraw the grid (and move what's under the pointer) once they do
export const DataCalendar = (props: DataCalendarProps) => {
    const { isLoading: userLoading } = useCurrent();
    const { isLoading: workspaceLoading } = useGetWorkspace({ workspaceId: useWorkspaceId() });
    if (userLoading || workspaceLoading) return <Skeleton className="h-[600px] w-full rounded-card" />;
    return <ReadyCalendar {...props} />;
};

const ReadyCalendar = ({ data, onRangeChange, unscheduledTotal }: DataCalendarProps) => {
    const [value, setValue] = useState(new Date());
    // Moving to another month/week slides the grid in from that side
    const [gridScope, animateGrid] = useAnimate<HTMLDivElement>();
    const reduceMotion = useReducedMotionConfig();
    const shownAt = useRef(value.getTime());
    useEffect(() => {
        const previous = shownAt.current;
        shownAt.current = value.getTime();
        if (previous === value.getTime() || !gridScope.current) return;
        const from = reduceMotion ? 0 : (value.getTime() > previous ? 1 : -1) * 28;
        animateGrid(gridScope.current, { opacity: [0, 1], x: [from, 0] }, { duration: 0.45, ease: EASE });
    }, [value, reduceMotion, animateGrid, gridScope]);
    const { weekStart, timeFormat, calendarView } = usePreferences();
    // Shareable/refresh-safe view, like the table/kanban/calendar tab; without one, the account's default
    // Phones open the List view unless the link names one: the grids are too cramped there
    const phone = useMediaQuery("(max-width: 639px)", false);
    const [view, setView] = useQueryState("cal", parseAsStringEnum<CalendarView>(CALENDAR_VIEWS).withDefault(phone ? "agenda" : calendarView));
    // Week and day: the time grid, where tasks are dragged and resized
    const grid = view === "week" || view === "day";
    // Week on a phone scrolls sideways (data-calendar.css): bring today's column into view, not Saturday's
    useEffect(() => {
        if (!phone || view !== "week") return;
        const frame = requestAnimationFrame(() => {
            const timeView = gridScope.current?.querySelector<HTMLElement>(".rbc-time-view");
            const today = timeView?.querySelector<HTMLElement>(".rbc-header.rbc-today");
            if (!timeView || !today) return;
            const gutter = timeView.querySelector(".rbc-time-header-gutter")?.getBoundingClientRect().width ?? 0;
            timeView.scrollLeft += today.getBoundingClientRect().left - timeView.getBoundingClientRect().left - gutter;
        });
        return () => cancelAnimationFrame(frame);
    }, [phone, view, value, gridScope]);
    const { prefs, update: updatePrefs } = useCalendarPrefs();
    useEffect(() => {
        if (!onRangeChange) return;
        const { from, to } = visibleRange(value, view, weekStart);
        onRangeChange(from, to);
    }, [value, view, weekStart, onRangeChange]);
    const hour12 = timeFormat === "12h";
    const { open: openCreateTask } = useCreateTaskModal();
    const { open: openTask } = useTaskPanel();
    const workspaceId = useWorkspaceId();
    const { canEditWork } = usePermissions({ workspaceId });
    const { mutate: updateTask } = useUpdateTask({ quiet: true });

    // Moves a task on the calendar, with an Undo that puts its date and time back
    const reschedule = (task: Task, json: { dueDate: Date | null; startAt?: string | null; durationMinutes?: number | null }) => {
        const before = {
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            startAt: task.startAt ?? null,
            durationMinutes: task.durationMinutes ?? null,
        };
        updateTask({ param: { taskId: task.$id }, json }, {
            onSuccess: () => toastWithUndo(
                before.dueDate ? "Task moved" : "Task scheduled",
                () => updateTask({ param: { taskId: task.$id }, json: before }),
            ),
        });
    };
    // Only admins may change due dates (the API ignores it for members)
    const canReschedule = Boolean(canEditWork);
    const [dropDate, setDropDate] = useState<string | null>(null);
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);
    const [dayPopup, setDayPopup] = useState<{ tasks: Task[]; date: Date; position: { x: number; y: number } } | null>(null);

    // The bin (for people who may delete). Month cards and the Unscheduled panel use the browser's
    // own drag, so the bin is a normal drop target for them; the week/day grid's drags are the
    // calendar's own, so there it's found by the pointer's position when the drag ends.
    const { mutate: deleteTask } = useDeleteTask();
    const [nativeDragging, setNativeDragging] = useState(false);
    const [gridDragging, setGridDragging] = useState(false);
    const [overBin, setOverBin] = useState(false);
    const binRef = useRef<HTMLDivElement>(null);
    // Set when a grid drag ends on the bin, so the calendar's own drop doesn't also move it
    const droppedInBin = useRef(false);
    const { bin } = useDropBin((taskId) => {
        setNativeDragging(false);
        deleteTask({ param: { taskId } });
    }, TASK_DRAG_TYPE);
    // The calendar reports a drag on mouse-down, before any move. Nothing renders until the pointer
    // really moves: a render mid-click rebuilt the card under it, and the click (open) was lost.
    const beginGridDrag = (task: Task) => {
        const origin = { ...pointer.current };
        let moving = false;
        const onBin = (event: PointerEvent) => {
            const box = binRef.current?.getBoundingClientRect();
            return Boolean(box && event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom);
        };
        const onMove = (event: PointerEvent) => {
            if (!moving && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 5) return;
            if (!moving) setGridDragging(true);
            moving = true;
            setOverBin(onBin(event));
        };
        const onUp = (event: PointerEvent) => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            if (!moving) return;
            if (onBin(event)) {
                droppedInBin.current = true;
                setTimeout(() => { droppedInBin.current = false; }, 0);
                deleteTask({ param: { taskId: task.$id } });
            }
            setGridDragging(false);
            setOverBin(false);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };
    const pointer = useRef({ x: 0, y: 0 });

    const localizer = useMemo(() => dateFnsLocalizer({
        format,
        parse,
        startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: weekStart }),
        getDay,
        locales: { "en-US": enUS },
    }), [weekStart]);

    // Holidays for the shown month and its neighbours (covers the leading/trailing weeks)
    const { data: holidayData } = useGetHolidays({
        workspaceId,
        from: dayKey(startOfMonth(subMonths(value, 1))),
        to: dayKey(endOfMonth(addMonths(value, 1))),
    });
    const holidaysByDay = useMemo(
        () => new Map((holidayData?.holidays ?? []).map((holiday) => [holiday.date, holiday] as [string, Holiday])),
        [holidayData],
    );
    const weekend = useMemo(() => new Set(holidayData?.weekend ?? []), [holidayData]);

    const warnIfHoliday = (date: Date) => {
        const notice = holidayNotice(holidayData?.holidays, dayKey(date));
        if (notice) toast.warning(notice);
    };

    const handleNavigate = (action: "PREV" | "NEXT" | "TODAY") => {
        const step = { month: [subMonths, addMonths], week: [subWeeks, addWeeks], day: [subDays, addDays], agenda: [subDays, addDays] }[view];
        setValue(action === "TODAY" ? new Date() : step[action === "PREV" ? 0 : 1](value, view === "agenda" ? AGENDA_DAYS : 1));
    };

    const scheduled = useMemo(() => data.filter((task) => task.dueDate), [data]);
    const unscheduled = useMemo(() => data.filter((task) => !task.dueDate).sort((a, b) => a.name.localeCompare(b.name)), [data]);

    // One event per task: timed tasks as blocks; the rest on their due date (month) or across it (week/day)
    const events: CalendarEvent[] = useMemo(() => [...scheduled].sort(byTimeThenName).map((task) => {
        const range = task.startAt ? taskTimeRange(task.startAt, task.durationMinutes) : null;
        if (range) {
            const { start } = range;
            // Ending exactly at the next midnight, the calendar would move it to the all-day row;
            // drawn a minute short, it stays in the time slots (the task keeps its real end)
            let end = range.end.getHours() === 0 && range.end.getMinutes() === 0 && range.end > start
                ? new Date(range.end.getTime() - 60_000) : range.end;
            // Running past midnight, the calendar would also move it to the all-day row as a two-day bar, unlike every
            // other timed task; in the time grid it is drawn to the end of its own day (month and list show it as is)
            const endOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1).getTime() - 60_000;
            if ((view === "week" || view === "day") && end.getTime() > endOfDay) end = new Date(endOfDay);
            // Month view places events by their day; keep timed ones on the due date's cell
            return { id: task.$id, title: task.name, start, end, task, allDay: false };
        }
        const day = fromDayKey(dayKey(new Date(task.dueDate)));
        if (view === "month" || view === "agenda") return { id: task.$id, title: task.name, start: day, end: day, task, allDay: true };
        // Week/day: in the timeline, across the working day (or the visible hours, if it's outside them)
        const at = (hours: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, Math.round(hours * 60));
        const from = Math.max(prefs.workDay.start, prefs.startHour);
        const to = Math.min(prefs.workDay.end, prefs.endHour);
        const [startH, endH] = from < to ? [from, to] : [prefs.startHour, prefs.endHour];
        // A minute short of midnight, like timed blocks, to stay out of the all-day row
        return { id: task.$id, title: task.name, start: at(startH), end: at(endH === 24 ? 24 - 1 / 60 : endH), task, allDay: false, untimed: true };
    }), [scheduled, view, prefs.workDay.start, prefs.workDay.end, prefs.startHour, prefs.endHour]);

    // Week/day grid bounds from the visible-hours setting
    const min = new Date(1970, 0, 1, prefs.startHour);
    const max = prefs.endHour === 24 ? new Date(1970, 0, 1, 23, 59, 59) : new Date(1970, 0, 1, prefs.endHour);
    const slots = ((prefs.endHour - prefs.startHour) * 60) / prefs.slotMinutes;
    const gridHeight = Math.max(360, Math.min(slots * SLOT_HEIGHT_PX, 1600));
    const now = new Date();
    const scrollToTime = new Date(1970, 0, 1, Math.max(prefs.startHour, Math.min(8, prefs.endHour - 1)));

    // Drag/resize in week & day views: a drop on the all-day row clears the time
    const moveTask = ({ event, start, end, isAllDay }: EventInteractionArgs<CalendarEvent>) => {
        if (!canReschedule || droppedInBin.current) return;
        const startDate = new Date(start);
        const day = fromDayKey(dayKey(startDate));
        warnIfHoliday(day);

        // A whole-day block only changes day; a time is set in the task itself
        if (isAllDay || event.untimed) {
            reschedule(event.task, { dueDate: day, startAt: null, durationMinutes: null });
            return;
        }
        // To 5 minutes: a task ending at midnight is drawn a minute short (see events), and a move
        // keeps its real length. A block drawn shorter than the task (one that runs past midnight is drawn to
        // the end of its day) must not pass that length on: when its length is unchanged it was only moved,
        // so the task's own stays; a resize changes the length and takes the new one.
        const drawn = event.end.getTime() - event.start.getTime();
        const dropped = new Date(end).getTime() - startDate.getTime();
        const real = event.task.durationMinutes;
        const minutes = real && Math.abs(dropped - drawn) < 60_000
            ? real
            : Math.max(prefs.slotMinutes, Math.round(dropped / 300_000) * 5);
        reschedule(event.task, {
            dueDate: day,
            startAt: startDate.toISOString(),
            // An all-day task moved to a time gets the default length
            durationMinutes: event.allDay ? Math.max(DEFAULT_DURATION_MINUTES, prefs.slotMinutes) : minutes,
        });
    };

    // Unscheduled task dropped on the week/day grid (react-big-calendar's outside-drag support).
    // The all-day row reports allDay: false with start..start + 1 day, hence isWholeDays. A drop on
    // that row can also reach the time column scrolled out of view beneath it, so one drop may call
    // this twice in the same tick: collect both and let the all-day one win.
    const pendingDrop = useRef<{ start: Date; allDay: boolean } | null>(null);
    const scheduleFromOutside = ({ start, end, allDay }: { start: string | Date; end: string | Date; allDay: boolean }) => {
        const drop = { start: new Date(start), allDay: allDay || isWholeDays(new Date(start), new Date(end)) };
        const first = pendingDrop.current === null;
        if (first || drop.allDay) pendingDrop.current = drop;
        if (!first) return;
        const task = draggedTask;
        setTimeout(() => {
            const { start: startDate, allDay: wholeDay } = pendingDrop.current!;
            pendingDrop.current = null;
            setDraggedTask(null);
            if (!task || !canReschedule) return;
            const day = fromDayKey(dayKey(startDate));
            warnIfHoliday(day);
            reschedule(task, wholeDay
                ? { dueDate: day, startAt: null, durationMinutes: null }
                : { dueDate: day, startAt: startDate.toISOString(), durationMinutes: task.durationMinutes ?? Math.max(DEFAULT_DURATION_MINUTES, prefs.slotMinutes) });
        });
    };

    // Month view: the day under the pointer (elementsFromPoint sees through the event layer)
    const dateAtPoint = (x: number, y: number) =>
        document.elementsFromPoint(x, y)
            .map((el) => (el as HTMLElement).dataset?.date)
            .find(Boolean);

    const onDragOver = (e: React.DragEvent) => {
        if (view !== "month" || !canReschedule || !e.dataTransfer.types.includes(TASK_DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const date = dateAtPoint(e.clientX, e.clientY) ?? null;
        if (date !== dropDate) setDropDate(date);
    };

    const onDrop = (e: React.DragEvent) => {
        if (view !== "month") return;
        const taskId = e.dataTransfer.getData(TASK_DRAG_TYPE);
        const date = dateAtPoint(e.clientX, e.clientY);
        setDropDate(null);
        setDraggedTask(null);
        if (!canReschedule || !taskId || !date) return;
        e.preventDefault();

        const task = data.find((t) => t.$id === taskId);
        if (task?.dueDate && dayKey(new Date(task.dueDate)) === date) return;

        // Same convention as the date pickers: local midnight of the chosen day; a timed
        // task keeps its time of day on the new date
        const day = fromDayKey(date);
        warnIfHoliday(day);
        if (!task) return;
        const startAt = task.startAt ? combineDateAndTime(day, toTimeInput(task.startAt)) : undefined;
        reschedule(task, { dueDate: day, ...(startAt ? { startAt } : {}) });
    };

    const openDayPopup = (date: Date) => {
        const key = dayKey(date);
        const tasks = scheduled.filter((task) => dayKey(new Date(task.dueDate)) === key).sort(byTimeThenName);
        const { innerWidth: width, innerHeight: height } = window;
        setDayPopup({
            tasks,
            date,
            position: {
                x: Math.max(8, Math.min(pointer.current.x - 40, width - 520)),
                y: Math.max(8, Math.min(pointer.current.y + 8, height - 520)),
            },
        });
    };

    // Month cell header: holiday name on the left, the day number on the right
    const MonthDateHeader = ({ date, label, onDrillDown }: DateHeaderProps) => {
        const holiday = holidaysByDay.get(dayKey(date));
        return (
            <div className="flex items-center justify-between gap-1 px-1">
                {holiday ? <span className="holiday-label truncate" title={holiday.name}>{holiday.name}</span> : <span />}
                <button type="button" className="rbc-button-link" onClick={onDrillDown}>{label}</button>
            </div>
        );
    };

    // Why a day is off: a holiday, or the workspace's weekend
    const dayOff = (date: Date) => {
        const holiday = holidaysByDay.get(dayKey(date));
        return holiday
            ? { name: holiday.name, title: `${holiday.source === "public" ? "Public holiday" : "Workspace day off"}: ${holiday.name}` }
            : weekend.has(date.getDay()) ? { name: "Weekend", title: "Weekend" } : null;
    };

    // Week/day column header: weekday + date (the reason a day is off sits in the all-day strip below)
    const TimeHeader = ({ date, label }: { date: Date; label: ReactNode }) => {
        const off = dayOff(date);
        return (
            <div className="flex flex-col items-center leading-tight" title={off?.title}>
                <span className="hidden sm:inline">{label}</span>
                {/* Phones: a week's seven columns are narrow, so the day's letter over its date; a day off is a red date */}
                <span className="flex flex-col items-center sm:hidden" aria-label={typeof label === "string" ? label : undefined}>
                    <span>{format(date, "EEEEE")}</span>
                    <span className={cn("font-semibold", off && "text-destructive")}>{format(date, "d")}</span>
                </span>
            </div>
        );
    };

    return (
        <div
            className="flex w-full flex-col rounded-lg border bg-background"
            // Month cards and Unscheduled cards: show the bin while one is dragged (capture: the
            // cards stop their dragstart from bubbling)
            onDragStartCapture={(e) => { if (canEditWork && (e.target as Element).closest?.("[data-task-id][draggable=true]")) setNativeDragging(true); }}
            onDragEndCapture={() => setNativeDragging(false)}
        >
            <div className="border-b px-3 py-2">
                <CalendarToolbar
                    title={title(value, view, weekStart)}
                    view={view}
                    onView={setView}
                    onNavigate={handleNavigate}
                    prefs={prefs}
                    onPrefs={updatePrefs}
                    unscheduledCount={Math.max(unscheduled.length, unscheduledTotal ?? 0)}
                    hour12={hour12}
                />
            </div>
            <div className="flex flex-col lg:flex-row">
                <div
                    ref={gridScope}
                    className="min-w-0 flex-1 overflow-x-auto p-1 sm:p-2"
                    onPointerDownCapture={(e) => { pointer.current = { x: e.clientX, y: e.clientY }; }}
                    // The calendar's own event box is the focus stop and only opens on a click; Enter opens it too
                    // (capture: the calendar stops key events on its events)
                    onKeyDownCapture={(e) => {
                        const id = e.key === "Enter" && (e.target as Element).closest(".rbc-event")?.querySelector("[data-task-id]")?.getAttribute("data-task-id");
                        if (!id) return;
                        // Kept from the calendar, which would otherwise close the panel straight away
                        e.preventDefault();
                        e.stopPropagation();
                        openTask(id);
                    }}
                    onDragOver={onDragOver}
                    onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropDate(null);
                    }}
                    onDrop={onDrop}
                >
                    <DnDCalendar
                        localizer={localizer}
                        culture="en-US"
                        date={value}
                        onNavigate={setValue}
                        view={view}
                        onView={(next) => setView(next as CalendarView)}
                        events={events}
                        views={CALENDAR_VIEWS}
                        toolbar={false}
                        // "+N more" when a day is full; it opens the day's list instead of the Day view
                        showAllEvents={false}
                        popup={false}
                        doShowMoreDrillDown={false}
                        onShowMore={(_, date) => openDayPopup(date)}
                        className={cn("calendar-container", `calendar-view-${view}`)}
                        style={{ height: view === "month" ? 920 : view === "agenda" ? 640 : gridHeight }}
                        length={AGENDA_DAYS}
                        messages={{ noEventsInRange: "No tasks in these two weeks." }}
                        step={prefs.slotMinutes}
                        timeslots={1}
                        min={min}
                        max={max}
                        scrollToTime={scrollToTime}
                        getNow={() => now}
                        // Week/day: drag blocks to move, drag the bottom edge to resize (admins)
                        draggableAccessor={() => grid && canReschedule}
                        resizable
                        dayLayoutAlgorithm={layoutDay}
                        eventPropGetter={(event) => ({ className: event.untimed ? "untimed" : undefined })}
                        resizableAccessor={(event) => grid && canReschedule && !event.allDay && !event.untimed}
                        onEventDrop={moveTask}
                        onDragStart={({ event, action }) => { if (action === "move" && canEditWork) beginGridDrag(event.task); }}
                        onEventResize={moveTask}
                        // Typed as an accessor, but react-big-calendar calls it for the dragged event itself
                        dragFromOutsideItem={grid && draggedTask
                            ? (() => ({ id: draggedTask.$id, title: draggedTask.name, start: new Date(), end: new Date(), task: draggedTask, allDay: false })) as unknown as () => keyof CalendarEvent
                            : undefined}
                        onDropFromOutside={grid ? scheduleFromOutside : undefined}
                        onSelectEvent={(event) => openTask(event.task.$id)}
                        selectable={canEditWork}
                        onSelectSlot={(slotInfo) => {
                            if (!canEditWork) return;
                            // Selections in the time slots come with a box (click) or bounds (drag); the
                            // all-day row's don't. A whole day selected in the slots stays a timed task.
                            const fromAllDayRow = !slotInfo.box && !slotInfo.bounds;
                            if (view === "month" || fromAllDayRow) {
                                // A day (month cell or all-day row): new all-day task on it
                                warnIfHoliday(slotInfo.start);
                                openCreateTask(undefined, { start: slotInfo.start, durationMinutes: 0 });
                                return;
                            }
                            // Dragging across empty time creates a task with that time block
                            warnIfHoliday(slotInfo.start);
                            const minutes = Math.max(prefs.slotMinutes, Math.round((slotInfo.end.getTime() - slotInfo.start.getTime()) / 60_000));
                            openCreateTask(undefined, { start: slotInfo.start, durationMinutes: minutes });
                        }}
                        dayPropGetter={(date) => {
                            const key = dayKey(date);
                            return {
                                className: cn(
                                    holidaysByDay.has(key) && "rbc-holiday",
                                    !holidaysByDay.has(key) && weekend.has(date.getDay()) && "rbc-weekend",
                                    key === dropDate && "rbc-drop-target",
                                ),
                            };
                        }}
                        formats={{
                            weekdayFormat: (date: Date) => format(date, "EEE"),
                            dayFormat: (date: Date) => format(date, "EEE d"),
                            timeGutterFormat: (date: Date) => format(date, hour12 ? "h:mm a" : "HH:mm"),
                            eventTimeRangeFormat: () => "",
                        }}
                        components={{
                            // Tag each day cell with its date so drops can find it. Week/day: these cells are
                            // the all-day strip, which says why a day is off
                            dateCellWrapper: ({ children, value: cellDate }) => {
                                if (!isValidElement(children)) return <>{children}</>;
                                const off = view === "month" ? null : dayOff(cellDate);
                                return cloneElement(children as ReactElement, {
                                    "data-date": dayKey(cellDate),
                                    ...(off && { children: <span className="holiday-label day-off-label" title={off.title}>{off.name}</span> }),
                                } as Record<string, unknown>);
                            },
                            month: { dateHeader: MonthDateHeader },
                            week: { header: TimeHeader },
                            day: { header: TimeHeader },
                            event: ({ event }) => (
                                <IssueCard
                                    task={event.task}
                                    variant={view === "month" || view === "agenda" ? "month" : event.allDay ? "allday" : "block"}
                                    // Under about 1.5 grid rows there's only room for one line
                                    compact={!event.allDay && !event.untimed && (event.end.getTime() - event.start.getTime()) / 60_000 < prefs.slotMinutes * 1.5}
                                    // Month cards use native drag (onto another day); the grid uses the calendar's own
                                    draggable={view === "month" && canReschedule}
                                    onOpen={view === "month" || view === "agenda" ? openTask : undefined}
                                />
                            ),
                        }}
                    />
                </div>
                {prefs.showUnscheduled && (
                    <UnscheduledPanel
                        tasks={unscheduled}
                        total={unscheduledTotal}
                        canSchedule={canReschedule}
                        onOpen={openTask}
                        onDragStart={setDraggedTask}
                        onDragEnd={() => setDraggedTask(null)}
                        onClose={() => updatePrefs({ showUnscheduled: false })}
                    />
                )}
            </div>

            <MultipleTasksPopup
                tasks={dayPopup?.tasks ?? []}
                date={dayPopup?.date ?? value}
                isOpen={dayPopup !== null}
                onClose={() => setDayPopup(null)}
                position={dayPopup?.position ?? { x: 0, y: 0 }}
            />
            {canEditWork && (
                <DropBin ref={binRef} {...bin} visible={nativeDragging || gridDragging} over={bin.over || overBin} label="Drop to delete" />
            )}
        </div>
    );
};
