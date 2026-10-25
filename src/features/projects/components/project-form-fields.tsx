"use client";

import { Control, FieldPath, FieldValues } from "react-hook-form";
import { CalendarIcon, TargetIcon } from "lucide-react";

import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SimpleDatePicker } from "@/components/simple-date-picker";
import { convertDDMMYYYYToDate, convertDateToDDMMYYYY } from "@/lib/sprint-utils";

interface FieldProps<T extends FieldValues> {
    control: Control<T>;
    name: FieldPath<T>;
    className?: string;
}

interface TextInputFieldProps<T extends FieldValues> extends FieldProps<T> {
    label: string;
    placeholder: string;
    disabled?: boolean;
}

export const TextInputField = <T extends FieldValues>({
    control,
    name,
    label,
    placeholder,
    className,
    disabled,
}: TextInputFieldProps<T>) => (
    <FormField
        control={control}
        name={name}
        render={({ field }) => (
            <FormItem>
                <FormLabel>{label}</FormLabel>
                <FormControl>
                    <Input
                        {...field}
                        placeholder={placeholder}
                        className={className}
                        disabled={disabled}
                    />
                </FormControl>
                <FormMessage />
            </FormItem>
        )}
    />
);

export const SprintSettings = ({ children }: { children: React.ReactNode }) => (
    <div className="space-y-4">
        <div className="flex items-center gap-2">
            <TargetIcon className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Sprint Settings</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children}
        </div>
    </div>
);

interface SprintDateFieldProps<T extends FieldValues> extends FieldProps<T> {
    label: string;
    // Render the label as a form label with a calendar icon instead of the picker's own label
    iconLabel?: boolean;
}

// Sprint start or end date; the field value is a DD/MM/YYYY string
export const SprintDateField = <T extends FieldValues>({
    control,
    name,
    label,
    iconLabel,
}: SprintDateFieldProps<T>) => (
    <FormField
        control={control}
        name={name}
        render={({ field }) => (
            <FormItem>
                {iconLabel && (
                    <FormLabel className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        {label}
                    </FormLabel>
                )}
                <FormControl>
                    <SimpleDatePicker
                        value={field.value?.trim() ? convertDDMMYYYYToDate(field.value) : undefined}
                        onChange={(date) => field.onChange(date ? convertDateToDDMMYYYY(date) : "")}
                        label={iconLabel ? undefined : label}
                        placeholder={`Select ${label.toLowerCase()}`}
                        size="lg"
                    />
                </FormControl>
                <FormMessage />
            </FormItem>
        )}
    />
);
