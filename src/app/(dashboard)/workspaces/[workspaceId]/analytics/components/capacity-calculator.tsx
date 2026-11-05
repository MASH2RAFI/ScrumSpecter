"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalculatorIcon, UsersIcon, TargetIcon } from "lucide-react";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

import { ChartDownloads } from "@/features/export/components/chart-downloads";
import { downloadChartPng, downloadCsv } from "@/features/export/download";

import { ProjectSelect } from "./analytics-shared";

interface TeamMember {
    id: string;
    name: string;
    capacity: number;
    availability: number;
}

export const CapacityCalculator = () => {
    const workspaceId = useWorkspaceId();
    const { data: members } = useGetMembers({ workspaceId });
    const { data: projects } = useGetProjects({ workspaceId });

    const [selectedProject, setSelectedProject] = useState<string>("");
    // Just the chosen project's tasks
    const { data: tasks } = useGetTasks({ workspaceId, projectId: selectedProject, enabled: Boolean(selectedProject) });
    // The person's own numbers per member; the rest default to 8 hours a day, fully available
    const [edits, setEdits] = useState<Record<string, Partial<TeamMember>>>({});
    const [sprintDuration, setSprintDuration] = useState(14);

    // The members assigned to the selected project's tasks
    const assignedMemberIds = new Set(tasks?.documents.filter((task) => task.projectId === selectedProject).flatMap((task) => task.assigneeIds));
    const teamMembers: TeamMember[] = selectedProject ? (members?.documents ?? [])
        .filter((member) => assignedMemberIds.has(member.$id))
        .map((member) => ({ id: member.$id, name: member.name, capacity: 8, availability: 100, ...edits[member.$id] })) : [];

    const memberHours = (member: TeamMember) => Math.round(member.capacity * member.availability / 100 * sprintDuration);

    // The sum of the rows, so it always matches them (and follows every edit and project change)
    const totalCapacity = teamMembers.reduce((sum, member) => sum + memberHours(member), 0);

    // Typed numbers stay in range: up to 24 hours a day, 0 to 100 % available
    const limits = { capacity: [0, 24], availability: [0, 100] } as const;
    const updateTeamMember = (id: string, field: "capacity" | "availability", value: string | number) => {
        const [low, high] = limits[field];
        const number = Math.min(high, Math.max(low, Number(value) || 0));
        setEdits((current) => ({ ...current, [id]: { ...current[id], [field]: number } }));
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalculatorIcon className="h-5 w-5" />
                        Sprint Capacity Calculator
                    </CardTitle>
                    <CardDescription>
                        Calculate your team&apos;s capacity for the upcoming sprint
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <ProjectSelect
                        projects={projects?.documents}
                        value={selectedProject}
                        onChange={(id) => { setSelectedProject(id); setEdits({}); }}
                    />

                    {selectedProject && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="sprint-duration">Sprint Duration (days)</Label>
                                    <Input
                                        id="sprint-duration"
                                        type="number"
                                        value={sprintDuration}
                                        onChange={(e) => setSprintDuration(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
                                        min="1"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Total Team Capacity</Label>
                                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                                        <TargetIcon className="h-4 w-4 text-primary" />
                                        <span className="text-lg font-semibold">{totalCapacity} hours</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <UsersIcon className="h-4 w-4" />
                                        Team Members
                                    </h3>
                                </div>

                                <div className="space-y-3">
                                    {teamMembers.map((member) => (
                                        <div key={member.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 border rounded-lg">
                                            <div>
                                                <Label>Name</Label>
                                                <Input
                                                    value={member.name}
                                                    readOnly
                                                />
                                            </div>
                                            <div>
                                                <Label>Daily Capacity (hours)</Label>
                                                <Input
                                                    type="number"
                                                    value={member.capacity}
                                                    onChange={(e) => updateTeamMember(member.id, 'capacity', Number(e.target.value))}
                                                    min="0"
                                                    max="24"
                                                />
                                            </div>
                                            <div>
                                                <Label>Availability (%)</Label>
                                                <Input
                                                    type="number"
                                                    value={member.availability}
                                                    onChange={(e) => updateTeamMember(member.id, 'availability', Number(e.target.value))}
                                                    min="0"
                                                    max="100"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <ChartDownloads
                                disabled={teamMembers.length === 0}
                                onPng={() => downloadChartPng({
                                    title: `Sprint capacity (${sprintDuration} days)`,
                                    kind: "bar",
                                    labels: teamMembers.map((member) => member.name),
                                    series: [{ name: "Hours", values: teamMembers.map(memberHours), color: "#2563eb" }],
                                    unit: " h",
                                    filename: "capacity.png",
                                })}
                                onCsv={() => downloadCsv([
                                    ["Member", "Daily capacity (h)", "Availability (%)", `Sprint hours (${sprintDuration} days)`],
                                    ...teamMembers.map((member) => [member.name, member.capacity, member.availability, memberHours(member)]),
                                ], "capacity.csv")}
                            />
                        </>
                    )}

                    {!selectedProject && (
                        <div className="text-center py-8 text-muted-foreground">
                            <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Please select a project to view team members and calculate capacity.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};