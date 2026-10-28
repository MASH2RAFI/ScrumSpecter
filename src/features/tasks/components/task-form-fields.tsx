"use client";

import { ReactNode } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DottedSeparator } from "@/components/dotted-separator";
import { FormControl, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface AssigneePickerProps {
    value: string[];
    onChange: (value: string[]) => void;
    options: TaskFormOption[];
    disabled?: boolean;
    triggerClassName?: string;
}

// Picks one or more people; the list stays open so several can be ticked in a row
export const AssigneePicker = ({ value, onChange, options, disabled, triggerClassName }: AssigneePickerProps) => {
    const selected = options.filter((option) => value.includes(option.id));
    const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

    return (
        // Modal: keeps focus in the list while the form dialog waits underneath
        <Popover modal>
            <PopoverTrigger asChild disabled={disabled}>
                <FormControl>
                    <Button
                        type="button"
                        variant="outline"
                        aria-label="Assignees"
                        className={cn("h-auto min-h-9 w-full justify-between px-3 py-1.5 font-normal", triggerClassName)}
                    >
                        {selected.length === 0 ? (
                            <span className="text-muted-foreground">Select assignees</span>
                        ) : (
                            <span className="flex min-w-0 flex-wrap gap-1">
                                {selected.map((member) => (
                                    <span key={member.id} className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                                        <MemberAvatar className="size-4" fallbackClassName="text-[9px]" name={member.name} />
                                        {member.name}
                                    </span>
                                ))}
                            </span>
                        )}
                        <ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                </FormControl>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-56 p-1">
                <div role="listbox" aria-multiselectable="true" aria-label="Assignees" className="max-h-64 overflow-y-auto">
                    {options.map((member) => {
                        const checked = value.includes(member.id);
                        return (
                            <button
                                key={member.id}
                                type="button"
                                role="option"
                                aria-selected={checked}
                                onClick={() => toggle(member.id)}
                                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                            >
                                <MemberAvatar className="size-6" name={member.name} />
                                <span className="flex-1 truncate">{member.name}</span>
                                {checked && <CheckIcon className="size-4" />}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
            <FormMessage />
        </Popover>
    );
};

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
