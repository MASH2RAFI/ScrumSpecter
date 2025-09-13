"use client"

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";

import {
    Popover,
    PopoverContent, 
    PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
    value: Date | undefined;
    onChange: (date: Date | undefined) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
};

export const DatePicker = ({ value, onChange, className, placeholder = "Select date", disabled = false }: DatePickerProps) => {
    const [open, setOpen] = React.useState(false);
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

    // Mobile-optimized date input
    if (isMobile) {
        const formatDateForInput = (date: Date | undefined): string => {
            if (!date) return '';
            const localDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
            const year = localDate.getFullYear();
            const month = (localDate.getMonth() + 1).toString().padStart(2, '0');
            const day = localDate.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const parseDateFromInput = (dateString: string): Date | undefined => {
            if (!dateString) return undefined;
            const [year, month, day] = dateString.split('-').map(Number);
            return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const date = parseDateFromInput(e.target.value);
            onChange(date);
        };

        return (
            <Input
                type="date"
                value={formatDateForInput(value)}
                onChange={handleChange}
                disabled={disabled}
                className={cn(
                    "h-8 w-full lg:w-auto text-base",
                    className
                )}
                placeholder={placeholder}
                style={{
                    WebkitAppearance: 'none',
                    MozAppearance: 'textfield'
                }}
            />
        );
    }

    // Desktop version with popover
    return ( 
        <Popover open={open} onOpenChange={setOpen}> 

            <PopoverTrigger asChild> 

                <Button 
                    variant="outline" 
                    size="lg" 
                    disabled={disabled}
                    className={cn( 
                        "w-full justify-start text-left font-normal px-3", 
                        !value && "text-muted-foreground",
                        className 
                    )} 
                > 
                    <CalendarIcon className="mr-2 h-4 w-4" /> 
                    {value ? format(value, "PPP") : <span>{placeholder}</span>} 
                </Button> 
            </PopoverTrigger> 

            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={value}
                    onSelect={(date) => {
                        onChange(date);
                        setOpen(false);
                    }}
                    initialFocus
                />
            </PopoverContent>

        </Popover> 
    );
};