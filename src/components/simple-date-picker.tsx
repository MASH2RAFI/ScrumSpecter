"use client"

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface SimpleDatePickerProps {
    value: Date | undefined;
    onChange: (date: Date | undefined) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
    label?: string;
    hasError?: boolean;
};

export const SimpleDatePicker = ({ 
    value, 
    onChange, 
    className, 
    placeholder = "Select date", 
    disabled = false,
    label,
    hasError = false
}: SimpleDatePickerProps) => {
    
    // Convert Date to YYYY-MM-DD format for input
    const formatDateForInput = (date: Date | undefined): string => {
        if (!date) return '';
        return date.toISOString().split('T')[0];
    };

    // Convert YYYY-MM-DD to Date
    const parseDateFromInput = (dateString: string): Date | undefined => {
        if (!dateString) return undefined;
        return new Date(dateString + 'T00:00:00');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = parseDateFromInput(e.target.value);
        onChange(date);
    };

    return (
        <div className="space-y-2">
            {label && (
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {label}
                </label>
            )}
            <Input
                type="date"
                value={formatDateForInput(value)}
                onChange={handleChange}
                disabled={disabled}
                className={cn(
                    "h-12 border-2 focus:border-primary/50 transition-colors duration-200",
                    hasError && "border-destructive focus:border-destructive focus:ring-destructive/20",
                    className
                )}
                placeholder={placeholder}
            />
        </div>
    );
};
