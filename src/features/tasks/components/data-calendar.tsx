import { cloneElement, isValidElement, useMemo, useState, type ReactElement } from "react";
import {
    format,
    getDay,
    parse,
    startOfWeek,
    addDays,
    addMonths,
    addWeeks,
    endOfWeek,
    subDays,
    subMonths,
    subWeeks,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import withDragAndDrop, { type EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, RepeatIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Task } from "../types";
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useUpdateTask } from "../api/use-update-task";
import { useCreateTaskModal } from "../hooks/use-create-task-modal";
import { useTaskPanel } from "../hooks/use-task-panel";
import { combineDateAndTime, DEFAULT_DURATION_MINUTES, formatTime, formatTimeRange, taskTimeRange, toTimeInput } from "../task-time";
import { EventCard, TASK_DRAG_TYPE } from "./event-card";
import { GroupedEventCard } from "./grouped-event-card";
import { TaskDropdown } from "./task-dropdown";
import { MultipleTasksPopup } from "./multiple-tasks-popup";
import { pluralize } from "./calendar-utils";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./data-calendar.css";

const locales = {
    "en-US": enUS
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales
});

interface DataCalendarProps {
    data: Task[];
};

interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    // Month view groups a day's tasks; week/day views have one event per task
    tasks: Task[];
    isGrouped: boolean;
    task?: Task;
    allDay?: boolean;
}

type CalendarView = "month" | "week" | "day";
const CALENDAR_VIEWS: CalendarView[] = ["month", "week", "day"];

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar);

const toolbarTitle = (date: Date, view: CalendarView) => {
    if (view === "month") return format(date, "MMMM yyyy", { locale: enUS });
    if (view === "day") return format(date, "EEEE, MMM d, yyyy", { locale: enUS });
    const start = startOfWeek(date, { locale: enUS });
    const end = endOfWeek(date, { locale: enUS });
    return `${format(start, "MMM d", { locale: enUS })} – ${format(end, start.getMonth() === end.getMonth() ? "d, yyyy" : "MMM d, yyyy", { locale: enUS })}`;
};

interface CustomToolbarProps {
    date: Date;
    view: CalendarView;
    onView: (view: CalendarView) => void;
    onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
};

const CustomToolbar = ({ date, view, onView, onNavigate }: CustomToolbarProps) => {
    const currentMonth = toolbarTitle(date, view);
    const isToday = view === "month"
        ? format(new Date(), "yyyy-MM") === format(date, "yyyy-MM")
        : view === "week"
            ? format(startOfWeek(new Date()), "yyyy-MM-dd") === format(startOfWeek(date), "yyyy-MM-dd")
            : format(new Date(), "yyyy-MM-dd") === format(date, "yyyy-MM-dd");

    return (
        <div className="flex flex-col gap-3 sm:gap-4">
            {/* Mobile: Stacked layout, Desktop: Side by side */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 rounded-unified bg-primary/10 text-primary shadow-unified">
                        <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-foreground">{currentMonth}</h2>
                        {isToday && (
                            <p className="text-xs sm:text-sm text-muted-foreground">Current {view}</p>
                        )}
                    </div>
                </div>
                <div className="inline-flex rounded-md border bg-muted/40 p-0.5" role="group" aria-label="Calendar view">
                    {CALENDAR_VIEWS.map((option) => (
                        <Button
                            key={option}
                            size="sm"
                            variant={view === option ? "primary" : "ghost"}
                            aria-pressed={view === option}
                            onClick={() => onView(option)}
                            className="h-8 px-3 capitalize"
                        >
                            {option}
                        </Button>
                    ))}
                </div>
            </div>
            
            {/* Navigation buttons - full width on mobile */}
            <div className="flex items-center justify-between gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate("PREV")}
                    className="transition-unified flex-1 sm:flex-none min-h-[44px] sm:min-h-[32px]"
                >
                    <ChevronLeftIcon className="h-4 w-4 mr-1 sm:mr-0" />
                    <span className="sm:hidden">Prev</span>
                </Button>
                <Button
                    variant={isToday ? "primary" : "outline"}
                    size="sm"
                    onClick={() => onNavigate("TODAY")}
                    className="transition-unified flex-1 sm:flex-none min-h-[44px] sm:min-h-[32px]"
                >
                    Today
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate("NEXT")}
                    className="transition-unified flex-1 sm:flex-none min-h-[44px] sm:min-h-[32px]"
                >
                    <span className="sm:hidden">Next</span>
                    <ChevronRightIcon className="h-4 w-4 ml-1 sm:ml-0" />
                </Button>
            </div>
        </div>
    );
};

