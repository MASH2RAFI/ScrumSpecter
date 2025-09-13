"use client";

import { DottedSeparator } from "@/components/dotted-separator";
import { PageError } from "@/components/page-error";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { formatDateDDMMYYYY } from "@/lib/sprint-utils";
import { CalendarIcon, PlusIcon, SettingsIcon, TargetIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const WorkspaceIdClient = () => {
    const router = useRouter();
    const workspaceId = useWorkspaceId();
    const { open: openCreateProject } = useCreateProjectModal();
    const { isAdmin } = useIsAdmin({ workspaceId });

    const { data: tasks, isLoading: isLoadingTasks, error: tasksError } = useGetTasks({workspaceId})
    const { data: projects, isLoading: isLoadingProjects, error: projectsError } = useGetProjects({workspaceId})
    const { data: members, isLoading: isLoadingMembers, error: membersError } = useGetMembers({workspaceId})

    // Check for workspace not found errors and redirect
    useEffect(() => {
        const hasWorkspaceError = tasksError || projectsError || membersError;
        
        if (hasWorkspaceError) {
            // Check if any of the errors indicate workspace not found (401 Unauthorized or 404 Not Found)
            const isWorkspaceNotFound = [tasksError, projectsError, membersError].some(error => {
                if (error && typeof error === 'object' && 'message' in error) {
                    const message = (error as Error).message.toLowerCase();
                    return message.includes('unauthorized') || 
                           message.includes('not found') || 
                           message.includes('failed to fetch');
                }
                return false;
            });

            if (isWorkspaceNotFound) {
                // Redirect to create workspace page
                router.push('/workspaces/create');
            }
        }
    }, [tasksError, projectsError, membersError, router]);

    const isLoading = 
        isLoadingTasks     ||
        isLoadingProjects  ||
        isLoadingMembers; 
        
    if (isLoading) {
        return <PageLoader />
    }
    
    // If there are errors, show loading while redirect happens
    if (tasksError || projectsError || membersError) {
        return <PageLoader />
    }
    
    if (!tasks || !projects || !members) { 
        return <PageError message="Failed to load workspace data" />
    }

    return ( 
        <div className="h-full flex flex-col space-y-8">
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
                    <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-r from-muted/20 to-muted/10 mb-6">
                            <TargetIcon className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Create your first project to get started with sprints and task management
                        </p>
                        {isAdmin && (
                            <Button onClick={openCreateProject}>
                                <PlusIcon className="mr-2 h-4 w-4" />
                                Create Project
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.documents.map((project) => (
                            <Card key={project.$id} className="hover:shadow-lg transition-shadow duration-200">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">{project.name}</CardTitle>
                                        <TargetIcon className="h-5 w-5 text-primary" />
                                    </div>
                                    <CardDescription>
                                        {project.currentSprintStartDate && project.currentSprintEndDate ? (
                                            <>
                                                {(() => {
                                                    const now = new Date();
                                                    const endDate = new Date(project.currentSprintEndDate);
                                                    const startDate = new Date(project.currentSprintStartDate);
                                                    const daysRemaining = Math.max(0, differenceInDays(endDate, now));
                                                    const totalDays = differenceInDays(endDate, startDate) + 1;
                                                    return `${daysRemaining} days remaining • ${totalDays} days total`;
                                                })()}
                                            </>
                                        ) : (
                                            `Sprint ${project.sprintNumber || 1} • ${project.sprintDuration || 14} days`
                                        )}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
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
                                        <Button asChild className="w-full">
                                            <Link href={`/workspaces/${workspaceId}/projects/${project.$id}`}>
                                                View Project
                                            </Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <TaskList  data={tasks.documents} total= {tasks.total}/>
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
                    {data.map( (task) => (
                        <li key={task.$id}> 
                            <Link href={`/workspaces/${workspaceId}/tasks/${task.$id} `}>
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
                                            {task.storyPoints && (
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
                        <Link href={ `/workspaces/${workspaceId}/members` }>
                            <SettingsIcon className="size-4 text-muted-foreground" />
                        </Link>
                    </Button>
                </div>
                <DottedSeparator className="my-4" /> 
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"> 
                    {data.map( (member) => {
                        // Calculate text length to determine appropriate styling
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