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
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { BurndownDay, calculateVelocity, generateBurndownData, getProjectPointStats } from "@/lib/sprint-utils";

import { BurndownGraph, ProjectSelect, StatCard } from "./analytics-shared";

export const BurndownChart = () => {
    const workspaceId = useWorkspaceId();
    const { canEditWork } = usePermissions({ workspaceId });
    const { data: tasks } = useGetTasks({ workspaceId });
    const { data: projects } = useGetProjects({ workspaceId });

    const [selectedProject, setSelectedProject] = useState<string>("");
    const [sprintDuration, setSprintDuration] = useState(14);
    const [totalStoryPoints, setTotalStoryPoints] = useState(0);
    const [completedStoryPoints, setCompletedStoryPoints] = useState(0);
    const [sprintDays, setSprintDays] = useState<BurndownDay[]>([]);

    useEffect(() => {
        if (selectedProject && tasks?.documents) {
            const stats = getProjectPointStats(tasks.documents, selectedProject);
            setTotalStoryPoints(stats.totalStoryPoints);
            setCompletedStoryPoints(stats.completedStoryPoints);
        }
    }, [selectedProject, tasks]);

    const progressPercentage = calculateVelocity(completedStoryPoints, totalStoryPoints);

    const getStatusColor = () => {
        const expectedProgress = (sprintDays.length / sprintDuration) * 100;

        if (progressPercentage >= expectedProgress) return "text-green-600";
        if (progressPercentage >= expectedProgress * 0.8) return "text-yellow-600";
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
                    <ProjectSelect
                        projects={projects?.documents}
                        value={selectedProject}
                        onChange={setSelectedProject}
                    />

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
                                    disabled={!canEditWork}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="total-points">Total Story Points</Label>
                                <Input
                                    id="total-points"
                                    type="number"
                                    value={totalStoryPoints}
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
                                    min="0"
                                    max={totalStoryPoints}
                                    readOnly
                                />
                            </div>
                        </div>
                    )}

                    <Button
                        onClick={() => setSprintDays(generateBurndownData(totalStoryPoints, completedStoryPoints, sprintDuration))}
                        className="w-full"
                    >
                        Generate Burndown Chart
                    </Button>

                    {sprintDays.length > 0 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <StatCard
                                    icon={TargetIcon}
                                    iconClassName="text-primary"
                                    label="Progress"
                                    value={`${progressPercentage}%`}
                                    valueClassName={getStatusColor()}
                                />
                                <StatCard
                                    icon={CheckCircleIcon}
                                    iconClassName="text-green-600"
                                    label="Completed"
                                    value={`${completedStoryPoints} pts`}
                                    valueClassName="text-green-600"
                                />
                                <StatCard
                                    icon={CalendarIcon}
                                    iconClassName="text-primary"
                                    label="Remaining"
                                    value={`${totalStoryPoints - completedStoryPoints} pts`}
                                    valueClassName="text-primary"
                                />
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Burndown Chart</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <BurndownGraph data={sprintDays} totalPoints={totalStoryPoints} />
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
