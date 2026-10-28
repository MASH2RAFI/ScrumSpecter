"use client";

import { format } from "date-fns";
import { TriangleAlertIcon } from "lucide-react";

import { holidayNotice, useGetHolidays } from "../api/use-holidays";
import { useWorkspaceId } from "../hooks/use-workspace-id";

// Non-blocking warning under a date field when the chosen day is a holiday
export const HolidayNotice = ({ date }: { date?: Date | null }) => {
    const workspaceId = useWorkspaceId();
    const year = (date ?? new Date()).getFullYear();
    const { data } = useGetHolidays({ workspaceId, from: `${year}-01-01`, to: `${year}-12-31` });

    const notice = date ? holidayNotice(data?.holidays, format(date, "yyyy-MM-dd")) : null;
    if (!notice) return null;

    return (
        <p role="status" className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <TriangleAlertIcon className="size-3.5 shrink-0" />
            {notice}
        </p>
    );
};
