"use client";

import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, InboxIcon, MinusIcon, PlusIcon, Settings2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDuration } from "../task-time";
import { type CalendarPrefs, MAX_SLOT, MIN_SLOT, SLOT_STEP } from "../hooks/use-calendar-prefs";

export type CalendarView = "month" | "week" | "day";
export const CALENDAR_VIEWS: CalendarView[] = ["month", "week", "day"];

interface CalendarToolbarProps {
    title: string;
    view: CalendarView;
    onView: (view: CalendarView) => void;
    onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
    prefs: CalendarPrefs;
    onPrefs: (changes: Partial<CalendarPrefs>) => void;
    unscheduledCount: number;
    hour12: boolean;
}

const hourLabel = (hour: number, hour12: boolean) =>
    hour === 24 ? (hour12 ? "12 AM (end)" : "24:00") : format(new Date(2000, 0, 1, hour), hour12 ? "h a" : "HH:mm");

// One compact row, like Jira: navigation, view switch, unscheduled toggle and grid settings
export const CalendarToolbar = ({ title, view, onView, onNavigate, prefs, onPrefs, unscheduledCount, hour12 }: CalendarToolbarProps) => (
    <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="h-8" onClick={() => onNavigate("TODAY")}>Today</Button>
        <div className="flex items-center">
            <Button variant="ghost" size="icon" className="size-8" aria-label="Previous" onClick={() => onNavigate("PREV")}>
                <ChevronLeftIcon className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Next" onClick={() => onNavigate("NEXT")}>
                <ChevronRightIcon className="size-4" />
            </Button>
        </div>
        <h2 className="min-w-0 flex-1 truncate text-base sm:text-lg font-semibold" aria-live="polite">{title}</h2>

        {/* Phones: a second row with the view switch and the panel/settings buttons */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
        <div className="grid flex-1 grid-cols-3 rounded-md border bg-muted/40 p-0.5 sm:inline-flex sm:flex-none" role="group" aria-label="Calendar view">
            {CALENDAR_VIEWS.map((option) => (
                <Button
                    key={option}
                    size="sm"
                    variant={view === option ? "primary" : "ghost"}
                    aria-pressed={view === option}
                    onClick={() => onView(option)}
                    className="h-7 px-3 capitalize min-h-0"
                >
                    {option}
                </Button>
            ))}
        </div>

        <Button
            variant={prefs.showUnscheduled ? "secondary" : "outline"}
            size="sm"
            className="h-8 shrink-0 px-2.5 min-h-0"
            aria-pressed={prefs.showUnscheduled}
            onClick={() => onPrefs({ showUnscheduled: !prefs.showUnscheduled })}
        >
            <InboxIcon className="size-4 sm:mr-1.5" />
            <span className="sr-only sm:not-sr-only">Unscheduled</span>
            <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">{unscheduledCount}</span>
        </Button>

        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="size-8" aria-label="View settings">
                    <Settings2Icon className="size-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-4">
                <p className="text-sm font-semibold">Week and day grid</p>
                <div className="flex items-center justify-between gap-3">
                    <Label id="slot-size-label">Time slot</Label>
                    <div className="flex items-center gap-1" role="group" aria-labelledby="slot-size-label">
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-7"
                            aria-label="Smaller slots"
                            disabled={prefs.slotMinutes <= MIN_SLOT}
                            onClick={() => onPrefs({ slotMinutes: prefs.slotMinutes - SLOT_STEP })}
                        >
                            <MinusIcon className="size-3" />
                        </Button>
                        <output className="w-16 text-center text-sm font-medium" aria-label="Slot size">{formatDuration(prefs.slotMinutes)}</output>
                        <Button
                            variant="outline"
                            size="icon"
                            className="size-7"
                            aria-label="Larger slots"
                            disabled={prefs.slotMinutes >= MAX_SLOT}
                            onClick={() => onPrefs({ slotMinutes: prefs.slotMinutes + SLOT_STEP })}
                        >
                            <PlusIcon className="size-3" />
                        </Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Visible hours</Label>
                    <div className="flex items-center gap-2">
                        <Select value={String(prefs.startHour)} onValueChange={(value) => onPrefs({ startHour: Number(value) })}>
                            <SelectTrigger className="h-8" aria-label="From">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 24 }, (_, hour) => (
                                    <SelectItem key={hour} value={String(hour)} disabled={hour >= prefs.endHour}>{hourLabel(hour, hour12)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground">to</span>
                        <Select value={String(prefs.endHour)} onValueChange={(value) => onPrefs({ endHour: Number(value) })}>
                            <SelectTrigger className="h-8" aria-label="To">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 24 }, (_, i) => i + 1).map((hour) => (
                                    <SelectItem key={hour} value={String(hour)} disabled={hour <= prefs.startHour}>{hourLabel(hour, hour12)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">Saved on this device.</p>
            </PopoverContent>
        </Popover>
        </div>
    </div>
);
