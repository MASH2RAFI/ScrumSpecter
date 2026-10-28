"use client";

import { useEffect, useState } from "react";
import { useMedia } from "react-use";
import { ClockIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { DEFAULT_DURATION_MINUTES, formatDuration } from "@/features/tasks/task-time";
import { isoWeekdayOrder } from "@/lib/week";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

import { Routine, WEEKDAYS } from "../types";

interface RoutineWeekProps {
    routines: Routine[];
    projectName: (id: string) => string;
    memberName: (ids: string[]) => string;
    onSelect?: (routineId: string) => void;
}

const HOUR_PX = 48;

// The workspace's working day, in minutes after midnight; all-day routines fill it
type WorkDay = { start: number; end: number };
const DEFAULT_WORK_DAY: WorkDay = { start: 9 * 60, end: 18 * 60 };

// Timed routines first in time order, then the all-day ones by name
const byTime = (a: Routine, b: Routine) =>
    (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99") || a.name.localeCompare(b.name);

const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};

// When a routine runs: its own time, or the whole working day when it has none
const routineSpan = (routine: Routine, workDay: WorkDay = DEFAULT_WORK_DAY) => {
    if (!routine.startTime) return workDay;
    const start = toMinutes(routine.startTime);
    return { start, end: Math.min(24 * 60, start + (routine.durationMinutes ?? DEFAULT_DURATION_MINUTES)) };
};

const clockLabel = (minutes: number, hour12: boolean) => {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = String(minutes % 60).padStart(2, "0");
    if (!hour12) return `${String(hours).padStart(2, "0")}:${mins}`;
    return `${hours % 12 || 12}${minutes % 60 ? `:${mins}` : ""} ${hours < 12 ? "AM" : "PM"}`;
};

// Side-by-side lanes for routines that overlap on the same day
const assignLanes = (routines: Routine[], workDay: WorkDay) => {
    const laneEnds: number[] = [];
    const lanes = new Map<string, number>();
    for (const routine of [...routines].sort((a, b) => routineSpan(a, workDay).start - routineSpan(b, workDay).start)) {
        const { start, end } = routineSpan(routine, workDay);
        const lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
        const index = lane === -1 ? laneEnds.length : lane;
        laneEnds[index] = end;
        lanes.set(routine.$id, index);
    }
    return { lanes, count: Math.max(1, laneEnds.length) };
};

const useNowMinutes = () => {
    const [minutes, setMinutes] = useState<number | null>(null);
    useEffect(() => {
        const update = () => {
            const now = new Date();
            setMinutes(now.getHours() * 60 + now.getMinutes());
        };
        update();
        const interval = setInterval(update, 60_000);
        return () => clearInterval(interval);
    }, []);
    return minutes;
};

// The week at a glance: hours down the side, each day's routines placed at their time
export const RoutineWeek = (props: RoutineWeekProps) => {
    const isWide = useMedia("(min-width: 768px)", true);

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg">Week overview</CardTitle>
            </CardHeader>
            <CardContent>
                {isWide ? <WeekGrid {...props} /> : <WeekList {...props} />}
            </CardContent>
        </Card>
    );
};

const RoutineChip = ({ routine, projectName, memberName, onSelect, compact, style, className }: {
    routine: Routine;
    projectName: (id: string) => string;
    memberName: (ids: string[]) => string;
    onSelect?: (routineId: string) => void;
    compact?: boolean;
    style?: React.CSSProperties;
    className?: string;
}) => {
    const { timeFormat } = usePreferences();
    const span = routine.startTime ? routineSpan(routine) : null;
    const time = span ? `${clockLabel(span.start, timeFormat === "12h")} – ${clockLabel(span.end, timeFormat === "12h")}` : "All day";

    return (
        <button
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(routine.$id)}
            title={`${routine.name}${time ? ` · ${time}` : ""} · ${projectName(routine.projectId)} · ${memberName(routine.assigneeIds)}${routine.active ? "" : " · Paused"}`}
            style={style}
            className={cn(
                "overflow-hidden rounded border-l-2 border-primary bg-card px-1.5 py-1 text-left text-xs shadow-sm min-h-0 min-w-0",
                onSelect && "hover:bg-accent",
                !routine.active && "opacity-50 border-muted-foreground",
                className,
            )}
        >
            {compact ? (
                <span className="block truncate font-medium">
                    {span && <span className="mr-1 font-normal text-muted-foreground">{clockLabel(span.start, timeFormat === "12h")}</span>}
                    {routine.name}
                </span>
            ) : (
                <>
                    <span className="block truncate font-medium">{routine.name}</span>
                    {time && <span className="block truncate text-[11px] text-muted-foreground">{time}</span>}
                    <span className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                        <span className="truncate">{projectName(routine.projectId)}</span>
                        <span className="shrink-0 rounded bg-muted px-1">{initials(memberName(routine.assigneeIds.slice(0, 1)))}{routine.assigneeIds.length > 1 ? ` +${routine.assigneeIds.length - 1}` : ""}</span>
                    </span>
                    {!routine.active && <span className="text-[10px] uppercase">Paused</span>}
                </>
            )}
        </button>
    );
};

