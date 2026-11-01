"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileTextIcon, PrinterIcon, UsersIcon, TargetIcon } from "lucide-react";
import { useGetTaskSummary, useGetTasks } from "@/features/tasks/api/use-get-tasks";
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
    getProjectPointStats,
} from "@/lib/sprint-utils";

import { BurndownGraph, ProjectSelect } from "./analytics-shared";

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

interface Tile {
    label: string;
    value: string | number;
    className: string;
}

interface ReportSectionProps {
    title: string;
    gridClassName: string;
    valueClassName: string;
    tiles: Tile[];
}

const ReportSection = ({ title, gridClassName, valueClassName, tiles }: ReportSectionProps) => (
    <section className="mb-10 break-inside-avoid">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
        <div className={`grid gap-4 ${gridClassName}`}>
            {tiles.map((tile) => (
                <div key={tile.label} className={`p-4 rounded-lg ${tile.className}`}>
                    <p className="text-sm mb-1 opacity-80">{tile.label}</p>
                    <p className={valueClassName}>{tile.value}</p>
                </div>
            ))}
        </div>
    </section>
);

// Shown only when printing (print rule in globals.css); every value is React text, never HTML
const PrintableReport = ({ report }: { report: SprintReport }) => (
    <div id="sprint-report-print" className="hidden print:block bg-white text-black p-10 font-sans [print-color-adjust:exact]">
        <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Sprint Report</h1>
            <h2 className="text-2xl text-gray-600 mb-1">{report.sprintName}</h2>
            <p className="text-gray-500">{report.startDate} to {report.endDate}</p>
        </div>

        <ReportSection
            title="📅 Sprint Overview"
            gridClassName="grid-cols-2"
            valueClassName="font-semibold"
            tiles={[
                { label: "Team Members", value: report.teamMembers.join(", "), className: "bg-gray-50 text-gray-800" },
                { label: "Sprint Duration", value: `${report.sprintDuration} days`, className: "bg-gray-50 text-gray-800" },
                { label: "Total Story Points", value: report.totalStoryPoints, className: "bg-gray-50 text-gray-800" },
                { label: "Completed Story Points", value: report.completedStoryPoints, className: "bg-gray-50 text-gray-800" },
                { label: "Tasks Completed", value: `${report.completedTasks}/${report.totalTasks}`, className: "bg-gray-50 text-gray-800" },
                { label: "Velocity", value: `${report.velocity}%`, className: "bg-gray-50 text-gray-800" },
            ]}
        />
        <ReportSection
            title="📊 Velocity Analytics"
            gridClassName="grid-cols-2"
            valueClassName="text-2xl font-bold capitalize"
            tiles={[
                { label: "Average Velocity", value: `${report.averageVelocity}%`, className: "bg-emerald-50 text-emerald-800" },
                { label: "Best Velocity", value: `${report.bestVelocity}%`, className: "bg-green-50 text-green-700" },
                { label: "Velocity Trend", value: report.velocityTrend, className: "bg-purple-50 text-purple-700" },
                { label: "Total Sprints", value: report.totalSprints, className: "bg-orange-50 text-orange-700" },
            ]}
        />
        <ReportSection
            title="🎯 Task Status Breakdown"
            gridClassName="grid-cols-3 text-center"
            valueClassName="text-3xl font-bold"
            tiles={[
                { label: "To Do", value: report.taskStatusBreakdown.todo, className: "bg-red-50 text-red-700" },
                { label: "In Progress", value: report.taskStatusBreakdown.inProgress, className: "bg-yellow-50 text-amber-700" },
                { label: "Done", value: report.taskStatusBreakdown.done, className: "bg-green-50 text-green-700" },
            ]}
        />

        <section className="mb-10 break-inside-avoid">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">📈 Burndown Chart</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-center mb-4">
                    <p className="text-sm text-gray-500 mb-1">Story Points Remaining</p>
                    <p className="text-lg font-semibold">
                        {report.totalStoryPoints - report.completedStoryPoints} / {report.totalStoryPoints}
                    </p>
                </div>
                <div className="bg-white border border-gray-300 rounded-lg p-4">
                    <BurndownGraph data={report.burndownData} totalPoints={report.totalStoryPoints} />
                </div>
            </div>
        </section>

        <div className="text-center text-gray-500 text-sm">
            <p>Report generated on {new Date().toLocaleDateString()}</p>
            <p>ScrumSpecter Analytics Dashboard</p>
        </div>
    </div>
);

export const SprintReportGenerator = () => {
    const workspaceId = useWorkspaceId();
    const { data: projects } = useGetProjects({ workspaceId });
    const { data: members } = useGetMembers({ workspaceId });

    const [selectedProject, setSelectedProject] = useState<string>("");
    // Just the chosen project's tasks; the other projects' velocities come from the summary
    const { data: tasks } = useGetTasks({ workspaceId, projectId: selectedProject, enabled: Boolean(selectedProject) });
    const { data: summary } = useGetTaskSummary({ workspaceId });
    const [report, setReport] = useState<SprintReport>(EMPTY_REPORT);

    useEffect(() => {
        if (selectedProject && tasks?.documents && summary && projects?.documents && members?.documents) {
            const project = projects.documents.find(p => p.$id === selectedProject);
            const { projectTasks, completedTasks, totalStoryPoints, completedStoryPoints } =
                getProjectPointStats(tasks.documents, selectedProject);
            const projectMembers = members.documents.filter(member =>
                projectTasks.some(task => task.assigneeIds.includes(member.$id))
            );
            const velocity = calculateVelocity(completedStoryPoints, totalStoryPoints);

            const allProjects = projects.documents;
            const projectVelocities = allProjects.map(p => {
                const row = summary.projects.find((stats) => stats.projectId === p.$id);
                return calculateVelocity(row?.donePoints ?? 0, row?.points ?? 0);
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
    }, [selectedProject, tasks, summary, projects, members]);

    const calculateReportVelocity = () => {
        if (report.totalStoryPoints > 0) {
            setReport({ ...report, velocity: calculateVelocity(report.completedStoryPoints, report.totalStoryPoints) });
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
                                <Button onClick={() => window.print()} className="flex-1" size="lg">
                                    <PrinterIcon className="h-4 w-4 mr-2" />
                                    Print / Save as PDF
                                </Button>
                                <Button onClick={generateTextReport} variant="outline" size="lg">
                                    <FileTextIcon className="h-4 w-4 mr-2" />
                                    Text Report
                                </Button>
                            </div>
                            {/* A direct child of body, so the print rule can hide the rest of the app */}
                            {createPortal(<PrintableReport report={report} />, document.body)}
                        </>
                    )}
                </CardContent>
            </Card>

        </div>
    );
};
