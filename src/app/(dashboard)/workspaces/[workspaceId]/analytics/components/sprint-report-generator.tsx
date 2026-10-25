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
import {
    BurndownDay,
    DEFAULT_SPRINT_DURATION,
    calculateAverageVelocity,
    calculateVelocity,
    generateBurndownData,
    getBurndownAxisLabels,
    getBurndownPolylinePoints,
    getProjectPointStats,
} from "@/lib/sprint-utils";

import { ProjectSelect } from "./analytics-shared";

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
    averageVelocity: number;
    velocityTrend: string;
    totalSprints: number;
    bestVelocity: number;
    sprintDuration: number;
    burndownData: BurndownDay[];
    taskStatusBreakdown: {
        todo: number;
        inProgress: number;
        done: number;
    };
}

const EMPTY_REPORT: SprintReport = {
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
    sprintDuration: DEFAULT_SPRINT_DURATION,
    burndownData: [],
    taskStatusBreakdown: {
        todo: 0,
        inProgress: 0,
        done: 0,
    },
};

const getReportSlug = (report: SprintReport) => report.sprintName.toLowerCase().replace(/\s+/g, '-');

const sectionHtml = (title: string, columns: number, tiles: string) => `
    <div style="margin-bottom: 40px;">
        <h3 style="font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">${title}</h3>
        <div style="display: grid; grid-template-columns: ${Array(columns).fill("1fr").join(" ")}; gap: 16px;">
            ${tiles}
        </div>
    </div>
`;

const overviewTileHtml = (label: string, value: string | number) => `
    <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px;">
        <p style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">${label}</p>
        <p style="font-weight: 600;">${value}</p>
    </div>
`;

interface ColorTile {
    label: string;
    value: string | number;
    background: string;
    labelColor: string;
    valueColor: string;
}

const colorTileHtml = (
    { label, value, background, labelColor, valueColor }: ColorTile,
    valueStyle: string,
    tileStyle = "",
) => `
    <div style="background-color: ${background}; padding: 16px; border-radius: 8px;${tileStyle}">
        <p style="font-size: 14px; color: ${labelColor}; margin-bottom: 4px;">${label}</p>
        <p style="${valueStyle} color: ${valueColor};">${value}</p>
    </div>
`;

