import { differenceInDays } from "date-fns";

import { cn } from "@/lib/utils";
import { useFormatDate } from "@/features/auth/hooks/use-preferences";

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
    const formatDate = useFormatDate();
    if (!value) {
        return <span className={cn("text-muted-foreground", className)}>No date</span>;
    }

    const diffInDays = differenceInDays(new Date(value), new Date());

    let textColor = "text-muted-foreground";

    if (diffInDays <= 3) {
        // -600/-700 in light mode: the -500 shades are under 4.5:1 on white
        textColor = "text-red-600 dark:text-red-400";
    }
    else if (diffInDays <= 7) {
        textColor = "text-orange-700 dark:text-orange-400";
    }
    else if (diffInDays <= 14) {
        textColor = "text-yellow-700 dark:text-yellow-400";
    }

    return (
        <div className={textColor}>
            <span className={cn("truncate", className)}>
                {formatDate(value)}
            </span>
            {startAt && (
                <span className={cn("block truncate text-xs text-muted-foreground", className)}>
                    {formatTimeRange(startAt, durationMinutes)}
                </span>
            )}
        </div>
    );
};
