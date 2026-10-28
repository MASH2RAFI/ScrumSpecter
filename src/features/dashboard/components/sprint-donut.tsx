"use client";

import { useState } from "react";
import { TargetIcon } from "lucide-react";

import { CountUp, EASE, m } from "@/components/motion";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskStatus, type Task } from "@/features/tasks/types";
import type { Project } from "@/features/projects/types";

const SIZE = 140;
const R = 54;
const STROKE = 16;
// A sliver of surface between segments
const GAP = 0.008;

const SEGMENTS = [
    { key: "done", label: "Done", color: "var(--ramp-high)" },
    { key: "progress", label: "In progress", color: "var(--ramp-mid)" },
    { key: "todo", label: "Not started", color: "var(--ramp-low)" },
] as const;

// Story points of one project's sprint by state, as a ring that draws itself in
export const SprintDonut = ({ tasks, projects }: { tasks: Task[]; projects: Project[] }) => {
    const [projectId, setProjectId] = useState(projects[0]?.$id ?? "");
    const project = projects.find((p) => p.$id === projectId) ?? projects[0];

    const points = { done: 0, progress: 0, todo: 0 };
    for (const task of tasks) {
        if (task.projectId !== project?.$id) continue;
        const value = task.storyPoints ?? 0;
        if (task.status === TaskStatus.DONE) points.done += value;
        else if (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.IN_REVIEW) points.progress += value;
        else points.todo += value;
    }
    const total = points.done + points.progress + points.todo;
    const percent = total ? Math.round((points.done / total) * 100) : 0;

    let start = 0;
    const arcs = SEGMENTS.map((segment) => {
        const fraction = total ? points[segment.key] / total : 0;
        const arc = { ...segment, start, fraction };
        start += fraction;
        return arc;
    }).filter((arc) => arc.fraction > 0);

    return (
        <Card className="h-full">
            <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <TargetIcon className="size-5 text-primary" aria-hidden />
                        <h2 className="text-lg font-semibold">Sprint progress</h2>
                    </div>
                    {projects.length > 1 && (
                        <Select value={project?.$id} onValueChange={setProjectId}>
                            <SelectTrigger className="h-8 w-36 text-xs" aria-label="Project">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {projects.map((p) => <SelectItem key={p.$id} value={p.$id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {!project ? (
                    <p className="grid flex-1 place-items-center py-8 text-sm text-muted-foreground">Add a project to follow its sprint here.</p>
                ) : total === 0 ? (
                    <p className="grid flex-1 place-items-center py-8 text-center text-sm text-muted-foreground">No story points in {project.name} yet.</p>
                ) : (
                    <div className="flex flex-1 flex-wrap items-center justify-center gap-6">
                        <div className="relative" style={{ width: SIZE, height: SIZE }}>
                            {/* Re-keyed per project so the ring draws again */}
                            <svg key={project.$id} viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label={`${project.name}: ${percent}% of ${total} story points done`}>
                                <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" className="stroke-muted" strokeWidth={STROKE} />
                                {arcs.map((arc, i) => (
                                    <m.circle
                                        key={arc.key}
                                        cx={SIZE / 2}
                                        cy={SIZE / 2}
                                        r={R}
                                        fill="none"
                                        stroke={arc.color}
                                        strokeWidth={STROKE}
                                        strokeLinecap="butt"
                                        // Start at 12 o'clock, after the segments before it
                                        transform={`rotate(${-90 + arc.start * 360} ${SIZE / 2} ${SIZE / 2})`}
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: Math.max(0, arc.fraction - (arcs.length > 1 ? GAP : 0)) }}
                                        transition={{ duration: 1, delay: 0.15 + i * 0.15, ease: EASE }}
                                    />
                                ))}
                            </svg>
                            <div className="absolute inset-0 grid place-items-center text-center">
                                <div>
                                    <p className="text-2xl font-bold"><CountUp value={percent} />%</p>
                                    <p className="text-xs text-muted-foreground">points done</p>
                                </div>
                            </div>
                        </div>
                        <ul className="space-y-2 text-sm">
                            {SEGMENTS.map((segment) => (
                                <li key={segment.key} className="flex items-center gap-2">
                                    <span className="size-2.5 rounded-sm" style={{ background: segment.color }} aria-hidden />
                                    <span className="text-muted-foreground">{segment.label}</span>
                                    <span className="ml-auto pl-3 font-semibold tabular-nums">{points[segment.key]} pts</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
