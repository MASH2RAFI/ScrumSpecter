import { cloneElement, isValidElement, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useAnimate, useReducedMotion } from "motion/react";
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
import { Calendar, dateFnsLocalizer, type DateHeaderProps } from "react-big-calendar";
import withDragAndDrop, { type EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { toast } from "sonner";

import { EASE } from "@/components/motion";
import { cn } from "@/lib/utils";
import { weekRange } from "@/lib/week";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { holidayNotice, useGetHolidays, type Holiday } from "@/features/workspaces/api/use-holidays";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { Task } from "../types";
import { useUpdateTask } from "../api/use-update-task";
import { toastWithUndo } from "../api/undo";
import { useCalendarPrefs } from "../hooks/use-calendar-prefs";
import { useCreateTaskModal } from "../hooks/use-create-task-modal";
import { useTaskPanel } from "../hooks/use-task-panel";
import { combineDateAndTime, DEFAULT_DURATION_MINUTES, taskTimeRange, toTimeInput } from "../task-time";
import { CALENDAR_VIEWS, CalendarToolbar, type CalendarView } from "./calendar-toolbar";
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
}

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar);

// Grid row height for one time slot in week/day views
const SLOT_HEIGHT_PX = 44;

const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

// Local midnight of a YYYY-MM-DD day: new Date("yyyy-MM-dd") is UTC and shows a day early west of UTC
const fromDayKey = (key: string) => parse(key, "yyyy-MM-dd", new Date());

const title = (date: Date, view: CalendarView, weekStart: 0 | 1 | 6) => {
    if (view === "month") return format(date, "MMMM yyyy");
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
    return { from, to: addDays(from, 1) };
};

