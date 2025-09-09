"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUpIcon, CalendarIcon, TargetIcon, CheckCircleIcon } from "lucide-react";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useIsAdmin } from "@/features/members/hooks/use-is-admin";
import { TaskStatus } from "@/features/tasks/types";

interface SprintDay {
    day: number;
    remainingWork: number;
    idealBurndown: number;
}

export const BurndownChart = () => {
    const workspaceId = useWorkspaceId();
    const { isAdmin } = useIsAdmin({ workspaceId });
    const { data: tasks } = useGetTasks({ workspaceId });
    const { data: projects } = useGetProjects({ workspaceId });
    
    const [selectedProject, setSelectedProject] = useState<string>("");
    const [sprintDuration, setSprintDuration] = useState(14);
    const [totalStoryPoints, setTotalStoryPoints] = useState(0);
    const [completedStoryPoints, setCompletedStoryPoints] = useState(0);
    const [sprintDays, setSprintDays] = useState<SprintDay[]>([]);

    useEffect(() => {
        if (selectedProject && tasks?.documents) {
            const projectTasks = tasks.documents.filter(task => task.projectId === selectedProject);
            const total = projectTasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
            const completed = projectTasks
                .filter(task => task.status === TaskStatus.DONE)
                .reduce((sum, task) => sum + (task.storyPoints || 0), 0);
            
            setTotalStoryPoints(total);
            setCompletedStoryPoints(completed);
        }
    }, [selectedProject, tasks]);

    const generateBurndownData = () => {
        const days: SprintDay[] = [];
        const idealBurndownRate = totalStoryPoints / sprintDuration;

        for (let day = 1; day <= sprintDuration; day++) {
            const idealBurndown = Math.max(0, totalStoryPoints - (idealBurndownRate * day));
            const actualRemaining = Math.max(0, totalStoryPoints - completedStoryPoints);
            
            days.push({
                day,
                remainingWork: actualRemaining,
                idealBurndown: Math.round(idealBurndown * 100) / 100,
            });
        }
        setSprintDays(days);
    };

    const getProgressPercentage = () => {
        return Math.round((completedStoryPoints / totalStoryPoints) * 100);
    };

    const getStatusColor = () => {
        const progress = getProgressPercentage();
        const expectedProgress = (sprintDays.length / sprintDuration) * 100;
        
        if (progress >= expectedProgress) return "text-green-600";
        if (progress >= expectedProgress * 0.8) return "text-yellow-600";
        return "text-red-600";
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUpIcon className="h-5 w-5" />
                        Sprint Burndown Chart
                    </CardTitle>
                    <CardDescription>
                        Track your sprint progress and compare with ideal burndown
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="project-select">Select Project</Label>
                            <select
                                id="project-select"
                                value={selectedProject}
                                onChange={(e) => setSelectedProject(e.target.value)}
                                className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                            >
                                <option value="">Select a project</option>
                                {projects?.documents.map(project => (
                                    <option key={project.$id} value={project.$id}>
                                        {project.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    {selectedProject && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="sprint-duration">Sprint Duration (days)</Label>
                                <Input
                                    id="sprint-duration"
                                    type="number"
                                    value={sprintDuration}
                                    onChange={(e) => setSprintDuration(Number(e.target.value))}
                                    min="1"
                                    max="30"
                                    disabled={!isAdmin}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="total-points">Total Story Points</Label>
                                <Input
                                    id="total-points"
                                    type="number"
                                    value={totalStoryPoints}
                                    onChange={(e) => setTotalStoryPoints(Number(e.target.value))}
                                    min="1"
                                    readOnly
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="completed-points">Completed Story Points</Label>
                                <Input
                                    id="completed-points"
                                    type="number"
                                    value={completedStoryPoints}
                                    onChange={(e) => setCompletedStoryPoints(Number(e.target.value))}
                                    min="0"
                                    max={totalStoryPoints}
                                    readOnly
                                />
                            </div>
                        </div>
                    )}

                    <Button onClick={generateBurndownData} className="w-full">
                        Generate Burndown Chart
                    </Button>

                    {sprintDays.length > 0 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2">
                                            <TargetIcon className="h-4 w-4 text-primary" />
                                            <span className="text-sm font-medium">Progress</span>
                                        </div>
                                        <p className={`text-2xl font-bold ${getStatusColor()}`}>
                                            {getProgressPercentage()}%
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2">
                                            <CheckCircleIcon className="h-4 w-4 text-green-600" />
                                            <span className="text-sm font-medium">Completed</span>
                                        </div>
                                        <p className="text-2xl font-bold text-green-600">
                                            {completedStoryPoints} pts
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className="h-4 w-4 text-primary" />
                                            <span className="text-sm font-medium">Remaining</span>
                                        </div>
                                        <p className="text-2xl font-bold text-primary">
                                            {totalStoryPoints - completedStoryPoints} pts
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Burndown Chart</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-sm text-muted-foreground">
                                            <span>Story Points</span>
                                            <span>Days</span>
                                        </div>
                                        <div className="relative h-64 border-l border-b border-border">
                                            {/* Y-axis labels */}
                                            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground">
                                                <span>{totalStoryPoints}</span>
                                                <span>{Math.round(totalStoryPoints * 0.75)}</span>
                                                <span>{Math.round(totalStoryPoints * 0.5)}</span>
                                                <span>{Math.round(totalStoryPoints * 0.25)}</span>
                                                <span>0</span>
                                            </div>
                                            
                                            {/* Chart area */}
                                            <div className="ml-8 h-full relative">
                                                {/* Ideal burndown line */}
                                                <svg className="absolute inset-0 w-full h-full">
                                                    <polyline
                                                        points={sprintDays.map((day, index) => 
                                                            `${(index / (sprintDays.length - 1)) * 100},${100 - (day.idealBurndown / totalStoryPoints) * 100}`
                                                        ).join(' ')}
                                                        fill="none"
                                                        stroke="#3b82f6"
                                                        strokeWidth="2"
                                                        strokeDasharray="5,5"
                                                    />
                                                </svg>
                                                
                                                {/* Actual burndown line */}
                                                <svg className="absolute inset-0 w-full h-full">
                                                    <polyline
                                                        points={sprintDays.map((day, index) => 
                                                            `${(index / (sprintDays.length - 1)) * 100},${100 - (day.remainingWork / totalStoryPoints) * 100}`
                                                        ).join(' ')}
                                                        fill="none"
                                                        stroke="#ef4444"
                                                        strokeWidth="2"
                                                    />
                                                </svg>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-0.5 bg-primary"></div>
                                                <span>Ideal Burndown</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-0.5 bg-red-500"></div>
                                                <span>Actual Burndown</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
