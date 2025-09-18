import { 
    format, 
    getDay, 
    parse, 
    startOfWeek, 
    addMonths, 
    subMonths, 
} from "date-fns";
import { enUS } from "date-fns/locale";

import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import "./react-big-calendar.css";
import { Task } from "../types";
import { useState, useMemo, useEffect } from "react";
import "./data-calendar.css";
import { EventCard } from "./event-card";
import { GroupedEventCard } from "./grouped-event-card";
import { TaskDropdown } from "./task-dropdown";
import { MultipleTasksPopup } from "./multiple-tasks-popup";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

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
    tasks: Task[];
    isGrouped: boolean;
}

interface CustomToolbarProps {
    date: Date;
    onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
};

const CustomToolbar = ({ date, onNavigate }: CustomToolbarProps) => {
    const currentMonth = format(date, "MMMM yyyy", { locale: enUS });
    const isToday = format(new Date(), "yyyy-MM") === format(date, "yyyy-MM");
    
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
                                <p className="text-xs sm:text-sm text-muted-foreground">Current month</p>
                            )}
                        </div>
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

export const DataCalendar = ({
    data,
}: DataCalendarProps) => {
    const [value, setValue] = useState(new Date());
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
    const [dropdownState, setDropdownState] = useState<{
        isOpen: boolean;
        tasks: Task[];
        date: Date;
        position: { x: number; y: number };
    }>({
        isOpen: false,
        tasks: [],
        date: new Date(),
        position: { x: 0, y: 0 }
    });

    const [popupState, setPopupState] = useState<{
        isOpen: boolean;
        tasks: Task[];
        date: Date;
        position: { x: number; y: number };
    }>({
        isOpen: false,
        tasks: [],
        date: new Date(),
        position: { x: 0, y: 0 }
    });

    const handleNavigate = (action: "PREV" | "NEXT" | "TODAY") => {
        switch (action) {
            case "PREV":
                setValue(subMonths(value, 1));
                break;
            case "NEXT":
                setValue(addMonths(value, 1));
                break;
            case "TODAY":
                setValue(new Date());
                break;
        }
    };

    const handleDateClick = (date: Date, slotInfo?: { box?: { x: number; y: number; clientX: number; clientY: number } }) => {
        // Close any existing popups first
        setDropdownState(prev => ({ ...prev, isOpen: false }));
        setPopupState(prev => ({ ...prev, isOpen: false }));

        const dateKey = format(date, 'yyyy-MM-dd');
        const tasksForDate = data?.filter(task => 
            format(new Date(task.dueDate), 'yyyy-MM-dd') === dateKey
        ) || [];

        if (tasksForDate.length > 0) {
            // Adaptive positioning based on window size
            const isMobile = windowSize.width < 640;
            const isTablet = windowSize.width >= 640 && windowSize.width < 1024;
            
            let position;
            if (isMobile) {
                // Mobile: center the popup
                position = {
                    x: windowSize.width / 2 - 150,
                    y: windowSize.height / 2 - 200
                };
            } else if (isTablet) {
                // Tablet: position near click or center
                position = slotInfo?.box ? {
                    x: Math.min(slotInfo.box.x, windowSize.width - 400),
                    y: Math.min(slotInfo.box.y + 50, windowSize.height - 300)
                } : {
                    x: windowSize.width / 2 - 200,
                    y: windowSize.height / 2 - 200
                };
            } else {
                // Desktop: use original positioning
                position = slotInfo?.box ? {
                    x: slotInfo.box.x,
                    y: slotInfo.box.y + 50
                } : {
                    x: windowSize.width / 2 - 200,
                    y: windowSize.height / 2 - 200
                };
            }

            setDropdownState({
                isOpen: true,
                tasks: tasksForDate,
                date: date,
                position: position
            });
        }
    };

    const closeDropdown = () => {
        setDropdownState(prev => ({ ...prev, isOpen: false }));
    };

    const handleMultipleTasksClick = (tasks: Task[], date: Date, event: React.MouseEvent) => {
        // Close any existing popups first
        setDropdownState(prev => ({ ...prev, isOpen: false }));
        setPopupState(prev => ({ ...prev, isOpen: false }));

        const rect = (event.target as HTMLElement).getBoundingClientRect();
        
        // Adaptive positioning based on window size
        const isMobile = windowSize.width < 640;
        const isTablet = windowSize.width >= 640 && windowSize.width < 1024;
        
        let position;
        if (isMobile) {
            // Mobile: center the popup
            position = {
                x: windowSize.width / 2 - 150,
                y: windowSize.height / 2 - 200
            };
        } else if (isTablet) {
            // Tablet: position near click with constraints
            position = {
                x: Math.min(rect.left, windowSize.width - 400),
                y: Math.min(rect.bottom + 5, windowSize.height - 300)
            };
        } else {
            // Desktop: use original positioning
            position = {
                x: Math.min(rect.left, windowSize.width - 500),
                y: Math.min(rect.bottom + 5, windowSize.height - 500)
            };
        }

        setPopupState({
            isOpen: true,
            tasks: tasks,
            date: date,
            position: position
        });
    };

    const closePopup = () => {
        setPopupState(prev => ({ ...prev, isOpen: false }));
    };

    // Group tasks by date and create events
    const events: CalendarEvent[] = useMemo(() => {
        if (!data || data.length === 0) {
            return [];
        }

        // Group tasks by date
        const tasksByDate = data.reduce((groups, task) => {
            const dateKey = format(new Date(task.dueDate), 'yyyy-MM-dd');
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(task);
            return groups;
        }, {} as Record<string, typeof data>);

        // Create events for each date
        return Object.entries(tasksByDate).map(([dateKey, tasks]) => ({
            id: `date-${dateKey}`,
            title: `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`,
            start: new Date(dateKey),
            end: new Date(dateKey),
            tasks: tasks,
            isGrouped: tasks.length > 1,
        }));
    }, [data]);


    // Track window size for adaptive behavior
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };

        // Set initial size
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Update task count indicators after calendar renders
    useEffect(() => {
        const updateTaskCounts = () => {
            // Update task count indicators for each date
            events.forEach(event => {
                const dateKey = format(event.start, 'yyyy-MM-dd');
                const dateElements = document.querySelectorAll(`[data-date="${dateKey}"]`);
                dateElements.forEach(dateElement => {
                    const eventsContainer = dateElement.querySelector('.rbc-events-container');
                    if (eventsContainer && event.tasks) {
                        eventsContainer.setAttribute('data-total-events', event.tasks.length.toString());
                    }
                });
            });
        };

        // Run after a short delay to ensure calendar is rendered
        const timeoutId = setTimeout(updateTaskCounts, 100);
        return () => clearTimeout(timeoutId);
    }, [events, value]);

    // Handle edge cases after all hooks
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
                <CustomToolbar date={value} onNavigate={handleNavigate} />
            </div>
            <div className="p-1 sm:p-2 flex-1 overflow-x-auto">
                <Calendar
                    localizer={localizer}
                    date={value}
                    events={events}
                    views={["month"]}
                    defaultView="month"
                    toolbar={false}
                    showAllEvents={true}
                    popup={true}
                    className="calendar-container"
                    style={{ height: 'auto' }}
                    max={new Date(new Date().setFullYear(new Date().getFullYear() + 1))}
                    onSelectSlot={(slotInfo) => {
                        handleDateClick(slotInfo.start, slotInfo);
                    }}
                    selectable={true}
                    formats={{ 
                        weekdayFormat: (date: Date) => format(date, "EEE", { locale: enUS }),
                        dayFormat: (date: Date) => format(date, "d", { locale: enUS }),
                        monthHeaderFormat: (date: Date) => format(date, "MMMM yyyy", { locale: enUS }),
                    }}
                    components={{
                        event: ({ event }) => {
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
                                        title={task.name}
                                        assignee={task.assignee || null}
                                        project={task.project || null}
                                        status={task.status}
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