export const DataCalendar = ({ data, onRangeChange }: DataCalendarProps) => {
    const [value, setValue] = useState(new Date());
    // Moving to another month/week slides the grid in from that side
    const [gridScope, animateGrid] = useAnimate<HTMLDivElement>();
    const reduceMotion = useReducedMotion();
    const shownAt = useRef(value.getTime());
    useEffect(() => {
        const previous = shownAt.current;
        shownAt.current = value.getTime();
        if (previous === value.getTime() || !gridScope.current) return;
        const from = reduceMotion ? 0 : (value.getTime() > previous ? 1 : -1) * 28;
        animateGrid(gridScope.current, { opacity: [0, 1], x: [from, 0] }, { duration: 0.45, ease: EASE });
    }, [value, reduceMotion, animateGrid, gridScope]);
    // Shareable/refresh-safe view, like the table/kanban/calendar tab
    const [view, setView] = useQueryState("cal", parseAsStringEnum<CalendarView>(CALENDAR_VIEWS).withDefault("month"));
    const { prefs, update: updatePrefs } = useCalendarPrefs();
    const { weekStart, timeFormat } = usePreferences();
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
        const step = { month: [subMonths, addMonths], week: [subWeeks, addWeeks], day: [subDays, addDays] }[view];
        setValue(action === "TODAY" ? new Date() : step[action === "PREV" ? 0 : 1](value, 1));
    };

    const scheduled = useMemo(() => data.filter((task) => task.dueDate), [data]);
    const unscheduled = useMemo(() => data.filter((task) => !task.dueDate).sort((a, b) => a.name.localeCompare(b.name)), [data]);

    // One event per task: timed tasks as blocks, the rest all day on their due date
    const events: CalendarEvent[] = useMemo(() => [...scheduled].sort(byTimeThenName).map((task) => {
        if (task.startAt) {
            const { start, end } = taskTimeRange(task.startAt, task.durationMinutes);
            // Month view places events by their day; keep timed ones on the due date's cell
            return { id: task.$id, title: task.name, start, end, task, allDay: false };
        }
        const day = fromDayKey(dayKey(new Date(task.dueDate)));
        return { id: task.$id, title: task.name, start: day, end: day, task, allDay: true };
    }), [scheduled]);

    // Week/day grid bounds from the visible-hours setting
    const min = new Date(1970, 0, 1, prefs.startHour);
    const max = prefs.endHour === 24 ? new Date(1970, 0, 1, 23, 59, 59) : new Date(1970, 0, 1, prefs.endHour);
    const slots = ((prefs.endHour - prefs.startHour) * 60) / prefs.slotMinutes;
    const gridHeight = Math.max(360, Math.min(slots * SLOT_HEIGHT_PX, 1600));
    const now = new Date();
    const scrollToTime = new Date(1970, 0, 1, Math.max(prefs.startHour, Math.min(8, prefs.endHour - 1)));

    // Drag/resize in week & day views: a drop on the all-day row clears the time
    const moveTask = ({ event, start, end, isAllDay }: EventInteractionArgs<CalendarEvent>) => {
        if (!canReschedule) return;
        const startDate = new Date(start);
        const day = fromDayKey(dayKey(startDate));
        warnIfHoliday(day);

        if (isAllDay) {
            reschedule(event.task, { dueDate: day, startAt: null, durationMinutes: null });
            return;
        }
        const minutes = Math.max(prefs.slotMinutes, Math.round((new Date(end).getTime() - startDate.getTime()) / 60_000));
        reschedule(event.task, {
            dueDate: day,
            startAt: startDate.toISOString(),
            // An all-day task dropped into the grid gets the default length
            durationMinutes: event.allDay ? Math.max(DEFAULT_DURATION_MINUTES, prefs.slotMinutes) : minutes,
        });
    };

    // Unscheduled task dropped on the week/day grid (react-big-calendar's outside-drag support)
    const scheduleFromOutside = ({ start, allDay }: { start: string | Date; allDay: boolean }) => {
        const task = draggedTask;
        setDraggedTask(null);
        if (!task || !canReschedule) return;
        const startDate = new Date(start);
        const day = fromDayKey(dayKey(startDate));
        warnIfHoliday(day);
        reschedule(task, allDay
            ? { dueDate: day, startAt: null, durationMinutes: null }
            : { dueDate: day, startAt: startDate.toISOString(), durationMinutes: task.durationMinutes ?? Math.max(DEFAULT_DURATION_MINUTES, prefs.slotMinutes) });
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

    // Week/day column header: weekday + date, and the holiday name under it
    const TimeHeader = ({ date, label }: { date: Date; label: ReactNode }) => {
        const holiday = holidaysByDay.get(dayKey(date));
        return (
            <div className="flex flex-col items-center leading-tight">
                <span>{label}</span>
                {holiday && <span className="holiday-label truncate max-w-full" title={holiday.name}>{holiday.name}</span>}
            </div>
        );
    };

    return (
        <div className="flex w-full flex-col rounded-lg border bg-background">
            <div className="border-b px-3 py-2">
                <CalendarToolbar
                    title={title(value, view, weekStart)}
                    view={view}
                    onView={setView}
                    onNavigate={handleNavigate}
                    prefs={prefs}
                    onPrefs={updatePrefs}
                    unscheduledCount={unscheduled.length}
                    hour12={hour12}
                />
            </div>
            <div className="flex flex-col lg:flex-row">
                <div
                    ref={gridScope}
                    className="min-w-0 flex-1 overflow-x-auto p-1 sm:p-2"
                    onPointerDownCapture={(e) => { pointer.current = { x: e.clientX, y: e.clientY }; }}
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
                        style={{ height: view === "month" ? 920 : gridHeight }}
                        step={prefs.slotMinutes}
                        timeslots={1}
                        min={min}
                        max={max}
                        scrollToTime={scrollToTime}
                        getNow={() => now}
                        // Week/day: drag blocks to move, drag the bottom edge to resize (admins)
                        draggableAccessor={() => view !== "month" && canReschedule}
                        resizable
                        resizableAccessor={(event) => view !== "month" && canReschedule && !event.allDay}
                        onEventDrop={moveTask}
                        onEventResize={moveTask}
                        // Typed as an accessor, but react-big-calendar calls it for the dragged event itself
                        dragFromOutsideItem={view !== "month" && draggedTask
                            ? (() => ({ id: draggedTask.$id, title: draggedTask.name, start: new Date(), end: new Date(), task: draggedTask, allDay: false })) as unknown as () => keyof CalendarEvent
                            : undefined}
                        onDropFromOutside={view !== "month" ? scheduleFromOutside : undefined}
                        onSelectEvent={(event) => openTask(event.task.$id)}
                        selectable={canEditWork}
                        onSelectSlot={(slotInfo) => {
                            if (!canEditWork) return;
                            if (view === "month" || slotInfo.action === "click" && slotInfo.slots.length === 1 && slotInfo.start.getHours() === 0 && slotInfo.start.getMinutes() === 0) {
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
                            // Tag each day cell with its date so drops can find it
                            dateCellWrapper: ({ children, value: cellDate }) => isValidElement(children)
                                ? cloneElement(children as ReactElement, { "data-date": dayKey(cellDate) } as Record<string, unknown>)
                                : <>{children}</>,
                            month: { dateHeader: MonthDateHeader },
                            week: { header: TimeHeader },
                            day: { header: TimeHeader },
                            event: ({ event }) => (
                                <IssueCard
                                    task={event.task}
                                    variant={view === "month" ? "month" : event.allDay ? "allday" : "block"}
                                    // Under about 1.5 grid rows there's only room for one line
                                    compact={!event.allDay && (event.end.getTime() - event.start.getTime()) / 60_000 < prefs.slotMinutes * 1.5}
                                    // Month cards use native drag (onto another day); the grid uses the calendar's own
                                    draggable={view === "month" && canReschedule}
                                    onOpen={view === "month" ? openTask : undefined}
                                />
                            ),
                        }}
                    />
                </div>
                {prefs.showUnscheduled && (
                    <UnscheduledPanel
                        tasks={unscheduled}
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
        </div>
    );
};
