"use client";

import { ArrowLeftIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DottedSeparator } from "@/components/dotted-separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SettingsHeaderProps {
    title: string;
    titleClassName: string;
    onBack: () => void;
}

export const SettingsHeader = ({ title, titleClassName, onBack }: SettingsHeaderProps) => (
    <>
        <CardHeader className="flex flex-row items-center gap-x-4 p-7 space-y-0">
            <Button size="sm" variant="secondary" onClick={onBack}>
                <ArrowLeftIcon className="size-4 mr-2" />
                Back
            </Button>
            <CardTitle className={titleClassName}>
                {title}
            </CardTitle>
        </CardHeader>
        <div className="px-7">
            <DottedSeparator />
        </div>
    </>
);

interface FormActionsProps {
    onCancel?: () => void;
    isPending: boolean;
    submitLabel: string;
    showSubmit?: boolean;
}

export const FormActions = ({ onCancel, isPending, submitLabel, showSubmit = true }: FormActionsProps) => (
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
            {showSubmit && (
                <Button type="submit" size="lg" disabled={isPending}>
                    {submitLabel}
                </Button>
            )}
        </div>
    </>
);

interface SettingsCardProps {
    title: string;
    description: string;
    children?: React.ReactNode;
    action?: React.ReactNode;
}

// A titled settings card with an optional destructive action below a separator
export const SettingsCard = ({ title, description, children, action }: SettingsCardProps) => (
    <Card className="w-full h-full border-none shadow-none">
        <CardContent className="p-7">
            <div className="flex flex-col">
                <h3 className="font-bold">{title}</h3>
                <p className="text-sm text-muted-foreground">
                    {description}
                </p>
                {children}
                <DottedSeparator className="py-7" />
                {action}
            </div>
        </CardContent>
    </Card>
);

interface SettingsActionButtonProps {
    label: string;
    disabled: boolean;
    onClick: () => void;
}

export const SettingsActionButton = ({ label, disabled, onClick }: SettingsActionButtonProps) => (
    <Button
        className="mt-6 w-fit ml-auto"
        size="sm"
        variant="destructive"
        type="button"
        disabled={disabled}
        onClick={onClick}
    >
        {label}
    </Button>
);
