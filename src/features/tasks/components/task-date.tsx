import { differenceInDays, format } from "date-fns";

import { cn } from "@/lib/utils";

import { formatTimeRange } from "../task-time";

interface TaskDateProps {
    value: string | null;
    // With a time block, its start and end follow the date
    startAt?: string | null;
    durationMinutes?: number | null;
    className?: string;
};

export const TaskDate = ({
    value,
    startAt,
    durationMinutes,
    className
}: TaskDateProps) => {
    if (!value) {
        return <span className={cn("text-muted-foreground", className)}>No date</span>;
    }

    const diffInDays = differenceInDays(new Date(value), new Date());

    let textColor = "text-muted-foreground";

    if (diffInDays <= 3) {
        textColor = "text-red-500";
    }
    else if (diffInDays <= 7) {
        textColor = "text-orange-500";
    }
    else if (diffInDays <= 14) {
        textColor = "text-yellow-500";
    }

    return (
        <div className={textColor}>
            <span className={cn("truncate", className)}>
                {format(value, "PPP")}
            </span>
            {startAt && (
                <span className={cn("block truncate text-xs text-muted-foreground", className)}>
                    {formatTimeRange(startAt, durationMinutes)}
                </span>
            )}
        </div>
    );
};
