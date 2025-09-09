"use client"

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

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