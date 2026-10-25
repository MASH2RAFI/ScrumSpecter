import { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { cn } from "@/lib/utils";
import { BurndownDay, getBurndownPolylinePoints, getBurndownAxisLabels } from "@/lib/sprint-utils";

interface ProjectSelectProps {
    projects?: { $id: string; name: string }[];
    value: string;
    onChange: (projectId: string) => void;
}

export const ProjectSelect = ({ projects, value, onChange }: ProjectSelectProps) => (
    <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="project-select">Select Project</Label>
            {/* Same Radix select as the rest of the app; "" means nothing chosen yet */}
            <Select value={value || undefined} onValueChange={onChange}>
                <SelectTrigger id="project-select" className="w-full">
                    <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                    {projects?.map((project) => (
                        <SelectItem key={project.$id} value={project.$id}>
                            <div className="flex items-center gap-2">
                                <ProjectAvatar name={project.name} />
                                {project.name}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    </div>
);

interface StatCardProps {
    icon: LucideIcon;
    iconClassName: string;
    label: string;
    value: React.ReactNode;
    valueClassName: string;
}

export const StatCard = ({ icon: Icon, iconClassName, label, value, valueClassName }: StatCardProps) => (
    <Card>
        <CardContent className="p-4">
            <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", iconClassName)} />
                <span className="text-sm font-medium">{label}</span>
            </div>
            <p className={cn("text-2xl font-bold", valueClassName)}>
                {value}
            </p>
        </CardContent>
    </Card>
);

interface BurndownGraphProps {
    data: BurndownDay[];
    totalPoints: number;
}

export const BurndownGraph = ({ data, totalPoints }: BurndownGraphProps) => (
    <div className="space-y-4">
        <div className="flex justify-between text-sm text-muted-foreground">
            <span>Story Points</span>
            <span>Days</span>
        </div>
        <div className="relative h-64 border-l border-b border-border">
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground">
                {getBurndownAxisLabels(totalPoints).map((label, index) => (
                    <span key={index}>{label}</span>
                ))}
            </div>

            <div className="ml-8 h-full relative">
                <svg className="absolute inset-0 w-full h-full">
                    <polyline
                        points={getBurndownPolylinePoints(data, totalPoints, "idealBurndown")}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                    />
                </svg>
                <svg className="absolute inset-0 w-full h-full">
                    <polyline
                        points={getBurndownPolylinePoints(data, totalPoints, "remainingWork")}
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
);
