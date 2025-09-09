"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileTextIcon, DownloadIcon, UsersIcon, TargetIcon } from "lucide-react";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { TaskStatus } from "@/features/tasks/types";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface SprintReport {
    sprintName: string;
    startDate: string;
    endDate: string;
    teamMembers: string[];
    totalStoryPoints: number;
    completedStoryPoints: number;
    velocity: number;
    completedTasks: number;
    totalTasks: number;
    // Analytics data
    averageVelocity: number;
    velocityTrend: string;
    totalSprints: number;
    bestVelocity: number;
    sprintDuration: number;
    burndownData: Array<{
        day: number;
        remainingWork: number;
        idealBurndown: number;
    }>;
    taskStatusBreakdown: {
        todo: number;
        inProgress: number;
        done: number;
    };
}

export const SprintReportGenerator = () => {
    const workspaceId = useWorkspaceId();
    const { data: tasks } = useGetTasks({ workspaceId });
    const { data: projects } = useGetProjects({ workspaceId });
    const { data: members } = useGetMembers({ workspaceId });
    
    const [selectedProject, setSelectedProject] = useState<string>("");
    const [report, setReport] = useState<SprintReport>({
        sprintName: "",
        startDate: "",
        endDate: "",
        teamMembers: [],
        totalStoryPoints: 0,
        completedStoryPoints: 0,
        velocity: 0,
        completedTasks: 0,
        totalTasks: 0,
        averageVelocity: 0,
        velocityTrend: "stable",
        totalSprints: 0,
        bestVelocity: 0,
        sprintDuration: 14,
        burndownData: [],
        taskStatusBreakdown: {
            todo: 0,
            inProgress: 0,
            done: 0,
        },
    });


    useEffect(() => {
        if (selectedProject && tasks?.documents && projects?.documents && members?.documents) {
            const project = projects.documents.find(p => p.$id === selectedProject);
            const projectTasks = tasks.documents.filter(task => task.projectId === selectedProject);
            const projectMembers = members.documents.filter(member => 
                projectTasks.some(task => task.assigneeId === member.$id)
            );
            
            const totalStoryPoints = projectTasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
            const completedTasks = projectTasks.filter(task => task.status === TaskStatus.DONE);
            const completedStoryPoints = completedTasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
            const velocity = totalStoryPoints > 0 ? Math.round((completedStoryPoints / totalStoryPoints) * 100) : 0;
            
            // Calculate velocity analytics
            const allProjects = projects.documents;
            const projectVelocities = allProjects.map(p => {
                const pTasks = tasks.documents.filter(task => task.projectId === p.$id);
                const pTotal = pTasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);
                const pCompleted = pTasks.filter(task => task.status === TaskStatus.DONE).reduce((sum, task) => sum + (task.storyPoints || 0), 0);
                return pTotal > 0 ? Math.round((pCompleted / pTotal) * 100) : 0;
            });
            
            const averageVelocity = projectVelocities.length > 0 ? Math.round(projectVelocities.reduce((sum, v) => sum + v, 0) / projectVelocities.length) : 0;
            const bestVelocity = Math.max(...projectVelocities, 0);
            
            // Calculate task status breakdown
            const taskStatusBreakdown = {
                todo: projectTasks.filter(task => task.status === TaskStatus.TODO).length,
                inProgress: projectTasks.filter(task => task.status === TaskStatus.IN_PROGRESS).length,
                done: projectTasks.filter(task => task.status === TaskStatus.DONE).length,
            };
            
            // Generate burndown data
            const sprintDuration = 14; // Default sprint duration
            const burndownData = [];
            const idealBurndownRate = totalStoryPoints / sprintDuration;
            
            for (let day = 1; day <= sprintDuration; day++) {
                const idealBurndown = Math.max(0, totalStoryPoints - (idealBurndownRate * day));
                const actualRemaining = Math.max(0, totalStoryPoints - completedStoryPoints);
                
                burndownData.push({
                    day,
                    remainingWork: actualRemaining,
                    idealBurndown: Math.round(idealBurndown * 100) / 100,
                });
            }
            
            setReport({
                sprintName: `Sprint ${project?.sprintNumber || 1}`,
                startDate: project?.currentSprintStartDate || "",
                endDate: project?.currentSprintEndDate || "",
                teamMembers: projectMembers.map(member => member.name),
                totalStoryPoints,
                completedStoryPoints,
                velocity,
                completedTasks: completedTasks.length,
                totalTasks: projectTasks.length,
                averageVelocity,
                velocityTrend: velocity >= averageVelocity * 1.1 ? "increasing" : velocity <= averageVelocity * 0.9 ? "decreasing" : "stable",
                totalSprints: allProjects.length,
                bestVelocity,
                sprintDuration,
                burndownData,
                taskStatusBreakdown,
            });
        }
    }, [selectedProject, tasks, projects, members]);


    const calculateVelocity = () => {
        if (report.totalStoryPoints > 0) {
            const velocity = Math.round((report.completedStoryPoints / report.totalStoryPoints) * 100);
            setReport({ ...report, velocity });
        }
    };

    const generatePDFReport = async () => {
        try {
            // Create a new div for PDF generation that's visible
            const pdfContent = document.createElement('div');
            pdfContent.style.position = 'absolute';
            pdfContent.style.left = '-9999px';
            pdfContent.style.top = '0';
            pdfContent.style.width = '800px';
            pdfContent.style.backgroundColor = '#ffffff';
            pdfContent.style.padding = '40px';
            pdfContent.style.fontFamily = 'Arial, sans-serif';
            pdfContent.style.color = '#000000';
            
            // Add the report content
            pdfContent.innerHTML = `
                <div style="text-align: center; margin-bottom: 40px;">
                    <h1 style="font-size: 32px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">Sprint Report</h1>
                    <h2 style="font-size: 24px; color: #4b5563; margin-bottom: 4px;">${report.sprintName}</h2>
                    <p style="color: #6b7280;">${report.startDate} to ${report.endDate}</p>
                </div>

                <div style="margin-bottom: 40px;">
                    <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">📅 Sprint Overview</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px;">
                            <p style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Team Members</p>
                            <p style="font-weight: 600;">${report.teamMembers.join(", ")}</p>
                        </div>
                        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px;">
                            <p style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Sprint Duration</p>
                            <p style="font-weight: 600;">${report.sprintDuration} days</p>
                        </div>
                        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px;">
                            <p style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Total Story Points</p>
                            <p style="font-weight: 600;">${report.totalStoryPoints}</p>
                        </div>
                        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px;">
                            <p style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Completed Story Points</p>
                            <p style="font-weight: 600;">${report.completedStoryPoints}</p>
                        </div>
                        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px;">
                            <p style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Tasks Completed</p>
                            <p style="font-weight: 600;">${report.completedTasks}/${report.totalTasks}</p>
                        </div>
                        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px;">
                            <p style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Velocity</p>
                            <p style="font-weight: 600;">${report.velocity}%</p>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 40px;">
                    <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">📊 Velocity Analytics</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div style="background-color: #eff6ff; padding: 16px; border-radius: 8px;">
                            <p style="font-size: 14px; color: #2563eb; margin-bottom: 4px;">Average Velocity</p>
                            <p style="font-size: 24px; font-weight: bold; color: #1d4ed8;">${report.averageVelocity}%</p>
                        </div>
                        <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px;">
                            <p style="font-size: 14px; color: #16a34a; margin-bottom: 4px;">Best Velocity</p>
                            <p style="font-size: 24px; font-weight: bold; color: #15803d;">${report.bestVelocity}%</p>
                        </div>
                        <div style="background-color: #faf5ff; padding: 16px; border-radius: 8px;">
                            <p style="font-size: 14px; color: #9333ea; margin-bottom: 4px;">Velocity Trend</p>
                            <p style="font-size: 24px; font-weight: bold; color: #7c3aed; text-transform: capitalize;">${report.velocityTrend}</p>
                        </div>
                        <div style="background-color: #fff7ed; padding: 16px; border-radius: 8px;">
                            <p style="font-size: 14px; color: #ea580c; margin-bottom: 4px;">Total Sprints</p>
                            <p style="font-size: 24px; font-weight: bold; color: #c2410c;">${report.totalSprints}</p>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 40px;">
                    <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">🎯 Task Status Breakdown</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                        <div style="background-color: #fef2f2; padding: 16px; border-radius: 8px; text-align: center;">
                            <p style="font-size: 14px; color: #dc2626; margin-bottom: 4px;">To Do</p>
                            <p style="font-size: 32px; font-weight: bold; color: #b91c1c;">${report.taskStatusBreakdown.todo}</p>
                        </div>
                        <div style="background-color: #fefce8; padding: 16px; border-radius: 8px; text-align: center;">
                            <p style="font-size: 14px; color: #d97706; margin-bottom: 4px;">In Progress</p>
                            <p style="font-size: 32px; font-weight: bold; color: #b45309;">${report.taskStatusBreakdown.inProgress}</p>
                        </div>
                        <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center;">
                            <p style="font-size: 14px; color: #16a34a; margin-bottom: 4px;">Done</p>
                            <p style="font-size: 32px; font-weight: bold; color: #15803d;">${report.taskStatusBreakdown.done}</p>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 40px;">
                    <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">📈 Burndown Chart</h3>
                    <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px;">
                        <div style="text-align: center; margin-bottom: 16px;">
                            <p style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Story Points Remaining</p>
                            <p style="font-size: 18px; font-weight: 600;">${report.totalStoryPoints - report.completedStoryPoints} / ${report.totalStoryPoints}</p>
                        </div>
                        <div style="background-color: white; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px;">
                            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-bottom: 8px;">
                                <span>Story Points</span>
                                <span>Days</span>
                            </div>
                            <div style="position: relative; height: 128px; border-left: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db;">
                                <div style="position: absolute; left: 0; top: 0; height: 100%; display: flex; flex-direction: column; justify-content: space-between; font-size: 12px; color: #6b7280;">
                                    <span>${report.totalStoryPoints}</span>
                                    <span>${Math.round(report.totalStoryPoints * 0.75)}</span>
                                    <span>${Math.round(report.totalStoryPoints * 0.5)}</span>
                                    <span>${Math.round(report.totalStoryPoints * 0.25)}</span>
                                    <span>0</span>
                                </div>
                                <div style="margin-left: 32px; height: 100%; position: relative;">
                                    <svg style="position: absolute; inset: 0; width: 100%; height: 100%;">
                                        <polyline
                                            points="${report.burndownData.map((day, index) => 
                                                `${(index / (report.burndownData.length - 1)) * 100},${100 - (day.idealBurndown / report.totalStoryPoints) * 100}`
                                            ).join(' ')}"
                                            fill="none"
                                            stroke="#3b82f6"
                                            stroke-width="2"
                                            stroke-dasharray="5,5"
                                        />
                                        <polyline
                                            points="${report.burndownData.map((day, index) => 
                                                `${(index / (report.burndownData.length - 1)) * 100},${100 - (day.remainingWork / report.totalStoryPoints) * 100}`
                                            ).join(' ')}"
                                            fill="none"
                                            stroke="#ef4444"
                                            stroke-width="2"
                                        />
                                    </svg>
                                </div>
                            </div>
                            <div style="display: flex; gap: 16px; font-size: 14px; margin-top: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 12px; height: 2px; background-color: #3b82f6;"></div>
                                    <span>Ideal Burndown</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 12px; height: 2px; background-color: #ef4444;"></div>
                                    <span>Actual Burndown</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="text-align: center; color: #6b7280; font-size: 14px;">
                    <p>Report generated on ${new Date().toLocaleDateString()}</p>
                    <p>ScrumSpecter Analytics Dashboard</p>
                </div>
            `;
            
            document.body.appendChild(pdfContent);
            
            // Wait a moment for the content to render
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Create canvas from the content
            const canvas = await html2canvas(pdfContent, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                width: 800,
                height: pdfContent.scrollHeight
            });

            // Remove the temporary element
            document.body.removeChild(pdfContent);

            // Create PDF
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const pageHeight = 295;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;

            let position = 0;

            // Add first page
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Add additional pages if needed
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Download the PDF
            pdf.save(`sprint-report-${report.sprintName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF. Please try again or use the text report option.');
        }
    };

    const generateTextReport = () => {
        const reportText = `
# Sprint Report: ${report.sprintName}

## Sprint Overview
- **Sprint Period**: ${report.startDate} to ${report.endDate}
- **Team Members**: ${report.teamMembers.join(", ")}
- **Total Story Points**: ${report.totalStoryPoints}
- **Completed Story Points**: ${report.completedStoryPoints}
- **Velocity**: ${report.velocity}%
- **Tasks Completed**: ${report.completedTasks}/${report.totalTasks}

## Velocity Analytics
- **Average Velocity**: ${report.averageVelocity}%
- **Velocity Trend**: ${report.velocityTrend}
- **Best Velocity**: ${report.bestVelocity}%
- **Total Sprints**: ${report.totalSprints}

## Task Status Breakdown
- **To Do**: ${report.taskStatusBreakdown.todo}
- **In Progress**: ${report.taskStatusBreakdown.inProgress}
- **Done**: ${report.taskStatusBreakdown.done}


---
*Report generated on ${new Date().toLocaleDateString()}*
        `;

        const blob = new Blob([reportText], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sprint-report-${report.sprintName.toLowerCase().replace(/\s+/g, '-')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileTextIcon className="h-5 w-5" />
                        Sprint Report Generator
                    </CardTitle>
                    <CardDescription>
                        Generate comprehensive sprint reports with all key metrics and insights
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
                                    <Label htmlFor="sprint-name">Sprint Name</Label>
                                    <Input
                                        id="sprint-name"
                                        value={report.sprintName}
                                        placeholder="Sprint 5"
                                        readOnly
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="start-date">Start Date</Label>
                                    <Input
                                        id="start-date"
                                        type="date"
                                        value={report.startDate}
                                        readOnly
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="end-date">End Date</Label>
                                    <Input
                                        id="end-date"
                                        type="date"
                                        value={report.endDate}
                                        readOnly
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="total-story-points">Total Story Points</Label>
                                    <Input
                                        id="total-story-points"
                                        type="number"
                                        value={report.totalStoryPoints}
                                        onChange={(e) => setReport({ ...report, totalStoryPoints: Number(e.target.value) })}
                                        min="0"
                                        readOnly
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="completed-story-points">Completed Story Points</Label>
                                    <Input
                                        id="completed-story-points"
                                        type="number"
                                        value={report.completedStoryPoints}
                                        onChange={(e) => setReport({ ...report, completedStoryPoints: Number(e.target.value) })}
                                        min="0"
                                        readOnly
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="total-tasks">Total Tasks</Label>
                                    <Input
                                        id="total-tasks"
                                        type="number"
                                        value={report.totalTasks}
                                        onChange={(e) => setReport({ ...report, totalTasks: Number(e.target.value) })}
                                        min="0"
                                        readOnly
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="completed-tasks">Completed Tasks</Label>
                                    <Input
                                        id="completed-tasks"
                                        type="number"
                                        value={report.completedTasks}
                                        onChange={(e) => setReport({ ...report, completedTasks: Number(e.target.value) })}
                                        min="0"
                                        readOnly
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Velocity (%)</Label>
                                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                                        <TargetIcon className="h-4 w-4 text-primary" />
                                        <span className="text-lg font-semibold">{report.velocity}%</span>
                                        <Button onClick={calculateVelocity} size="sm" variant="outline">
                                            Calculate
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <UsersIcon className="h-4 w-4" />
                                    Team Members
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {report.teamMembers.map((member, index) => (
                                        <div key={index} className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded">
                                            <span>{member}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>


                            <div className="flex gap-4">
                                <Button onClick={generatePDFReport} className="flex-1" size="lg">
                                    <DownloadIcon className="h-4 w-4 mr-2" />
                                    Generate PDF Report
                                </Button>
                                <Button onClick={generateTextReport} variant="outline" size="lg">
                                    <FileTextIcon className="h-4 w-4 mr-2" />
                                    Text Report
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

        </div>
    );
};
