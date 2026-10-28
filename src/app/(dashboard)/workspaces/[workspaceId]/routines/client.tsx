"use client";

import { ClockIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, RepeatIcon, TargetIcon, TrashIcon } from "lucide-react";
import { formatDuration } from "@/features/tasks/task-time";

import { PageError } from "@/components/page-error";
import { PageSkeleton } from "@/components/page-skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirm } from "@/hooks/use-confirm";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useDeleteRoutine } from "@/features/routines/api/use-delete-routine";
import { useGetRoutines } from "@/features/routines/api/use-get-routines";
import { useUpdateRoutine } from "@/features/routines/api/use-update-routine";
import { useRoutineModal } from "@/features/routines/hooks/use-routine-modal";
import { WEEKDAYS, ROUTINE_VIEWS } from "@/features/routines/types";
import { RoutineWeek } from "@/features/routines/components/routine-week";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { isoWeekdayOrder } from "@/lib/week";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

export const RoutinesClient = () => {
    const workspaceId = useWorkspaceId();
    const { canEditWork } = usePermissions({ workspaceId });
    const { openCreate, openEdit } = useRoutineModal();
    const { data: routines, isLoading } = useGetRoutines({ workspaceId });
    const { data: projects } = useGetProjects({ workspaceId });
    const { data: members } = useGetMembers({ workspaceId });
    const { mutate: updateRoutine, isPending: isUpdating } = useUpdateRoutine();
    const { mutate: deleteRoutine, isPending: isDeleting } = useDeleteRoutine();
    const { weekStart } = usePreferences();
    const orderedWeekdays = isoWeekdayOrder(weekStart).map((day) => WEEKDAYS.find((weekday) => weekday.value === day)!);
    const [DeleteDialog, confirmDelete] = useConfirm(
        "Delete routine",
        "No new tasks will be created. Tasks it already created are kept.",
        "destructive",
    );

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!routines) {
        return <PageError message="Failed to load routines" />;
    }

    const projectName = (id: string) => projects?.documents.find((p) => p.$id === id)?.name ?? "Unknown project";
    const memberName = (ids: string[]) =>
        ids.map((id) => members?.documents.find((m) => m.$id === id)?.name).filter(Boolean).join(", ") || "Unassigned";

    return (
        <div className="space-y-6">
            <DeleteDialog />
            {/* The navbar carries the page title; this row only holds the action */}
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="text-sm text-muted-foreground">
                    Tasks are added on the chosen days through the end of each project&apos;s current sprint.
                </p>
                {canEditWork && (
                    <Button onClick={openCreate} className="shrink-0">
                        <PlusIcon className="mr-2 size-4" />
                        New routine
                    </Button>
                )}
            </div>

            {routines.documents.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                        <RepeatIcon className="size-8 text-muted-foreground" />
                        <p className="font-medium">No routines yet</p>
                        <p className="text-sm text-muted-foreground">
                            {canEditWork ? "Create one for work that happens every week, like stand-ups or reports." : "Admins and supervisors can set up recurring weekly tasks here."}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                <RoutineWeek
                    routines={routines.documents}
                    projectName={projectName}
                    memberName={memberName}
                    onSelect={canEditWork ? openEdit : undefined}
                />
                <div className="grid gap-3">
                    {routines.documents.map((routine) => (
                        <Card key={routine.$id} className={cn(!routine.active && "opacity-60")}>
                            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-2 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <RepeatIcon className="size-4 shrink-0 text-primary" />
                                        <p className="font-semibold truncate">{routine.name}</p>
                                        {!routine.active && <Badge variant="secondary">Paused</Badge>}
                                    </div>
                                    <div className="flex flex-wrap gap-1" aria-label="Repeats on">
                                        {orderedWeekdays.map((day) => (
                                            <span
                                                key={day.value}
                                                className={cn(
                                                    "rounded px-1.5 py-0.5 text-xs",
                                                    routine.weekdays.includes(day.value)
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-muted text-muted-foreground"
                                                )}
                                            >
                                                {day.short}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {routine.startTime && (
                                            <span className="inline-flex items-center gap-1 mr-1 font-medium text-foreground">
                                                <ClockIcon className="size-3" />
                                                {routine.startTime}
                                                {routine.durationMinutes ? ` · ${formatDuration(routine.durationMinutes)}` : ""}
                                                {" ·"}
                                            </span>
                                        )}
                                        {projectName(routine.projectId)} · {memberName(routine.assigneeIds)}
                                        {routine.storyPoints != null && (
                                            <span className="inline-flex items-center gap-1 ml-1">
                                                · <TargetIcon className="size-3" /> {routine.storyPoints} pts
                                            </span>
                                        )}
                                    </p>
                                    {ROUTINE_VIEWS.some(({ key }) => !routine[key]) && (
                                        <p className="text-xs text-muted-foreground">
                                            Hidden from {ROUTINE_VIEWS.filter(({ key }) => !routine[key]).map(({ label }) => label).join(", ")}
                                        </p>
                                    )}
                                </div>
                                {canEditWork && (
                                    <div className="flex gap-2 shrink-0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={isUpdating}
                                            onClick={() => updateRoutine({ param: { routineId: routine.$id }, json: { active: !routine.active } })}
                                        >
                                            {routine.active ? <PauseIcon className="mr-1 size-4" /> : <PlayIcon className="mr-1 size-4" />}
                                            {routine.active ? "Pause" : "Resume"}
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => openEdit(routine.$id)}>
                                            <PencilIcon className="mr-1 size-4" />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={isDeleting}
                                            aria-label={`Delete ${routine.name}`}
                                            onClick={async () => {
                                                if (await confirmDelete()) {
                                                    deleteRoutine({ param: { routineId: routine.$id } });
                                                }
                                            }}
                                        >
                                            <TrashIcon className="size-4" />
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
                </>
            )}
        </div>
    );
};
