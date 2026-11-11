"use client";

import { useEffect, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ClockIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { DEFAULT_DURATION_MINUTES, formatDuration } from "@/features/tasks/task-time";
import { isoWeekdayOrder } from "@/lib/week";
import { isValidTimeZone, zonedTimeToUtc } from "@/lib/time-zone";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

import { Routine, WEEKDAYS } from "../types";

interface RoutineWeekProps {
    routines: Routine[];
    projectName: (id: string | null) => string;
    memberName: (ids: string[]) => string;
    onSelect?: (routineId: string) => void;
}

const HOUR_PX = 48;

// The workspace's working day, in minutes after midnight; all-day routines fill it
type WorkDay = { start: number; end: number };
const DEFAULT_WORK_DAY: WorkDay = { start: 9 * 60, end: 18 * 60 };

const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};

// When a routine runs: its own time, or the whole working day when it has none
const routineSpan = (routine: Routine, workDay: WorkDay = DEFAULT_WORK_DAY) => {
    if (!routine.startTime) return workDay;
    const start = toMinutes(routine.startTime);
    return { start, end: start + (routine.durationMinutes ?? DEFAULT_DURATION_MINUTES) };
};

const clockLabel = (minutes: number, hour12: boolean) => {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = String(minutes % 60).padStart(2, "0");
    if (!hour12) return `${String(hours).padStart(2, "0")}:${mins}`;
    return `${hours % 12 || 12}${minutes % 60 ? `:${mins}` : ""} ${hours < 12 ? "AM" : "PM"}`;
};

// One run of a routine in the viewer's week: the weekday column and the minutes it shows at
type Occurrence = { routine: Routine; day: number; start: number; end: number };

// A routine's time is in the zone it was made in (routine.timeZone), and its weekdays are that
// zone's. For someone in another zone each run lands on the weekday and hour it really has for them
// (an evening run in Los Angeles is next morning's in Dhaka), as the tasks it creates do. The zone's
// offset is taken on the next date of that weekday, so daylight saving is right for the week shown.
const occurrencesOf = (routine: Routine, workDay: WorkDay): Occurrence[] => spill(runsOf(routine, workDay));

// A run that goes past midnight continues at the start of the next weekday
const spill = (runs: Occurrence[]): Occurrence[] => runs.flatMap((run) =>
    run.end <= 24 * 60 ? [run] : [
        { ...run, end: 24 * 60 },
        { ...run, day: run.day % 7 + 1, start: 0, end: Math.min(24 * 60, run.end - 24 * 60) },
    ]);

const runsOf = (routine: Routine, workDay: WorkDay): Occurrence[] => {
    // A routine saved without a zone has its tasks made at UTC (lib/routines.ts), so it is drawn that way
    const zone = routine.startTime ? routine.timeZone ?? "UTC" : null;
    if (!routine.startTime || !zone || !isValidTimeZone(zone) || zone === Intl.DateTimeFormat().resolvedOptions().timeZone) {
        const { start, end } = routineSpan(routine, workDay);
        return routine.weekdays.map((day) => ({ routine, day, start, end }));
    }
    const length = routine.durationMinutes ?? DEFAULT_DURATION_MINUTES;
    const now = new Date();
    return routine.weekdays.map((weekday) => {
        const ahead = (weekday - (now.getUTCDay() || 7) + 7) % 7;
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + ahead));
        const at = zonedTimeToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), routine.startTime!, zone);
        const start = at.getHours() * 60 + at.getMinutes();
        return { routine, day: at.getDay() || 7, start, end: start + length };
    });
};

// Side-by-side lanes for runs that overlap on the same day
const assignLanes = (runs: Occurrence[]) => {
    const laneEnds: number[] = [];
    // By run, not routine: a routine that crosses midnight has two runs on one day (its own and last night's)
    const lanes = new Map<Occurrence, number>();
    for (const run of [...runs].sort((a, b) => a.start - b.start)) {
        const { start, end } = run;
        const lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
        const index = lane === -1 ? laneEnds.length : lane;
        laneEnds[index] = end;
        lanes.set(run, index);
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
    const isWide = useMediaQuery("(min-width: 768px)", true);

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

const RoutineChip = ({ routine, span, projectName, memberName, onSelect, compact, style, className }: {
    routine: Routine;
    // Where it runs for this viewer (see occurrencesOf); none for an all-day routine
    span: { start: number; end: number } | null;
    projectName: (id: string | null) => string;
    memberName: (ids: string[]) => string;
    onSelect?: (routineId: string) => void;
    compact?: boolean;
    style?: React.CSSProperties;
    className?: string;
}) => {
    const { timeFormat } = usePreferences();
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
            {/* What the block's size leaves out, shown only while it's hovered (globals.css) */}
            <span className="routine-details hidden space-y-0.5 border-t border-border/60 pt-1 mt-1 text-[11px] leading-snug text-muted-foreground">
                {compact && <span className="block">{time} · {projectName(routine.projectId)}</span>}
                <span className="block">{memberName(routine.assigneeIds)}</span>
                {compact && <span className="block">{routine.active ? "Active" : "Paused"}</span>}
            </span>
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
    const runs = routines.flatMap((routine) => occurrencesOf(routine, workDay));
    const startHour = Math.floor(Math.min(workDay.start, ...runs.map((run) => run.start)) / 60);
    const endHour = Math.ceil(Math.max(workDay.end, ...runs.map((run) => run.end)) / 60);
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
                {days.map((day, dayIndex) => {
                    const label = WEEKDAYS.find((weekday) => weekday.value === day)!;
                    const dayRuns = runs.filter((run) => run.day === day);
                    const { lanes, count } = assignLanes(dayRuns);
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
                            {dayRuns.map((run) => {
                                const { routine, start, end } = run;
                                const blockHeight = Math.max(((end - start) / 60) * HOUR_PX, 22);
                                const lane = lanes.get(run) ?? 0;
                                return (
                                    <RoutineChip
                                        key={`${routine.$id}-${start}`}
                                        routine={routine}
                                        span={routine.startTime ? { start, end } : null}
                                        projectName={projectName}
                                        memberName={memberName}
                                        onSelect={onSelect}
                                        compact={blockHeight < 56}
                                        // Grows on hover (globals.css); the last two days grow to the left
                                        className={cn("routine-block absolute", dayIndex >= days.length - 2 && "routine-block-left")}
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
    const runs = routines.flatMap((routine) => occurrencesOf(routine, DEFAULT_WORK_DAY));

    return (
        <div className="grid gap-2" aria-label="Routines by weekday">
            {isoWeekdayOrder(weekStart).map((day) => {
                const label = WEEKDAYS.find((weekday) => weekday.value === day)!;
                const running = runs.filter((run) => run.day === day)
                    .sort((a, b) => (a.routine.startTime ? a.start : Infinity) - (b.routine.startTime ? b.start : Infinity) || a.routine.name.localeCompare(b.routine.name));
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
                        {running.map(({ routine, start, end }) => (
                            <div key={`${routine.$id}-${start}`} className="flex items-center gap-2">
                                {routine.startTime && (
                                    <span className="flex w-24 shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                                        <ClockIcon className="size-3" />
                                        {clockLabel(start, false)}
                                        {routine.durationMinutes ? ` · ${formatDuration(routine.durationMinutes)}` : ""}
                                    </span>
                                )}
                                <RoutineChip routine={routine} span={routine.startTime ? { start, end } : null} projectName={projectName} memberName={memberName} onSelect={onSelect} compact className="min-w-0 flex-1" />
                            </div>
                        ))}
                    </section>
                );
            })}
        </div>
    );
};
