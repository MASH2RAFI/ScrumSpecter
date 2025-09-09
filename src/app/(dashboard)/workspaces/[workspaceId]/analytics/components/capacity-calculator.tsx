"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalculatorIcon, UsersIcon, TargetIcon } from "lucide-react";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

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
    const { data: tasks } = useGetTasks({ workspaceId });
    
    const [selectedProject, setSelectedProject] = useState<string>("");
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [sprintDuration, setSprintDuration] = useState(14);
    const [totalCapacity, setTotalCapacity] = useState(0);

    useEffect(() => {
        if (selectedProject && members?.documents && tasks?.documents) {
            // Get members who are assigned to tasks in the selected project
            const projectTasks = tasks.documents.filter(task => task.projectId === selectedProject);
            const assignedMemberIds = new Set(projectTasks.map(task => task.assigneeId).filter(Boolean));
            
            const projectTeamMembers = members.documents
                .filter(member => assignedMemberIds.has(member.$id))
                .map(member => ({
                    id: member.$id,
                    name: member.name,
                    capacity: 8,
                    availability: 100,
                }));
            
            setTeamMembers(projectTeamMembers);
        } else {
            setTeamMembers([]);
        }
    }, [selectedProject, members, tasks]);

    const calculateCapacity = () => {
        const total = teamMembers.reduce((sum, member) => {
            return sum + (member.capacity * member.availability / 100 * sprintDuration);
        }, 0);
        setTotalCapacity(Math.round(total));
    };

    const updateTeamMember = (id: string, field: keyof TeamMember, value: string | number) => {
        setTeamMembers(teamMembers.map(member => 
            member.id === id ? { ...member, [field]: value } : member
        ));
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
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="sprint-duration">Sprint Duration (days)</Label>
                                    <Input
                                        id="sprint-duration"
                                        type="number"
                                        value={sprintDuration}
                                        onChange={(e) => setSprintDuration(Number(e.target.value))}
                                        min="1"
                                        max="30"
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
                                                    min="1"
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

                            <Button onClick={calculateCapacity} className="w-full">
                                Calculate Capacity
                            </Button>
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