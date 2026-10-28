"use client";

import { PageError } from "@/components/page-error";
import { PageSkeleton } from "@/components/page-skeletons";
import { Meter, Stagger, StaggerItem } from "@/components/motion";
import { SprintDonut } from "@/features/dashboard/components/sprint-donut";
import { StatCards } from "@/features/dashboard/components/stat-cards";
import { TeamCard } from "@/features/dashboard/components/team-card";
import { WeekChart } from "@/features/dashboard/components/week-chart";
import { NoProjectsState, ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRedirectOnAccessError } from "@/hooks/use-redirect-on-access-error";
import { isAccessError } from "@/lib/api-error";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { Task } from "@/features/tasks/types";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { calculateVelocity, formatDateDDMMYYYY, getProjectPointStats, sprintLengthInDays } from "@/lib/sprint-utils";
import { AlertTriangleIcon, CalendarIcon, ClockIcon, ListChecksIcon, PlusIcon } from "lucide-react";
import { useCurrent } from "@/features/auth/api/use-current";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { splitByRoutineWeek } from "@/features/tasks/routine-window";
import { TaskStatusMenu } from "@/features/tasks/components/task-status-menu";
import { formatTime, formatTimeRange, taskCountdown, taskEndAt } from "@/features/tasks/task-time";
import { useNow } from "@/hooks/use-now";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { EnableRemindersCard } from "@/features/notifications/components/enable-reminders-card";
import { useTaskPanel } from "@/features/tasks/hooks/use-task-panel";

// Sprint dates are calendar days (YYYY-MM-DD), so compare them without timezones
const getSprintSummary = (startDate: string, endDate: string) => {
    const today = formatDateDDMMYYYY(new Date());
    const start = formatDateDDMMYYYY(startDate);
    const end = formatDateDDMMYYYY(endDate);
    const totalDays = sprintLengthInDays(start, end);
    const untilStart = sprintLengthInDays(today, start) - 1;
    const daysLeft = sprintLengthInDays(today, end);
    const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

    if (untilStart > 0) return `Starts in ${plural(untilStart)} • ${plural(totalDays)} sprint`;
    if (daysLeft < 1) return `Sprint ended • ${plural(totalDays)} sprint`;
    return `${plural(daysLeft)} left • ${plural(totalDays)} sprint`;
};

const SprintProgress = ({ tasks, projectId }: { tasks: Task[]; projectId: string }) => {
    const { projectTasks, completedTasks, totalStoryPoints, completedStoryPoints } = getProjectPointStats(tasks, projectId);
    const percent = calculateVelocity(completedStoryPoints, totalStoryPoints);
    const now = Date.now();
    const overdue = projectTasks.filter((task) => task.status !== "DONE" && task.dueDate && new Date(task.dueDate).getTime() < now).length;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{completedStoryPoints}/{totalStoryPoints} pts done</span>
                <span className="text-muted-foreground">{percent}%</span>
            </div>
            <Meter value={percent / 100} label="Story points completed" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{completedTasks.length}/{projectTasks.length} tasks done</span>
                {overdue > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                        <AlertTriangleIcon className="size-3" />
                        {overdue} overdue
                    </span>
                )}
            </div>
        </div>
    );
};

// The signed-in user's unfinished tasks that are overdue, due today or due tomorrow
// Start–end (or "by 6:00 PM" for date-only tasks) and a live countdown to the end
const TaskTiming = ({ task, now, dayEnd }: { task: Task; now: number; dayEnd?: string }) => {
    const end = taskEndAt(task, dayEnd);
    const countdown = taskCountdown(task, now, dayEnd);
    if (!end || !countdown) return null;
    // Amber in the last 30 minutes before the start (or, once running, before the end)
    const soon = countdown.phase !== "ended" && countdown.msLeft <= 30 * 60_000;

    return (
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ClockIcon className="size-3 shrink-0" />
            <span className="truncate">
                {task.startAt ? formatTimeRange(task.startAt, task.durationMinutes) : `by ${formatTime(end.toISOString())}`}
            </span>
            <span
                className={cn(
                    "shrink-0 font-medium",
                    countdown.phase === "ended" ? "text-destructive" : soon ? "text-amber-600 dark:text-amber-400" : "text-primary",
                )}
                aria-label={countdown.phase === "upcoming" ? "Time to start" : countdown.phase === "running" ? "Time left" : "Ended"}
            >
                · {countdown.label}
            </span>
        </span>
    );
};

