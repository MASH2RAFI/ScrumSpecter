"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BarChart3Icon, TrendingUpIcon, TargetIcon, CalendarIcon } from "lucide-react";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { TaskStatus } from "@/features/tasks/types";

interface Sprint {
    id: string;
    name: string;
    storyPoints: number;
    completedPoints: number;
    velocity: number;
}

export const VelocityTracker = () => {
    const workspaceId = useWorkspaceId();
    const { data: tasks } = useGetTasks({ workspaceId });
    const { data: projects } = useGetProjects({ workspaceId });
    
    const [sprints, setSprints] = useState<Sprint[]>([]);

    useEffect(() => {
        if (tasks?.documents && projects?.documents) {
            // Group tasks by project and calculate velocity for each project
            const projectVelocity = projects.documents.map(project => {
                const projectTasks = tasks.documents.filter(task => task.projectId === project.$id);
                const totalStoryPoints = projectTasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
                const completedTasks = projectTasks.filter(task => task.status === TaskStatus.DONE);
                const completedPoints = completedTasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
                const velocity = totalStoryPoints > 0 ? Math.round((completedPoints / totalStoryPoints) * 100) : 0;
                
                return {
                    id: project.$id,
                    name: project.name,
                    storyPoints: totalStoryPoints,
                    completedPoints,
                    velocity,
                };
            });
            
            setSprints(projectVelocity);
        }
    }, [tasks, projects]);


    const getAverageVelocity = () => {
        if (sprints.length === 0) return 0;
        const totalVelocity = sprints.reduce((sum, sprint) => sum + sprint.velocity, 0);
        return Math.round(totalVelocity / sprints.length);
    };

    const getVelocityTrend = () => {
        if (sprints.length < 2) return "stable";
        const recent = sprints.slice(-3);
        const avgRecent = recent.reduce((sum, sprint) => sum + sprint.velocity, 0) / recent.length;
        const avgOverall = getAverageVelocity();
        
        if (avgRecent > avgOverall * 1.1) return "increasing";
        if (avgRecent < avgOverall * 0.9) return "decreasing";
        return "stable";
    };

    const getTrendColor = () => {
        const trend = getVelocityTrend();
        switch (trend) {
            case "increasing": return "text-green-600";
            case "decreasing": return "text-red-600";
            default: return "text-blue-600";
        }
    };

    const getTrendIcon = () => {
        const trend = getVelocityTrend();
        switch (trend) {
            case "increasing": return "↗";
            case "decreasing": return "↘";
            default: return "→";
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3Icon className="h-5 w-5" />
                        Team Velocity Tracker
                    </CardTitle>
                    <CardDescription>
                        Track your team&apos;s velocity across multiple sprints
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2">
                                    <TargetIcon className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-medium">Average Velocity</span>
                                </div>
                                <p className="text-2xl font-bold text-primary">
                                    {getAverageVelocity()}%
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2">
                                    <TrendingUpIcon className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-medium">Velocity Trend</span>
                                </div>
                                <p className={`text-2xl font-bold ${getTrendColor()}`}>
                                    {getTrendIcon()} {getVelocityTrend()}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-medium">Total Sprints</span>
                                </div>
                                <p className="text-2xl font-bold text-primary">
                                    {sprints.length}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2">
                                    <BarChart3Icon className="h-4 w-4 text-purple-600" />
                                    <span className="text-sm font-medium">Best Velocity</span>
                                </div>
                                <p className="text-2xl font-bold text-purple-600">
                                    {sprints.length > 0 ? Math.max(...sprints.map(s => s.velocity)) : 0}%
                                </p>
                            </CardContent>
                        </Card>
                    </div>


                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Sprint History</h3>
                        <div className="space-y-3">
                            {sprints.map((sprint) => (
                                <div key={sprint.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                                    <div>
                                        <Label className="text-sm font-medium">Sprint</Label>
                                        <p className="text-lg font-semibold">{sprint.name}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium">Story Points</Label>
                                        <p className="text-lg">{sprint.storyPoints}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium">Completed</Label>
                                        <p className="text-lg">{sprint.completedPoints}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium">Velocity</Label>
                                        <p className={`text-lg font-bold ${
                                            sprint.velocity >= 90 ? 'text-green-600' :
                                            sprint.velocity >= 80 ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                            {sprint.velocity}%
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Velocity Chart</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Velocity (%)</span>
                                    <span>Sprints</span>
                                </div>
                                <div className="relative h-64 border-l border-b border-border">
                                    {/* Y-axis labels */}
                                    <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground">
                                        <span>100%</span>
                                        <span>75%</span>
                                        <span>50%</span>
                                        <span>25%</span>
                                        <span>0%</span>
                                    </div>
                                    
                                    {/* Chart area */}
                                    <div className="ml-8 h-full relative">
                                        {/* Velocity bars */}
                                        <div className="flex items-end justify-between h-full gap-2">
                                            {sprints.map((sprint) => (
                                                <div key={sprint.id} className="flex-1 flex flex-col items-center">
                                                    <div
                                                        className="w-full bg-primary rounded-t"
                                                        style={{
                                                            height: `${sprint.velocity}%`,
                                                            minHeight: '4px'
                                                        }}
                                                    ></div>
                                                    <span className="text-xs mt-1 text-muted-foreground">
                                                        {sprint.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {/* Average line */}
                                        <div
                                            className="absolute w-full border-t-2 border-dashed border-yellow-500"
                                            style={{
                                                bottom: `${getAverageVelocity()}%`
                                            }}
                                        ></div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-primary rounded"></div>
                                        <span>Velocity</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-0.5 bg-yellow-500 border-dashed"></div>
                                        <span>Average</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
        </div>
    );
};
