"use client"

import * as React from "react";
import { CalendarIcon, XIcon } from "lucide-react";
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
    // One-tap chips under the field: Today, Tomorrow, Next Mon, +1 week
    presets?: boolean;
};

const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const shiftDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const DATE_PRESETS: { label: string; date: () => Date }[] = [
    { label: "Today", date: startOfToday },
    { label: "Tomorrow", date: () => shiftDays(startOfToday(), 1) },
    // The coming Monday (a week on, if today is Monday)
    { label: "Next Mon", date: () => shiftDays(startOfToday(), ((8 - startOfToday().getDay()) % 7) || 7) },
    { label: "+1 week", date: () => shiftDays(startOfToday(), 7) },
];

export const SimpleDatePicker = ({
    value,
    onChange,
    className,
    placeholder = "Select date",
    disabled = false,
    label,
    hasError = false,
    size = "md",
    presets = false,
}: SimpleDatePickerProps) => {
    const [isMobile, setIsMobile] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Detect mobile device
    React.useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Fixed: Convert Date to YYYY-MM-DD format for input (in local timezone)
    const formatDateForInput = (date: Date | undefined): string => {
        if (!date) return '';

        // Get the date in local timezone
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');

        return `${year}-${month}-${day}`;
    };

    // Fixed: Convert YYYY-MM-DD to Date (treat as local date)
    const parseDateFromInput = (dateString: string): Date | undefined => {
        if (!dateString) return undefined;

        // Parse as local date (creates date at midnight local time)
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = parseDateFromInput(e.target.value);
        onChange(date);
    };

    // Tapping the field opens the native picker by itself; this button is the only extra trigger
    const handleCalendarButtonClick = () => {
        if (inputRef.current && !disabled) {
            inputRef.current.focus();
            try {
                inputRef.current.showPicker?.();
            } catch {
                // Not allowed here; the focused field still opens on tap
            }
        }
    };

    const empty = !value;

    return (
        <div className="space-y-2">
            {label && (
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {label}
                </label>
            )}
            <div className="relative">
                <Input
                    ref={inputRef}
                    type="date"
                    value={formatDateForInput(value)}
                    onChange={handleChange}
                    disabled={disabled}
                    aria-label={label ? undefined : placeholder}
                    className={cn(
                        "w-full lg:w-auto",
                        "border border-input bg-background",
                        "text-sm ring-offset-background",
                        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                        "placeholder:text-muted-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "text-base", // Prevent zoom on iOS
                        // The native field and picker follow the app's theme
                        "[color-scheme:light] dark:[color-scheme:dark]",
                        hasError && "border-destructive focus-visible:ring-destructive",
                        // Size variants
                        size === "sm" && "h-8",
                        size === "md" && "h-10",
                        size === "lg" && "h-12",
                        // Room for the calendar button, plus the clear button once a date is set
                        isMobile && (empty ? "pr-10" : "pr-16"),
                        // Our calendar button replaces the browser's own icon (Chromium shows one at any width)
                        isMobile && "[&::-webkit-calendar-picker-indicator]:hidden",
                        // iOS shows nothing in an empty date field: the placeholder below stands in
                        isMobile && empty && "text-transparent",
                        className
                    )}
                    placeholder={placeholder}
                    style={{
                        // Ensure proper mobile styling
                        WebkitAppearance: 'none',
                        MozAppearance: 'textfield',
                        // Improve mobile date picker behavior
                        fontSize: isMobile ? '16px' : '14px', // Prevent zoom on iOS
                    }}
                    // Mobile-specific attributes
                    inputMode="none" // Prevent virtual keyboard on mobile
                    autoComplete="off"
                />

                {isMobile && empty && (
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base text-muted-foreground">
                        {placeholder}
                    </span>
                )}

                {isMobile && !disabled && (
                    <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                        {/* iOS's picker has no reliable "clear" */}
                        {!empty && (
                            <button
                                type="button"
                                onClick={() => onChange(undefined)}
                                className="flex size-6 min-h-0 min-w-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                                aria-label="Clear date"
                            >
                                <XIcon className="size-4" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleCalendarButtonClick}
                            className="flex size-6 min-h-0 min-w-0 items-center justify-center text-muted-foreground"
                            aria-label="Open date picker"
                        >
                            <CalendarIcon className="size-4" />
                        </button>
                    </div>
                )}
            </div>
            {presets && !disabled && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick dates">
                    {DATE_PRESETS.map((preset) => {
                        const date = preset.date();
                        const selected = value?.toDateString() === date.toDateString();
                        return (
                            <button
                                key={preset.label}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => onChange(date)}
                                className={cn(
                                    "rounded-full border px-2.5 py-0.5 text-xs transition-colors min-h-0 min-w-0",
                                    selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground",
                                )}
                            >
                                {preset.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
