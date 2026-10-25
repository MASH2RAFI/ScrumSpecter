"use client";

import { ClockIcon } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { DEFAULT_DURATION_MINUTES, DURATION_CHIPS, formatDuration } from "../task-time";

// "All day" by default; unticking reveals a start time and one-click duration chips.
// Works in any form with `startTime` ("HH:MM" | "") and `durationMinutes` (number | undefined).
export const TaskTimeFields = ({ disabled }: { disabled?: boolean }) => {
    const { control, setValue } = useFormContext<{ startTime?: string; durationMinutes?: number }>();
    const startTime = useWatch({ control, name: "startTime" }) ?? "";
    const durationMinutes = useWatch({ control, name: "durationMinutes" });
    const allDay = !startTime;

    const setAllDay = (checked: boolean) => {
        setValue("startTime", checked ? "" : "09:00", { shouldDirty: true });
        setValue("durationMinutes", checked ? undefined : durationMinutes ?? DEFAULT_DURATION_MINUTES, { shouldDirty: true });
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Checkbox
                    id="all-day"
                    checked={allDay}
                    onCheckedChange={(checked) => setAllDay(checked === true)}
                    disabled={disabled}
                    // The shared checkbox is a 44px touch target; this sits next to a one-word label
                    className="size-5 min-h-0 min-w-0"
                />
                <FormLabel htmlFor="all-day" className="flex items-center gap-1.5 cursor-pointer">
                    <ClockIcon className="size-4 text-muted-foreground" />
                    All day
                </FormLabel>
            </div>
            {!allDay && (
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        type="time"
                        aria-label="Start time"
                        value={startTime}
                        onChange={(e) => setValue("startTime", e.target.value || "09:00", { shouldDirty: true })}
                        disabled={disabled}
                        className="w-32"
                    />
                    <div className="flex flex-wrap gap-1" role="group" aria-label="Duration">
                        {DURATION_CHIPS.map((chip) => (
                            <Button
                                key={chip.minutes}
                                type="button"
                                size="sm"
                                variant={durationMinutes === chip.minutes ? "primary" : "outline"}
                                aria-pressed={durationMinutes === chip.minutes}
                                disabled={disabled}
                                onClick={() => setValue("durationMinutes", chip.minutes, { shouldDirty: true })}
                                className="h-8 px-2.5"
                            >
                                {chip.label}
                            </Button>
                        ))}
                    </div>
                    {durationMinutes && !DURATION_CHIPS.some((chip) => chip.minutes === durationMinutes) && (
                        <span className="text-xs text-muted-foreground">{formatDuration(durationMinutes)}</span>
                    )}
                </div>
            )}
        </div>
    );
};
