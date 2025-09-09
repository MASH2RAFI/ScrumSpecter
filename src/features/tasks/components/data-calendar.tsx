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
import "react-big-calendar/lib/css/react-big-calendar.css";
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
    
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">{currentMonth}</h2>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate("PREV")}
                >
                    <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate("TODAY")}
                >
                    Today
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigate("NEXT")}
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
            title: task.title,
            start: new Date(task.dueDate),
            end: new Date(task.dueDate),
            assignee: task.assignee,
            project: task.project,
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
        <div className="h-full bg-background">
            <Calendar
                localizer={localizer}
                date={value}
                events={events}
                views={["month"]}
                defaultView="month"
                toolbar={false}
                showAllEvents
                className="h-full"
                max={new Date(new Date().setFullYear(new Date().getFullYear() + 1))}
                formats={{ 
                    weekdayFormat: (date: Date) => format(date, "EEE", { locale: enUS }),
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
                    toolbar: () => (
                        <CustomToolbar date={value} onNavigate={handleNavigate} />
                    )
                }}
            />
        </div>
    );
}; 