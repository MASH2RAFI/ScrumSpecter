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
import { useState, useMemo } from "react";
import "./data-calendar.css";
import { EventCard } from "./event-card";
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

interface CustomToolbarProps {
    date: Date;
    onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
};

const CustomToolbar = ({ date, onNavigate }: CustomToolbarProps) => {
    const currentMonth = format(date, "MMMM yyyy", { locale: enUS });
    const isToday = format(new Date(), "yyyy-MM") === format(date, "yyyy-MM");
    
    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-foreground">{currentMonth}</h2>
                    {isToday && (
                        <p className="text-sm text-muted-foreground">Current month</p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate("PREV")}
                    className="hover:bg-primary/10 hover:border-primary/20 transition-all duration-200"
                >
                    <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <Button
                    variant={isToday ? "primary" : "outline"}
                    size="sm"
                    onClick={() => onNavigate("TODAY")}
                    className="hover:bg-primary/90 transition-all duration-200"
                >
                    Today
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate("NEXT")}
                    className="hover:bg-primary/10 hover:border-primary/20 transition-all duration-200"
                >
                    <ChevronRightIcon className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export const DataCalendar = ({
    data,
}: DataCalendarProps) => {
    const [value, setValue] = useState(new Date());

    // Memoize events to prevent unnecessary re-renders
    const events = useMemo(() => {
        return data.map((task) => ({
            id: task.$id,
            title: task.name,
            start: new Date(task.dueDate),
            end: new Date(task.dueDate),
            assignee: task.assignee || null,
            project: task.project || null,
            status: task.status,
        }));
    }, [data]);

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

        return (
        <div className="h-full bg-background rounded-lg border border-border overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-background to-muted/20 border-b border-border">
                <CustomToolbar date={value} onNavigate={handleNavigate} />
            </div>
            <div className="h-[calc(100%-80px)] p-4">
                <Calendar
                    localizer={localizer}
                    date={value}
                    events={events}
                    views={["month"]}
                    defaultView="month"
                    toolbar={false}
                    showAllEvents
                    className="h-full calendar-container"
                    max={new Date(new Date().setFullYear(new Date().getFullYear() + 1))}
                    formats={{ 
                        weekdayFormat: (date: Date) => format(date, "EEE", { locale: enUS }),
                        dayFormat: (date: Date) => format(date, "d", { locale: enUS }),
                        monthHeaderFormat: (date: Date) => format(date, "MMMM yyyy", { locale: enUS }),
                    }}
                    components={{
                        eventWrapper: ({ event }) => (
                            <EventCard
                                id={event.id}
                                title={event.title}
                                assignee={event.assignee}
                                project={event.project}
                                status={event.status}
                            />
                        ),
                    }}
                />
            </div>
        </div>
    );
}; 