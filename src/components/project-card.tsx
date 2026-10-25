import Link from "next/link";
import { PlusIcon, TargetIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
    href: string;
    name: string;
    description: React.ReactNode;
    contentClassName?: string;
    children?: React.ReactNode;
}

export const ProjectCard = ({ href, name, description, contentClassName, children }: ProjectCardProps) => (
    <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{name}</CardTitle>
                <TargetIcon className="h-5 w-5 text-primary" />
            </div>
            <CardDescription>
                {description}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className={cn("space-y-3", contentClassName)}>
                {children}
                <Button asChild className="w-full">
                    <Link href={href}>
                        View Project
                    </Link>
                </Button>
            </div>
        </CardContent>
    </Card>
);

interface NoProjectsStateProps {
    canCreate: boolean;
    onCreate: () => void;
}

export const NoProjectsState = ({ canCreate, onCreate }: NoProjectsStateProps) => (
    <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-r from-muted/20 to-muted/10 mb-6">
            <TargetIcon className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
        <p className="text-muted-foreground mb-4">
            Create your first project to get started with sprints and task management
        </p>
        {canCreate && (
            <Button onClick={onCreate}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Create Project
            </Button>
        )}
    </div>
);
