"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CapacityCalculator } from "./components/capacity-calculator";
import { BurndownChart } from "./components/burndown-chart";
import { VelocityTracker } from "./components/velocity-tracker";
import { SprintReportGenerator } from "./components/sprint-report-generator";
import { BarChart3Icon, CalculatorIcon, TrendingUpIcon, FileTextIcon } from "lucide-react";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

export const AnalyticsClient = () => {
    const workspaceId = useWorkspaceId();
    const { canEditWork } = usePermissions({ workspaceId });

    const tabTriggerClassName = "flex min-w-0 items-center gap-2 bg-card text-muted-foreground shadow-soft data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm";

    return (
        <div className="h-full flex flex-col space-y-4">
            <Tabs defaultValue={canEditWork ? "capacity" : "burndown"} className="flex-1 flex flex-col">
                <TabsList className={`grid h-auto w-full gap-2 ${canEditWork ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'} bg-transparent p-0`}>
                    {canEditWork && (
                        <TabsTrigger value="capacity" className={tabTriggerClassName}>
                            <CalculatorIcon className="h-4 w-4" />
                            Capacity Calculator
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="burndown" className={tabTriggerClassName}>
                        <TrendingUpIcon className="h-4 w-4" />
                        Burndown Chart
                    </TabsTrigger>
                    <TabsTrigger value="velocity" className={tabTriggerClassName}>
                        <BarChart3Icon className="h-4 w-4" />
                        Velocity Tracker
                    </TabsTrigger>
                    {canEditWork && (
                        <TabsTrigger value="sprint-report" className={tabTriggerClassName}>
                            <FileTextIcon className="h-4 w-4" />
                            Sprint Report
                        </TabsTrigger>
                    )}
                </TabsList>

                {canEditWork && (
                    <TabsContent value="capacity" className="flex-1 mt-6">
                        <CapacityCalculator />
                    </TabsContent>
                )}

                <TabsContent value="burndown" className="flex-1 mt-6">
                    <BurndownChart />
                </TabsContent>

                <TabsContent value="velocity" className="flex-1 mt-6">
                    <VelocityTracker />
                </TabsContent>

                {canEditWork && (
                    <TabsContent value="sprint-report" className="flex-1 mt-6">
                        <SprintReportGenerator />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};