const WeekGrid = ({ routines, projectName, memberName, onSelect }: RoutineWeekProps) => {
    const { weekStart, timeFormat } = usePreferences();
    const today = new Date().getDay() || 7;
    const nowMinutes = useNowMinutes();
    const days = isoWeekdayOrder(weekStart);

    const { data: workspace } = useGetWorkspace({ workspaceId: useWorkspaceId() });
    // Falls back to the default if the hours aren't known (yet)
    const workDay: WorkDay = workspace?.workDayStart && workspace.workDayEnd
        ? { start: toMinutes(workspace.workDayStart), end: toMinutes(workspace.workDayEnd) }
        : DEFAULT_WORK_DAY;

    // The working day, widened for any routine set earlier or later
    const spans = routines.map((routine) => routineSpan(routine, workDay));
    const startHour = Math.floor(Math.min(workDay.start, ...spans.map((span) => span.start)) / 60);
    const endHour = Math.ceil(Math.max(workDay.end, ...spans.map((span) => span.end)) / 60);
    const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
    const height = hours.length * HOUR_PX;
    const top = (minutes: number) => ((minutes - startHour * 60) / 60) * HOUR_PX;

    return (
        <div className="overflow-x-auto" aria-label="Routines by weekday">
            <div className="grid min-w-[720px]" style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}>
                {/* Day headers */}
                <div />
                {days.map((day) => {
                    const label = WEEKDAYS.find((weekday) => weekday.value === day)!;
                    return (
                        <div key={day} className={cn("border-b px-2 pb-2 text-xs font-semibold uppercase tracking-wide", day === today ? "text-primary" : "text-muted-foreground")}>
                            {label.short}
                            {day === today && <span className="ml-1 normal-case font-normal">· today</span>}
                        </div>
                    );
                })}

                {/* Hour labels */}
                <div className="relative" style={{ height }}>
                    {hours.map((hour) => (
                        <span
                            key={hour}
                            className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground first:translate-y-0"
                            style={{ top: (hour - startHour) * HOUR_PX }}
                        >
                            {clockLabel(hour * 60, timeFormat === "12h")}
                        </span>
                    ))}
                </div>

                {/* One column per day, routines placed by time */}
                {days.map((day) => {
                    const label = WEEKDAYS.find((weekday) => weekday.value === day)!;
                    const dayRoutines = routines.filter((routine) => routine.weekdays.includes(day));
                    const { lanes, count } = assignLanes(dayRoutines, workDay);
                    const showNow = day === today && nowMinutes !== null && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60;

                    return (
                        <section
                            key={day}
                            aria-label={label.label}
                            className={cn("relative border-l", day === today && "bg-primary/5")}
                            style={{
                                height,
                                backgroundImage: `repeating-linear-gradient(to bottom, hsl(var(--border)) 0 1px, transparent 1px ${HOUR_PX}px)`,
                            }}
                        >
                            {dayRoutines.map((routine) => {
                                const { start, end } = routineSpan(routine, workDay);
                                const blockHeight = Math.max(((end - start) / 60) * HOUR_PX, 22);
                                const lane = lanes.get(routine.$id) ?? 0;
                                return (
                                    <RoutineChip
                                        key={routine.$id}
                                        routine={routine}
                                        projectName={projectName}
                                        memberName={memberName}
                                        onSelect={onSelect}
                                        compact={blockHeight < 56}
                                        className="absolute"
                                        style={{
                                            top: top(start) + 1,
                                            height: blockHeight - 2,
                                            left: `calc(${(lane / count) * 100}% + 2px)`,
                                            width: `calc(${100 / count}% - 4px)`,
                                        }}
                                    />
                                );
                            })}
                            {showNow && (
                                <div className="pointer-events-none absolute inset-x-0 h-0.5 bg-destructive" style={{ top: top(nowMinutes) }} aria-hidden />
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
};

// Phones: one block per day, routines in time order
const WeekList = ({ routines, projectName, memberName, onSelect }: RoutineWeekProps) => {
    const { weekStart } = usePreferences();
    const today = new Date().getDay() || 7;

    return (
        <div className="grid gap-2" aria-label="Routines by weekday">
            {isoWeekdayOrder(weekStart).map((day) => {
                const label = WEEKDAYS.find((weekday) => weekday.value === day)!;
                const running = routines.filter((routine) => routine.weekdays.includes(day)).sort(byTime);
                return (
                    <section
                        key={day}
                        aria-label={label.label}
                        className={cn("rounded-md border p-2 space-y-1.5", day === today ? "border-primary bg-primary/5" : "bg-muted/30")}
                    >
                        <h3 className={cn("text-xs font-semibold uppercase tracking-wide", day === today ? "text-primary" : "text-muted-foreground")}>
                            {label.short}
                            {day === today && <span className="ml-1 normal-case font-normal">· today</span>}
                        </h3>
                        {running.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                        {running.map((routine) => (
                            <div key={routine.$id} className="flex items-center gap-2">
                                {routine.startTime && (
                                    <span className="flex w-24 shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                                        <ClockIcon className="size-3" />
                                        {routine.startTime}
                                        {routine.durationMinutes ? ` · ${formatDuration(routine.durationMinutes)}` : ""}
                                    </span>
                                )}
                                <RoutineChip routine={routine} projectName={projectName} memberName={memberName} onSelect={onSelect} compact className="min-w-0 flex-1" />
                            </div>
                        ))}
                    </section>
                );
            })}
        </div>
    );
};
