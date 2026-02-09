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
  id?: string;
  name?: string;
}

export const DatePicker = ({
  value,
  onChange,
  className,
  placeholder = "Select date",
  disabled = false,
  id,
  name,
}: DatePickerProps) => {
  const [open, setOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  // Detect mobile device - improved version
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 768 ||
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      );
    };

    // Check initially
    checkMobile();

    // Debounced resize handler
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(checkMobile, 100);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  // Mobile-optimized date input
  if (isMobile) {
    const formatDateForInput = (date: Date | undefined): string => {
      if (!date) return "";
      
      // Get local date components (fixes timezone issue)
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      
      return `${year}-${month}-${day}`;
    };

    const parseDateFromInput = (dateString: string): Date | undefined => {
      if (!dateString) return undefined;
      
      // Parse as local date (creates date at midnight local time)
      const [year, month, day] = dateString.split("-").map(Number);
      return new Date(year, month - 1, day);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const date = parseDateFromInput(e.target.value);
      onChange(date);
    };

    return (
      <div className="relative w-full">
        <Input
          type="date"
          value={formatDateForInput(value)}
          onChange={handleChange}
          disabled={disabled}
          className={cn("h-10 w-full text-base pr-10", className)}
          placeholder={placeholder}
          id={id}
          name={name}
          aria-label={placeholder}
          // Remove default appearance for better styling
          style={{
            WebkitAppearance: "none",
            MozAppearance: "textfield",
          }}
        />
        <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    );
  }

  // Desktop version with popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          id={id}
          aria-label={placeholder}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
          initialFocus
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
};