// Week/day view block: name + time; click opens the side panel (handled by onSelectEvent)
const TimeBlockCard = ({ task, allDay }: { task: Task; allDay: boolean }) => (
    <div className="h-full w-full overflow-hidden px-1.5 py-1 leading-tight">
        <p className="truncate text-xs font-semibold">
            {task.routineId && <RepeatIcon className="inline size-3 mr-1 -mt-0.5" aria-label="Routine" />}
            {task.name}
        </p>
        {!allDay && task.startAt && (
            <p className="truncate text-[11px] opacity-80">{formatTimeRange(task.startAt, task.durationMinutes)}</p>
        )}
    </div>
);

type PopupPosition = { x: number; y: number };

interface PopupState {
    isOpen: boolean;
    tasks: Task[];
    date: Date;
    position: PopupPosition;
}

const closedPopup = (): PopupState => ({
    isOpen: false,
    tasks: [],
    date: new Date(),
    position: { x: 0, y: 0 },
});

const getViewport = () => ({
    width: window.innerWidth,
    height: window.innerHeight,
    isMobile: window.innerWidth < 640,
    isTablet: window.innerWidth >= 640 && window.innerWidth < 1024,
});

export const DataCalendar = ({
    data,
}: DataCalendarProps) => {
    const [value, setValue] = useState(new Date());
    // Shareable/refresh-safe view, like the table/kanban/calendar tab
    const [view, setView] = useQueryState("cal", parseAsStringEnum<CalendarView>(CALENDAR_VIEWS).withDefault("month"));
    const { open: openCreateTask } = useCreateTaskModal();
    const { open: openTask } = useTaskPanel();
    const workspaceId = useWorkspaceId();
    const { isAdmin } = useIsAdmin({ workspaceId });
    const { mutate: updateTask } = useUpdateTask();
    // Only admins may change due dates (the API ignores it for members)
    const canReschedule = Boolean(isAdmin);
    const [dropDate, setDropDate] = useState<string | null>(null);
    const [dropdownState, setDropdownState] = useState<PopupState>(closedPopup);
    const [popupState, setPopupState] = useState<PopupState>(closedPopup);

    const handleNavigate = (action: "PREV" | "NEXT" | "TODAY") => {
        const step = { month: [subMonths, addMonths], week: [subWeeks, addWeeks], day: [subDays, addDays] }[view];
        switch (action) {
            case "PREV":
                setValue(step[0](value, 1));
                break;
            case "NEXT":
                setValue(step[1](value, 1));
                break;
            case "TODAY":
                setValue(new Date());
                break;
        }
    };

    const closeAll = () => {
        setDropdownState(prev => ({ ...prev, isOpen: false }));
        setPopupState(prev => ({ ...prev, isOpen: false }));
    };

    const handleDateClick = (date: Date, slotInfo?: { box?: { x: number; y: number; clientX: number; clientY: number } }) => {
        closeAll();

        const dateKey = format(date, 'yyyy-MM-dd');
        const tasksForDate = data?.filter(task =>
            format(new Date(task.dueDate), 'yyyy-MM-dd') === dateKey
        ) || [];

        if (tasksForDate.length === 0) return;

        const { width, height, isMobile, isTablet } = getViewport();
        const box = slotInfo?.box;
        const centered = { x: width / 2 - 200, y: height / 2 - 200 };

        let position: PopupPosition;
        if (isMobile) {
            position = { x: width / 2 - 150, y: height / 2 - 200 };
        } else if (isTablet) {
            position = box ? {
                x: Math.min(box.x, width - 400),
                y: Math.min(box.y + 50, height - 300),
            } : centered;
        } else {
            position = box ? { x: box.x, y: box.y + 50 } : centered;
        }

        setDropdownState({ isOpen: true, tasks: tasksForDate, date, position });
    };

    const handleMultipleTasksClick = (tasks: Task[], date: Date, event: React.MouseEvent) => {
        closeAll();

        const rect = (event.target as HTMLElement).getBoundingClientRect();
        const { width, height, isMobile, isTablet } = getViewport();

        let position: PopupPosition;
        if (isMobile) {
            position = { x: width / 2 - 150, y: height / 2 - 200 };
        } else if (isTablet) {
            position = {
                x: Math.min(rect.left, width - 400),
                y: Math.min(rect.bottom + 5, height - 300),
            };
        } else {
            position = {
                x: Math.min(rect.left, width - 500),
                y: Math.min(rect.bottom + 5, height - 500),
            };
        }

        setPopupState({ isOpen: true, tasks, date, position });
    };

    const closeDropdown = () => setDropdownState(prev => ({ ...prev, isOpen: false }));
    const closePopup = () => setPopupState(prev => ({ ...prev, isOpen: false }));

    // Week/day: one event per task; timed tasks as blocks, the rest in the all-day row
    const timeEvents: CalendarEvent[] = useMemo(() => (data ?? []).flatMap((task): CalendarEvent[] => {
        if (task.startAt) {
            const { start, end } = taskTimeRange(task.startAt, task.durationMinutes);
            return [{ id: task.$id, title: task.name, start, end, tasks: [task], isGrouped: false, task, allDay: false }];
        }
        if (!task.dueDate) return [];
        const day = parse(format(new Date(task.dueDate), "yyyy-MM-dd"), "yyyy-MM-dd", new Date());
        return [{ id: task.$id, title: task.name, start: day, end: day, tasks: [task], isGrouped: false, task, allDay: true }];
    }), [data]);

    // Month: one event per due date; days with several tasks render as a grouped card
    const events: CalendarEvent[] = useMemo(() => {
        if (!data || data.length === 0) {
            return [];
        }

        const tasksByDate = data.reduce((groups, task) => {
            if (!task.dueDate) return groups;
            const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd');
            (groups[dateKey] ??= []).push(task);
            return groups;
        }, {} as Record<string, Task[]>);

        // Timed tasks first, earliest first
        const byTime = (a: Task, b: Task) =>
            (a.startAt ? new Date(a.startAt).getTime() : Infinity) - (b.startAt ? new Date(b.startAt).getTime() : Infinity);

        return Object.entries(tasksByDate).map(([dateKey, unsorted]) => {
            const tasks = [...unsorted].sort(byTime);
            return ({
            id: `date-${dateKey}`,
            title: pluralize(tasks.length, "task"),
            // Local midnight: new Date("yyyy-MM-dd") is UTC and shows a day early west of UTC
            start: parse(dateKey, "yyyy-MM-dd", new Date()),
            end: parse(dateKey, "yyyy-MM-dd", new Date()),
            tasks,
            isGrouped: tasks.length > 1,
            });
        });
    }, [data]);

    // Drag/resize in week & day views: a drop on the all-day row clears the time
    const moveTask = ({ event, start, end, isAllDay }: EventInteractionArgs<CalendarEvent>) => {
        const task = event.task;
        if (!task || !canReschedule) return;
        const startDate = new Date(start);
        const day = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

        if (isAllDay) {
            updateTask({ param: { taskId: task.$id }, json: { dueDate: day, startAt: null, durationMinutes: null } });
            return;
        }
        const minutes = Math.max(15, Math.round((new Date(end).getTime() - startDate.getTime()) / 60_000));
        updateTask({
            param: { taskId: task.$id },
            json: {
                dueDate: day,
                startAt: startDate.toISOString(),
                // An all-day task dropped into the grid gets the default length
                durationMinutes: event.allDay ? DEFAULT_DURATION_MINUTES : minutes,
            },
        });
    };

    // Day under the pointer: elementsFromPoint sees through the event layer to the tagged day cell
    const dateAtPoint = (x: number, y: number) =>
        document.elementsFromPoint(x, y)
            .map((el) => (el as HTMLElement).dataset?.date)
            .find(Boolean);

    const onDragOver = (e: React.DragEvent) => {
        if (!canReschedule || !e.dataTransfer.types.includes(TASK_DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const date = dateAtPoint(e.clientX, e.clientY) ?? null;
        if (date !== dropDate) setDropDate(date);
    };

    const onDrop = (e: React.DragEvent) => {
        const taskId = e.dataTransfer.getData(TASK_DRAG_TYPE);
        const date = dateAtPoint(e.clientX, e.clientY);
        setDropDate(null);
        if (!canReschedule || !taskId || !date) return;
        e.preventDefault();

        const task = data.find((t) => t.$id === taskId);
        if (task?.dueDate && format(new Date(task.dueDate), "yyyy-MM-dd") === date) return;

        // Same convention as the date pickers: local midnight of the chosen day; a timed
        // task keeps its time of day on the new date
        const day = parse(date, "yyyy-MM-dd", new Date());
        const startAt = task?.startAt ? combineDateAndTime(day, toTimeInput(task.startAt)) : undefined;
        updateTask({ param: { taskId }, json: { dueDate: day, ...(startAt ? { startAt } : {}) } });
    };

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="text-center space-y-4">
                    <div className="p-4 rounded-full bg-muted/50">
                        <CalendarIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">No tasks found</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Create your first task to see it on the calendar
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background rounded-unified-lg border border-border shadow-unified transition-unified flex flex-col w-full">
            <div className="p-3 sm:p-4 gradient-mono-subtle border-b border-border flex-shrink-0">
                <CustomToolbar date={value} view={view} onView={setView} onNavigate={handleNavigate} />
            </div>
            <div
                className="p-1 sm:p-2 flex-1 overflow-x-auto"
                onDragOver={onDragOver}
                onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropDate(null);
                }}
                onDrop={onDrop}
            >
                <DnDCalendar
                    localizer={localizer}
                    date={value}
                    onNavigate={setValue}
                    view={view}
                    onView={(next) => setView(next as CalendarView)}
                    events={view === "month" ? events : timeEvents}
                    views={CALENDAR_VIEWS}
                    toolbar={false}
                    showAllEvents={true}
                    popup={true}
                    className={cn("calendar-container", `calendar-view-${view}`)}
                    style={{ height: view === "month" ? "auto" : 720 }}
                    step={30}
                    timeslots={2}
                    scrollToTime={new Date(1970, 0, 1, 8)}
                    // Week/day: drag blocks to move, drag the bottom edge to resize (admins)
                    draggableAccessor={(event) => view !== "month" && canReschedule && Boolean(event.task)}
                    resizable
                    resizableAccessor={(event) => view !== "month" && canReschedule && Boolean(event.task) && !event.allDay}
                    onEventDrop={moveTask}
                    onEventResize={moveTask}
                    onSelectEvent={(event) => view !== "month" && event.task && openTask(event.task.$id)}
                    onSelectSlot={(slotInfo) => {
                        if (view === "month") {
                            handleDateClick(slotInfo.start, slotInfo);
                            return;
                        }
                        // Dragging across empty time creates a task with that time block
                        const isAllDayRow = slotInfo.slots.length === 1 && slotInfo.start.getHours() === 0 && slotInfo.start.getMinutes() === 0 && slotInfo.action === "click";
                        if (!isAdmin || isAllDayRow) return;
                        const minutes = Math.max(15, Math.round((slotInfo.end.getTime() - slotInfo.start.getTime()) / 60_000));
                        openCreateTask(undefined, { start: slotInfo.start, durationMinutes: minutes });
                    }}
                    selectable={true}
                    eventPropGetter={(event) => ({
                        className: cn(event.task && `rbc-task-${event.task.status.toLowerCase()}`),
                    })}
                    formats={{ 
                        weekdayFormat: (date: Date) => format(date, "EEE", { locale: enUS }),
                        dayFormat: (date: Date) => format(date, view === "month" ? "d" : "EEE d", { locale: enUS }),
                        monthHeaderFormat: (date: Date) => format(date, "MMMM yyyy", { locale: enUS }),
                    }}
                    components={{
                        // Tag each day cell with its date so drops can find it
                        dateCellWrapper: ({ children, value }) => {
                            const date = format(value, "yyyy-MM-dd");
                            return isValidElement(children)
                                ? cloneElement(children as ReactElement<{ className?: string }>, {
                                    "data-date": date,
                                    className: cn((children as ReactElement<{ className?: string }>).props.className, date === dropDate && "rbc-drop-target"),
                                } as Record<string, unknown>)
                                : <>{children}</>;
                        },
                        event: ({ event }) => {
                            if (view !== "month" && event.task) {
                                return <TimeBlockCard task={event.task} allDay={Boolean(event.allDay)} />;
                            }
                            // Use grouped card for multiple tasks, individual card for single task
                            if (event.isGrouped && event.tasks) {
                                return (
                                    <GroupedEventCard
                                        tasks={event.tasks}
                                        date={event.start}
                                        onMultipleTasksClick={handleMultipleTasksClick}
                                    />
                                );
                            } else if (event.tasks && event.tasks.length === 1) {
                                const task = event.tasks[0];
                                return (
                                    <EventCard
                                        id={task.$id}
                                        title={task.startAt ? `${formatTime(task.startAt)} ${task.name}` : task.name}
                                        assignee={task.assignee || null}
                                        project={task.project || null}
                                        status={task.status}
                                        draggable={canReschedule}
                                    />
                                );
                            }
                            return null;
                        },
                    }}
                />
            </div>
            
            {/* Task Dropdown */}
            <TaskDropdown
                tasks={dropdownState.tasks}
                date={dropdownState.date}
                isOpen={dropdownState.isOpen}
                onClose={closeDropdown}
                position={dropdownState.position}
            />
            
            {/* Multiple Tasks Popup */}
            <MultipleTasksPopup
                tasks={popupState.tasks}
                date={popupState.date}
                isOpen={popupState.isOpen}
                onClose={closePopup}
                position={popupState.position}
            />
        </div>
    );
};