const buildReportHtml = (report: SprintReport) => {
    const overview = [
        overviewTileHtml("Team Members", report.teamMembers.join(", ")),
        overviewTileHtml("Sprint Duration", `${report.sprintDuration} days`),
        overviewTileHtml("Total Story Points", report.totalStoryPoints),
        overviewTileHtml("Completed Story Points", report.completedStoryPoints),
        overviewTileHtml("Tasks Completed", `${report.completedTasks}/${report.totalTasks}`),
        overviewTileHtml("Velocity", `${report.velocity}%`),
    ].join("");

    const velocityTiles: ColorTile[] = [
        { label: "Average Velocity", value: `${report.averageVelocity}%`, background: "#eff6ff", labelColor: "#2563eb", valueColor: "#1d4ed8" },
        { label: "Best Velocity", value: `${report.bestVelocity}%`, background: "#f0fdf4", labelColor: "#16a34a", valueColor: "#15803d" },
        { label: "Velocity Trend", value: report.velocityTrend, background: "#faf5ff", labelColor: "#9333ea", valueColor: "#7c3aed" },
        { label: "Total Sprints", value: report.totalSprints, background: "#fff7ed", labelColor: "#ea580c", valueColor: "#c2410c" },
    ];
    const velocity = velocityTiles
        .map((tile) => colorTileHtml(
            tile,
            tile.label === "Velocity Trend"
                ? "font-size: 24px; font-weight: bold; text-transform: capitalize;"
                : "font-size: 24px; font-weight: bold;",
        ))
        .join("");

    const statusTiles: ColorTile[] = [
        { label: "To Do", value: report.taskStatusBreakdown.todo, background: "#fef2f2", labelColor: "#dc2626", valueColor: "#b91c1c" },
        { label: "In Progress", value: report.taskStatusBreakdown.inProgress, background: "#fefce8", labelColor: "#d97706", valueColor: "#b45309" },
        { label: "Done", value: report.taskStatusBreakdown.done, background: "#f0fdf4", labelColor: "#16a34a", valueColor: "#15803d" },
    ];
    const status = statusTiles
        .map((tile) => colorTileHtml(tile, "font-size: 32px; font-weight: bold;", " text-align: center;"))
        .join("");

    const axisLabels = getBurndownAxisLabels(report.totalStoryPoints)
        .map((label) => `<span>${label}</span>`)
        .join("");

    return `
        <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="font-size: 32px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">Sprint Report</h1>
            <h2 style="font-size: 24px; color: #4b5563; margin-bottom: 4px;">${report.sprintName}</h2>
            <p style="color: #6b7280;">${report.startDate} to ${report.endDate}</p>
        </div>

        ${sectionHtml("📅 Sprint Overview", 2, overview)}
        ${sectionHtml("📊 Velocity Analytics", 2, velocity)}
        ${sectionHtml("🎯 Task Status Breakdown", 3, status)}

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
                            ${axisLabels}
                        </div>
                        <div style="margin-left: 32px; height: 100%; position: relative;">
                            <svg style="position: absolute; inset: 0; width: 100%; height: 100%;">
                                <polyline
                                    points="${getBurndownPolylinePoints(report.burndownData, report.totalStoryPoints, "idealBurndown")}"
                                    fill="none"
                                    stroke="#3b82f6"
                                    stroke-width="2"
                                    stroke-dasharray="5,5"
                                />
                                <polyline
                                    points="${getBurndownPolylinePoints(report.burndownData, report.totalStoryPoints, "remainingWork")}"
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
};

export const SprintReportGenerator = () => {
    const workspaceId = useWorkspaceId();
    const { data: tasks } = useGetTasks({ workspaceId });
    const { data: projects } = useGetProjects({ workspaceId });
    const { data: members } = useGetMembers({ workspaceId });

    const [selectedProject, setSelectedProject] = useState<string>("");
    const [report, setReport] = useState<SprintReport>(EMPTY_REPORT);

    useEffect(() => {
        if (selectedProject && tasks?.documents && projects?.documents && members?.documents) {
            const project = projects.documents.find(p => p.$id === selectedProject);
            const { projectTasks, completedTasks, totalStoryPoints, completedStoryPoints } =
                getProjectPointStats(tasks.documents, selectedProject);
            const projectMembers = members.documents.filter(member =>
                projectTasks.some(task => task.assigneeId === member.$id)
            );
            const velocity = calculateVelocity(completedStoryPoints, totalStoryPoints);

            const allProjects = projects.documents;
            const projectVelocities = allProjects.map(p => {
                const stats = getProjectPointStats(tasks.documents, p.$id);
                return calculateVelocity(stats.completedStoryPoints, stats.totalStoryPoints);
            });
            const averageVelocity = calculateAverageVelocity(projectVelocities);

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
                bestVelocity: Math.max(...projectVelocities, 0),
                sprintDuration: DEFAULT_SPRINT_DURATION,
                burndownData: generateBurndownData(totalStoryPoints, completedStoryPoints, DEFAULT_SPRINT_DURATION),
                taskStatusBreakdown: {
                    todo: projectTasks.filter(task => task.status === TaskStatus.TODO).length,
                    inProgress: projectTasks.filter(task => task.status === TaskStatus.IN_PROGRESS).length,
                    done: completedTasks.length,
                },
            });
        }
    }, [selectedProject, tasks, projects, members]);

    const calculateReportVelocity = () => {
        if (report.totalStoryPoints > 0) {
            setReport({ ...report, velocity: calculateVelocity(report.completedStoryPoints, report.totalStoryPoints) });
        }
    };

    const generatePDFReport = async () => {
        try {
            // Rendered off-screen, captured to canvas, then paged into an A4 PDF
            const pdfContent = document.createElement('div');
            pdfContent.style.position = 'absolute';
            pdfContent.style.left = '-9999px';
            pdfContent.style.top = '0';
            pdfContent.style.width = '800px';
            pdfContent.style.backgroundColor = '#ffffff';
            pdfContent.style.padding = '40px';
            pdfContent.style.fontFamily = 'Arial, sans-serif';
            pdfContent.style.color = '#000000';
            pdfContent.innerHTML = buildReportHtml(report);

            document.body.appendChild(pdfContent);

            // ~500 KB of PDF tooling, loaded only when a report is generated
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import('html2canvas'),
                import('jspdf'),
                new Promise(resolve => setTimeout(resolve, 100)),
            ]);

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
            pdf.save(`sprint-report-${getReportSlug(report)}.pdf`);

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
        a.download = `sprint-report-${getReportSlug(report)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const reportFields: { id: string; label: string; value: string | number; type?: string; placeholder?: string }[] = [
        { id: "sprint-name", label: "Sprint Name", value: report.sprintName, placeholder: "Sprint 5" },
        { id: "start-date", label: "Start Date", value: report.startDate, type: "date" },
        { id: "end-date", label: "End Date", value: report.endDate, type: "date" },
        { id: "total-story-points", label: "Total Story Points", value: report.totalStoryPoints, type: "number" },
        { id: "completed-story-points", label: "Completed Story Points", value: report.completedStoryPoints, type: "number" },
        { id: "total-tasks", label: "Total Tasks", value: report.totalTasks, type: "number" },
        { id: "completed-tasks", label: "Completed Tasks", value: report.completedTasks, type: "number" },
    ];

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
                    <ProjectSelect
                        projects={projects?.documents}
                        value={selectedProject}
                        onChange={setSelectedProject}
                    />

                    {selectedProject && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {reportFields.map((field) => (
                                    <div key={field.id} className="space-y-2">
                                        <Label htmlFor={field.id}>{field.label}</Label>
                                        <Input
                                            id={field.id}
                                            type={field.type}
                                            value={field.value}
                                            placeholder={field.placeholder}
                                            min={field.type === "number" ? "0" : undefined}
                                            readOnly
                                        />
                                    </div>
                                ))}
                                <div className="space-y-2">
                                    <Label>Velocity (%)</Label>
                                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                                        <TargetIcon className="h-4 w-4 text-primary" />
                                        <span className="text-lg font-semibold">{report.velocity}%</span>
                                        <Button onClick={calculateReportVelocity} size="sm" variant="outline">
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
