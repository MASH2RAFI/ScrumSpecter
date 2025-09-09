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
    
    // Convert Date to YYYY-MM-DD format for input (display in local timezone)
    const formatDateForInput = (date: Date | undefined): string => {
        if (!date) return '';
        // Convert UTC date to local timezone for display
        const localDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
        const year = localDate.getFullYear();
        const month = (localDate.getMonth() + 1).toString().padStart(2, '0');
        const day = localDate.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Convert YYYY-MM-DD to Date (store as UTC at 00:00)
    const parseDateFromInput = (dateString: string): Date | undefined => {
        if (!dateString) return undefined;
        // Parse the date string and create UTC date at midnight
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
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