const MyWork = ({ tasks, memberId }: { tasks: Task[]; memberId?: string }) => {
    const { open } = useTaskPanel();
    const now = useNow();
    // Tasks with only a date are due by the end of the workspace's working day
    const workspaceId = useWorkspaceId();
    const { data: workspace } = useGetWorkspace({ workspaceId });
    const dayEnd = workspace?.workDayEnd;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    // Soonest-ending first
    const mine = tasks
        .filter((task) => memberId && task.assigneeIds?.includes(memberId) && task.status !== "DONE" && task.dueDate)
        .sort((a, b) => (taskEndAt(a, dayEnd)?.getTime() ?? 0) - (taskEndAt(b, dayEnd)?.getTime() ?? 0));
    const dayAfterStart = new Date(tomorrowStart);
    dayAfterStart.setDate(dayAfterStart.getDate() + 1);

    const overdue = mine.filter((task) => new Date(task.dueDate) < todayStart);
    const dueToday = mine.filter((task) => {
        const due = new Date(task.dueDate);
        return due >= todayStart && due < tomorrowStart;
    });
    const dueTomorrow = mine.filter((task) => {
        const due = new Date(task.dueDate);
        return due >= tomorrowStart && due < dayAfterStart;
    });

    const group = (label: string, items: Task[], tone: string) => items.length > 0 && (
        <div className="space-y-2">
            <p className={cn("text-sm font-semibold", tone)}>{label} <span className="font-normal text-muted-foreground">({items.length})</span></p>
            <ul className="space-y-1.5">
                {items.map((task) => (
                    <li key={task.$id} className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-1.5 transition-colors duration-200 ease-out hover:bg-accent/60">
                        <button
                            type="button"
                            onClick={() => open(task.$id)}
                            className="min-w-0 flex-1 py-0.5 text-left min-h-0"
                        >
                            <span className="flex items-center justify-between gap-3">
                                <span className="truncate text-sm font-medium">{task.name}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{task.project?.name}</span>
                            </span>
                            <TaskTiming task={task} now={now} dayEnd={dayEnd} />
                        </button>
                        {/* Marking a task done takes it off this list */}
                        <TaskStatusMenu task={task} align="end" />
                    </li>
                ))}
            </ul>
        </div>
    );

    return (
        <Card>
            <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <ListChecksIcon className="size-5 text-primary" />
                    <h2 className="text-lg font-semibold">My work</h2>
                </div>
                {overdue.length === 0 && dueToday.length === 0 && dueTomorrow.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing overdue or due today or tomorrow. You&apos;re all caught up.</p>
                ) : (
                    <div className="space-y-4">
                        {group("Overdue", overdue, "text-destructive")}
                        {group("Due today", dueToday, "text-primary")}
                        {group("Tomorrow", dueTomorrow, "text-muted-foreground")}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export const WorkspaceIdClient = () => {
    const workspaceId = useWorkspaceId();
    const { open: openCreateProject } = useCreateProjectModal();
    const { canEditWork } = usePermissions({ workspaceId });

    const { data: tasks, isLoading: isLoadingTasks, error: tasksError } = useGetTasks({ workspaceId });
    const { data: projects, isLoading: isLoadingProjects, error: projectsError } = useGetProjects({ workspaceId });
    const { data: members, isLoading: isLoadingMembers, error: membersError } = useGetMembers({ workspaceId });
    const { data: currentUser } = useCurrent();
    const { weekStart } = usePreferences();
    const { data: workspace } = useGetWorkspace({ workspaceId });
    const now = useNow();

    useRedirectOnAccessError(tasksError, projectsError, membersError);

    // Keep showing the loader while an access-error redirect happens
    if (isLoadingTasks || isLoadingProjects || isLoadingMembers || [tasksError, projectsError, membersError].some(isAccessError)) {
        return <PageSkeleton />
    }

    if (!tasks || !projects || !members) {
        return <PageError message="Failed to load workspace data" />
    }

    // Routine tasks only for this week; sprint progress still counts the whole sprint
    const listTasks = splitByRoutineWeek(tasks.documents, weekStart).visible;
    const memberId = members.documents.find((member) => member.userId === currentUser?.$id)?.$id;

    return (
        <Stagger className="flex flex-col gap-6">
            <StaggerItem><EnableRemindersCard /></StaggerItem>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCards tasks={listTasks} workspaceId={workspaceId} dayEnd={workspace?.workDayEnd} now={now} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <StaggerItem className="lg:col-span-2">
                    <WeekChart tasks={listTasks} memberId={memberId} weekStart={weekStart} />
                </StaggerItem>
                <StaggerItem>
                    <SprintDonut tasks={tasks.documents} projects={projects.documents} />
                </StaggerItem>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <StaggerItem className="lg:col-span-2">
                    <MyWork tasks={listTasks} memberId={memberId} />
                </StaggerItem>
                <StaggerItem>
                    <TeamCard members={members.documents} tasks={listTasks} />
                </StaggerItem>
            </div>

            {/* Projects */}
            <StaggerItem className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold tracking-tight">Projects</h2>
                    {canEditWork && (
                        <Button onClick={openCreateProject}>
                            <PlusIcon className="mr-2 h-4 w-4" />
                            New Project
                        </Button>
                    )}
                </div>

                {projects.documents.length === 0 ? (
                    <NoProjectsState canCreate={canEditWork} onCreate={openCreateProject} />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projects.documents.map((project) => (
                            <ProjectCard
                                key={project.$id}
                                href={`/workspaces/${workspaceId}/projects/${project.$id}`}
                                name={project.name}
                                description={project.currentSprintStartDate && project.currentSprintEndDate
                                    ? getSprintSummary(project.currentSprintStartDate, project.currentSprintEndDate)
                                    : `Sprint ${project.sprintNumber || 1} • ${project.sprintDuration || 14} days`}
                            >
                                <SprintProgress tasks={tasks.documents} projectId={project.$id} />
                                {project.currentSprintStartDate && project.currentSprintEndDate && (
                                    <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                                        <CalendarIcon className="size-3.5 text-primary" />
                                        <span className="font-medium text-foreground">Sprint {project.sprintNumber || 1}</span>
                                        <span className="ml-auto">
                                            {formatDateDDMMYYYY(project.currentSprintStartDate)} – {formatDateDDMMYYYY(project.currentSprintEndDate)}
                                        </span>
                                    </div>
                                )}
                            </ProjectCard>
                        ))}
                    </div>
                )}
            </StaggerItem>
        </Stagger>
    );
};
