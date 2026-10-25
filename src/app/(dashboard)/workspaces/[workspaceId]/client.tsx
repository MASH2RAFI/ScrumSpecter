"use client";

import { DottedSeparator } from "@/components/dotted-separator";
import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { NoProjectsState, ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRedirectOnAccessError } from "@/hooks/use-redirect-on-access-error";
import { isAccessError } from "@/lib/api-error";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { Member } from "@/features/members/types";
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useCreateProjectModal } from "@/features/projects/hooks/use-create-project-modal";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useCreateTaskModal } from "@/features/tasks/hooks/use-create-task-modal";
import { Task } from "@/features/tasks/types";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { formatDistanceToNow } from "date-fns";
import { calculateVelocity, formatDateDDMMYYYY, getProjectPointStats, sprintLengthInDays } from "@/lib/sprint-utils";
import { AlertTriangleIcon, CalendarIcon, ListChecksIcon, PlusIcon, SettingsIcon, TargetIcon } from "lucide-react";
import { useCurrent } from "@/features/auth/api/use-current";
import { useTaskPanel } from "@/features/tasks/hooks/use-task-panel";
import Link from "next/link";

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
            <div
                className="h-2 w-full rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Story points completed"
            >
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
            </div>
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

// The signed-in user's unfinished tasks that are overdue or due today
const MyWork = ({ tasks, memberId }: { tasks: Task[]; memberId?: string }) => {
    const { open } = useTaskPanel();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const mine = tasks.filter((task) => memberId && task.assigneeId === memberId && task.status !== "DONE" && task.dueDate);
    const overdue = mine.filter((task) => new Date(task.dueDate) < todayStart);
    const dueToday = mine.filter((task) => {
        const due = new Date(task.dueDate);
        return due >= todayStart && due < tomorrowStart;
    });

    const group = (label: string, items: Task[], tone: string) => items.length > 0 && (
        <div className="space-y-2">
            <p className={cn("text-xs font-semibold uppercase tracking-wide", tone)}>{label} · {items.length}</p>
            <ul className="space-y-1.5">
                {items.map((task) => (
                    <li key={task.$id}>
                        <button
                            type="button"
                            onClick={() => open(task.$id)}
                            className="w-full flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-left hover:bg-accent transition-colors"
                        >
                            <span className="truncate text-sm font-medium">{task.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{task.project?.name}</span>
                        </button>
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
                {overdue.length === 0 && dueToday.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing overdue or due today. You&apos;re all caught up.</p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {group("Overdue", overdue, "text-destructive")}
                        {group("Due today", dueToday, "text-primary")}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export const WorkspaceIdClient = () => {
    const workspaceId = useWorkspaceId();
    const { open: openCreateProject } = useCreateProjectModal();
    const { isAdmin } = useIsAdmin({ workspaceId });

    const { data: tasks, isLoading: isLoadingTasks, error: tasksError } = useGetTasks({ workspaceId });
    const { data: projects, isLoading: isLoadingProjects, error: projectsError } = useGetProjects({ workspaceId });
    const { data: members, isLoading: isLoadingMembers, error: membersError } = useGetMembers({ workspaceId });
    const { data: currentUser } = useCurrent();

    useRedirectOnAccessError(tasksError, projectsError, membersError);

    // Keep showing the loader while an access-error redirect happens
    if (isLoadingTasks || isLoadingProjects || isLoadingMembers || [tasksError, projectsError, membersError].some(isAccessError)) {
        return <PageLoader />
    }

    if (!tasks || !projects || !members) {
        return <PageError message="Failed to load workspace data" />
    }

    return (
        <div className="h-full flex flex-col space-y-8">
            <MyWork
                tasks={tasks.documents}
                memberId={members.documents.find((member) => member.userId === currentUser?.$id)?.$id}
            />
            {/* Projects */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-3 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        <div className="p-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5">
                            <TargetIcon className="h-6 w-6 text-primary" />
                        </div>
                        Projects
                    </h2>
                    {isAdmin && (
                        <Button onClick={openCreateProject}>
                            <PlusIcon className="mr-2 h-4 w-4" />
                            New Project
                        </Button>
                    )}
                </div>

                {projects.documents.length === 0 ? (
                    <NoProjectsState canCreate={isAdmin} onCreate={openCreateProject} />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                    <div className="bg-muted/50 rounded-lg p-3">
                                        <div className="flex items-center gap-2 text-sm">
                                            <CalendarIcon className="h-4 w-4 text-primary" />
                                            <span className="font-medium">Sprint {project.sprintNumber || 1}</span>
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            Started: {formatDateDDMMYYYY(project.currentSprintStartDate)}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Ends: {formatDateDDMMYYYY(project.currentSprintEndDate)}
                                        </div>
                                    </div>
                                )}
                            </ProjectCard>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <TaskList data={tasks.documents} total={tasks.total} />
                <MembersList data={members.documents} total={members.total} />
            </div>
        </div>
    );
};

interface TaskListProps {
    data: Task[];
    total: number;
};

export const TaskList = ({ data, total }: TaskListProps) => {
    const { open: createTask } = useCreateTaskModal();
    const workspaceId = useWorkspaceId();
    const { isAdmin } = useIsAdmin({ workspaceId });
    return (
        <div className="flex flex-col gap-y-4 col-span-1">
            <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold">
                        Tasks ({total})
                    </p>
                    {isAdmin && (
                        <Button variant="muted" size="icon" onClick={() => createTask()}>
                            <PlusIcon className="size-4 text-muted-foreground" />
                        </Button>
                    )}
                </div>
                <DottedSeparator className="my-4" />
                <ul className="flex flex-col gap-y-4">
                    {data.map((task) => (
                        <li key={task.$id}>
                            <Link href={`/workspaces/${workspaceId}/tasks/${task.$id}`}>
                                <Card className="shadow-none rounded-lg hover:opacity-75 transition">
                                    <CardContent className="p-4">
                                        <p className="text-lg font-medium truncate">{task.name}</p>
                                        <div className="flex items-center gap-x-2">
                                            <p className="text-sm text-muted-foreground">{task.project?.name}</p>
                                            <div className="size-1 rounded-full bg-border" />
                                            <div className="text-sm text-muted-foreground flex items-center">
                                                <CalendarIcon className="size-3 mr-1" />
                                                <span className="truncate">
                                                    {formatDistanceToNow(new Date(task.dueDate))}
                                                </span>
                                            </div>
                                            {/* 0 is a real estimate; `&&` would render a bare "0" */}
                                            {task.storyPoints != null && (
                                                <>
                                                    <div className="size-1 rounded-full bg-border" />
                                                    <div className="text-sm text-muted-foreground flex items-center">
                                                        <TargetIcon className="size-3 mr-1" />
                                                        <span>{task.storyPoints} pts</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </li>
                    ))}
                    <li className="text-sm text-muted-foreground text-center hidden first-of-type:block">
                        No tasks found
                    </li>
                </ul>
                <Button variant="muted" className="mt-4 w-full" asChild>
                    <Link href={`/workspaces/${workspaceId}/tasks`}>
                        Show ALL
                    </Link>
                </Button>
            </div>
        </div>
    );
};

interface MembersListProps {
    data: Member[];
    total: number;
};

export const MembersList = ({ data, total }: MembersListProps) => {
    const workspaceId = useWorkspaceId();

    return (
        <div className="flex flex-col gap-y-4 col-span-1">
            <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold">
                        Members ({total})
                    </p>
                    <Button asChild variant="secondary" size="icon">
                        <Link href={`/workspaces/${workspaceId}/members`}>
                            <SettingsIcon className="size-4 text-muted-foreground" />
                        </Link>
                    </Button>
                </div>
                <DottedSeparator className="my-4" />
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.map((member) => {
                        const nameLength = member.name?.length || 0;
                        const emailLength = member.email?.length || 0;
                        const isLongName = nameLength > 20;
                        const isLongEmail = emailLength > 30;

                        return (
                            <li key={member.$id}>
                                <Card className="shadow-none rounded-lg overflow-hidden h-full">
                                    <CardContent className="p-4 flex flex-col items-center gap-3 min-h-[120px]">
                                        <MemberAvatar
                                            className="size-12 flex-shrink-0"
                                            fallbackClassName="text-lg"
                                            name={member.name}
                                        />
                                        <div className="flex flex-col items-center text-center w-full space-y-1">
                                            <p className={`font-medium break-words w-full ${
                                                isLongName ? 'text-sm' : 'text-base'
                                            }`}>
                                                {member.name}
                                            </p>
                                            <p className={`text-muted-foreground break-words w-full ${
                                                isLongEmail ? 'text-xs' : 'text-sm'
                                            }`}>
                                                {member.email}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </li>
                        );
                    })}
                    <li className="text-sm text-muted-foreground text-center hidden first-of-type:block">
                        No members found
                    </li>
                </ul>
            </div>
        </div>
    );
};