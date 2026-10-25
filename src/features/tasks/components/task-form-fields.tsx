"use client";

import { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DottedSeparator } from "@/components/dotted-separator";
import { FormControl, FormMessage } from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";

import { TaskStatus } from "../types";

// Shared building blocks for CreateTaskForm and EditTaskForm.

export type TaskFormOption = { id: string, name: string };

export interface TaskFormOptionsProps {
    projectOptions: TaskFormOption[];
    memberOptions: TaskFormOption[];
}

const statusOptions: { value: TaskStatus, label: string }[] = [
    { value: TaskStatus.BACKLOG, label: "Backlog" },
    { value: TaskStatus.IN_PROGRESS, label: "In Progress" },
    { value: TaskStatus.IN_REVIEW, label: "In Review" },
    { value: TaskStatus.TODO, label: "Todo" },
    { value: TaskStatus.DONE, label: "Done" },
];

interface TaskSelectProps {
    value?: string;
    onChange: (value: string) => void;
    placeholder: string;
    disabled?: boolean;
    triggerClassName?: string;
    children: ReactNode;
}

export const TaskSelect = ({ value, onChange, placeholder, disabled, triggerClassName, children }: TaskSelectProps) => (
    <Select
        defaultValue={value}
        onValueChange={onChange}
        disabled={disabled}
    >
        <FormControl>
            <SelectTrigger className={triggerClassName}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
        </FormControl>
        <FormMessage />
        <SelectContent>
            {children}
        </SelectContent>
    </Select>
);

export const StatusSelectItems = () => (
    <>
        {statusOptions.map(({ value, label }) => (
            <SelectItem key={value} value={value}>
                {label}
            </SelectItem>
        ))}
    </>
);

export const MemberSelectItems = ({ options }: { options: TaskFormOption[] }) => (
    <>
        {options.map((member) => (
            <SelectItem key={member.id} value={member.id}>
                <div className="flex items-center gap-x-2">
                    <MemberAvatar className="size-6" name={member.name} />
                    {member.name}
                </div>
            </SelectItem>
        ))}
    </>
);

export const ProjectSelectItems = ({ options }: { options: TaskFormOption[] }) => (
    <>
        {options.map((project) => (
            <SelectItem key={project.id} value={project.id}>
                <div className="flex items-center gap-x-2">
                    <ProjectAvatar className="size-6" name={project.name} />
                    {project.name}
                </div>
            </SelectItem>
        ))}
    </>
);

interface TaskFormFooterProps {
    onCancel?: () => void;
    isPending: boolean;
    children: ReactNode;
}

// Separator, Cancel button (hidden when there is nothing to cancel) and the submit area.
export const TaskFormFooter = ({ onCancel, isPending, children }: TaskFormFooterProps) => (
    <>
        <DottedSeparator className="py-7" />
        <div className="flex items-center justify-between">
            <Button
                type="button"
                size="lg"
                variant="secondary"
                onClick={onCancel}
                disabled={isPending}
                className={cn(!onCancel && "invisible")}
            >
                Cancel
            </Button>
            {children}
        </div>
    </>
);
