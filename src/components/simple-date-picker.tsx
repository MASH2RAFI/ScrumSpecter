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
    size?: "sm" | "md" | "lg";
};

export const SimpleDatePicker = ({ 
    value, 
    onChange, 
    className, 
    placeholder = "Select date", 
    disabled = false,
    label,
    hasError = false,
    size = "md"
}: SimpleDatePickerProps) => {
    const [isMobile, setIsMobile] = React.useState(false);

    // Detect mobile device
    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
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

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        // On mobile, ensure the date picker opens properly
        if (isMobile) {
            e.target.showPicker?.();
        }
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
                onFocus={handleFocus}
                disabled={disabled}
                className={cn(
                    "w-full lg:w-auto",
                    "border border-input bg-background",
                    "text-sm ring-offset-background",
                    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                    "placeholder:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "text-base", // Prevent zoom on iOS
                    "touch-manipulation", // Improve touch responsiveness
                    isMobile && "text-base", // Ensure proper mobile sizing
                    hasError && "border-destructive focus-visible:ring-destructive",
                    // Size variants
                    size === "sm" && "h-8",
                    size === "md" && "h-10",
                    size === "lg" && "h-12",
                    className
                )}
                placeholder={placeholder}
                style={{
                    // Ensure proper mobile styling
                    WebkitAppearance: 'none',
                    MozAppearance: 'textfield',
                    // Improve mobile date picker behavior
                    fontSize: isMobile ? '16px' : '14px', // Prevent zoom on iOS
                    minHeight: size === "sm" ? '32px' : size === "md" ? '40px' : '48px', // Match size variants
                    // Ensure proper mobile date picker display
                    ...(isMobile && {
                        colorScheme: 'light', // Ensure proper contrast
                        WebkitTextFillColor: 'initial',
                    })
                }}
                // Mobile-specific attributes
                inputMode="none" // Prevent virtual keyboard on mobile
                autoComplete="off"
                // Ensure proper mobile date picker behavior
                {...(isMobile && {
                    onTouchStart: (e) => {
                        // Ensure touch events work properly
                        e.currentTarget.focus();
                    }
                })}
            />
        </div>
    );
};
