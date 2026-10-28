"use client";

import { useMemo, useState } from "react";
import { BarChart3Icon } from "lucide-react";

import { EASE, m } from "@/components/motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TaskStatus, type Task } from "@/features/tasks/types";

// Plot height in px; bars are scaled to the busiest day
const PLOT = 160;

type Day = { key: string; label: string; long: string; done: number; open: number; today: boolean };

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

// This week's tasks by due day, done stacked under open, for everyone or just you
export const WeekChart = ({ tasks, memberId, weekStart }: { tasks: Task[]; memberId?: string; weekStart: number }) => {
    const [mine, setMine] = useState(false);

    const days = useMemo<Day[]>(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const first = new Date(today);
        first.setDate(today.getDate() - ((today.getDay() - weekStart + 7) % 7));
        const week = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(first);
            date.setDate(first.getDate() + i);
            return {
                key: dayKey(date),
                label: date.toLocaleDateString(undefined, { weekday: "short" }),
                long: date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" }),
                done: 0,
                open: 0,
                today: date.getTime() === today.getTime(),
            };
        });
        const byKey = new Map(week.map((day) => [day.key, day]));
        for (const task of tasks) {
            if (!task.dueDate || (mine && !(memberId && task.assigneeIds?.includes(memberId)))) continue;
            const day = byKey.get(dayKey(new Date(task.dueDate)));
            if (!day) continue;
            if (task.status === TaskStatus.DONE) day.done += 1; else day.open += 1;
        }
        return week;
    }, [tasks, mine, memberId, weekStart]);

    const max = Math.max(1, ...days.map((day) => day.done + day.open));
    const scale = (count: number) => (count / max) * PLOT;
    const total = days.reduce((sum, day) => sum + day.done + day.open, 0);

    return (
        <Card className="h-full">
            <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <BarChart3Icon className="size-5 text-primary" aria-hidden />
                        <h2 className="text-lg font-semibold">This week</h2>
                    </div>
                    <div className="flex rounded-full bg-muted p-1" role="group" aria-label="Whose tasks">
                        {[{ label: "Everyone", value: false }, { label: "Mine", value: true }].map((option) => (
                            <button
                                key={option.label}
                                type="button"
                                aria-pressed={mine === option.value}
                                onClick={() => setMine(option.value)}
                                className={cn(
                                    "min-h-0 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ease-out",
                                    mine === option.value ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {total === 0 ? (
                    <p className="grid flex-1 place-items-center py-10 text-sm text-muted-foreground">
                        {mine ? "Nothing of yours is due this week." : "No tasks are due this week."}
                    </p>
                ) : (
                    <>
                        {/* Re-keyed by the toggle so the bars grow again. HTML, not SVG, so the text
                            keeps its size on narrow screens */}
                        <div key={String(mine)} className="grid grid-cols-7 gap-1 sm:gap-3" aria-hidden>
                            {days.map((day, i) => {
                                const count = day.done + day.open;
                                return (
                                    <div key={day.key} className="flex flex-col items-center gap-2" title={`${day.long}: ${day.done} done, ${day.open} open`}>
                                        <div className="flex w-full flex-col items-center justify-end border-b border-border" style={{ height: PLOT + 20 }}>
                                            {count > 0 && <span className="mb-1 text-xs font-semibold tabular-nums">{count}</span>}
                                            <m.div
                                                className="flex w-full max-w-8 origin-bottom flex-col gap-0.5"
                                                initial={{ scaleY: 0 }}
                                                animate={{ scaleY: 1 }}
                                                transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease: EASE }}
                                            >
                                                {day.open > 0 && <div className="rounded-t-md bg-[var(--ramp-mid)]" style={{ height: scale(day.open) }} />}
                                                {day.done > 0 && <div className={cn("bg-[var(--ramp-high)]", day.open > 0 ? "" : "rounded-t-md")} style={{ height: scale(day.done) }} />}
                                            </m.div>
                                        </div>
                                        <span className={cn("text-xs", day.today ? "font-bold text-foreground" : "text-muted-foreground")}>{day.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground" aria-hidden>
                            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--ramp-high)]" />Done</span>
                            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--ramp-mid)]" />Open</span>
                        </div>
                        <table className="sr-only">
                            <caption>Tasks due each day this week</caption>
                            <thead><tr><th>Day</th><th>Done</th><th>Open</th></tr></thead>
                            <tbody>
                                {days.map((day) => <tr key={day.key}><td>{day.long}</td><td>{day.done}</td><td>{day.open}</td></tr>)}
                            </tbody>
                        </table>
                    </>
                )}
            </CardContent>
        </Card>
    );
};
