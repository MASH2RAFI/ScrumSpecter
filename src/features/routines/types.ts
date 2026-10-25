import { Document } from "@/lib/db/types";

export type Routine = Document & {
    name: string;
    description: string | null;
    workspaceId: string;
    projectId: string;
    assigneeId: string | null;
    storyPoints: number | null;
    // ISO weekdays, 1 = Monday ... 7 = Sunday
    weekdays: number[];
    // "HH:MM" in timeZone; null = all day
    startTime: string | null;
    timeZone: string | null;
    durationMinutes: number | null;
    active: boolean;
};

export const WEEKDAYS = [
    { value: 1, short: "Mon", label: "Monday" },
    { value: 2, short: "Tue", label: "Tuesday" },
    { value: 3, short: "Wed", label: "Wednesday" },
    { value: 4, short: "Thu", label: "Thursday" },
    { value: 5, short: "Fri", label: "Friday" },
    { value: 6, short: "Sat", label: "Saturday" },
    { value: 7, short: "Sun", label: "Sunday" },
] as const;
