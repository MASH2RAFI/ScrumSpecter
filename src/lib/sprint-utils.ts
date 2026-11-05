/**
 * Utility functions for sprint calculations
 * Ensures consistent sprint duration and date calculations across the application
 */

/**
 * Get default sprint duration
 */
export const DEFAULT_SPRINT_DURATION = 14;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format to DD/MM/YYYY. A YYYY-MM-DD string is a calendar date and is formatted as-is
 * (parsing it with `new Date` would make it UTC midnight and shift it a day in some
 * timezones); anything else is an instant shown in the viewer's local timezone.
 */
export const formatDateDDMMYYYY = (date: Date | string): string => {
    if (typeof date === 'string' && DATE_ONLY.test(date)) {
        return convertYYYYMMDDToDDMMYYYY(date);
    }
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Convert DD/MM/YYYY format to YYYY-MM-DD format for form inputs
 */
export const convertDDMMYYYYToYYYYMMDD = (dateString: string): string => {
    const [day, month, year] = dateString.split('/');
    return `${year}-${month}-${day}`;
};

/**
 * Convert YYYY-MM-DD format to DD/MM/YYYY format
 */
export const convertYYYYMMDDToDDMMYYYY = (dateString: string): string => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

// Day number of a DD/MM/YYYY calendar date (timezone-free)
const dayNumber = (dateString: string) => {
    const [day, month, year] = dateString.split('/').map(Number);
    return Date.UTC(year, month - 1, day) / 86_400_000;
};

/**
 * Sprint length in days, counting both the start and end day (same day = 1)
 */
export const sprintLengthInDays = (startDDMMYYYY: string, endDDMMYYYY: string): number =>
    dayNumber(endDDMMYYYY) - dayNumber(startDDMMYYYY) + 1;

/**
 * Add days to a DD/MM/YYYY calendar date
 */
export const addDaysDDMMYYYY = (dateString: string, days: number): string => {
    const d = new Date((dayNumber(dateString) + days) * 86_400_000);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

/**
 * Convert DD/MM/YYYY to a Date at local midnight, the convention SimpleDatePicker uses
 */
export const convertDDMMYYYYToDate = (dateString: string): Date => {
    const [day, month, year] = dateString.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
};

type PointedTask = {
    projectId: string | null;
    status: string;
    storyPoints?: number | null;
};

// remainingWork is null for days that haven't happened yet (or can't be placed)
export interface BurndownDay {
    day: number;
    remainingWork: number | null;
    idealBurndown: number;
}

export const sumStoryPoints = (tasks: PointedTask[]): number =>
    tasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0);

/**
 * Story point totals for one project's tasks ("DONE" counts as completed)
 */
export const getProjectPointStats = <T extends PointedTask>(tasks: T[], projectId: string) => {
    const projectTasks = tasks.filter((task) => task.projectId === projectId);
    const completedTasks = projectTasks.filter((task) => task.status === "DONE");
    return {
        projectTasks,
        completedTasks,
        totalStoryPoints: sumStoryPoints(projectTasks),
        completedStoryPoints: sumStoryPoints(completedTasks),
    };
};

/**
 * Completed share of story points as a rounded percentage (0 when there are no points)
 */
export const calculateVelocity = (completedPoints: number, totalPoints: number): number =>
    totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

export const calculateAverageVelocity = (velocities: number[]): number =>
    velocities.length > 0
        ? Math.round(velocities.reduce((sum, v) => sum + v, 0) / velocities.length)
        : 0;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// A YYYY-MM-DD calendar day as a day number (timezone-free)
const isoDayNumber = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86_400_000;
};

// The viewer's calendar day of an instant, as YYYY-MM-DD
const localIsoDay = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// A project's sprint length in days from its start and end dates (inclusive), or null without them
export const projectSprintDays = (project?: { currentSprintStartDate?: string | null; currentSprintEndDate?: string | null }) => {
    const { currentSprintStartDate: start, currentSprintEndDate: end } = project ?? {};
    if (!start || !end || !ISO_DAY.test(start) || !ISO_DAY.test(end)) return null;
    const days = isoDayNumber(end) - isoDayNumber(start) + 1;
    return days >= 1 ? Math.min(days, 366) : null;
};

export type DoneTask = { points: number; doneAt: string };

/**
 * The burndown for a sprint of `days` days that started on `start` (YYYY-MM-DD). Each day up to
 * today shows the points still open then: the total minus the Done tasks finished by that day.
 * A task counts as finished when it was last updated (the same signal the Kanban uses for
 * "recently finished"), so editing a Done task later moves it. Days after today stay empty.
 * Without a start date the days can't be placed: only the last day shows today's remaining.
 * `elapsed` is how many sprint days have passed (null without a start date).
 */
export const buildBurndown = ({ totalPoints, start, days, done, today = new Date() }: {
    totalPoints: number;
    start?: string | null;
    days: number;
    done: DoneTask[];
    today?: Date;
}): { days: BurndownDay[]; elapsed: number | null } => {
    const length = Math.max(1, Math.floor(days));
    const hasStart = Boolean(start && ISO_DAY.test(start));
    const first = hasStart ? isoDayNumber(start!) : 0;
    const elapsed = hasStart ? Math.min(Math.max(isoDayNumber(localIsoDay(today)) - first + 1, 0), length) : null;
    const doneBy = done.map(({ points, doneAt }) => ({
        points,
        // A task finished before the sprint counts from day 1
        day: hasStart ? Math.max(1, isoDayNumber(localIsoDay(new Date(doneAt))) - first + 1) : 0,
    }));
    const rate = totalPoints / length;

    return {
        elapsed,
        days: Array.from({ length }, (_, index) => {
            const day = index + 1;
            const finished = hasStart
                ? doneBy.filter((task) => task.day <= day).reduce((sum, task) => sum + task.points, 0)
                : done.reduce((sum, task) => sum + task.points, 0);
            const shown = hasStart ? day <= (elapsed ?? 0) : day === length;
            return {
                day,
                remainingWork: shown ? Math.max(0, totalPoints - finished) : null,
                idealBurndown: Math.round(Math.max(0, totalPoints - rate * day) * 100) / 100,
            };
        }),
    };
};

/**
 * SVG polyline `points` for a burndown series, scaled to a 100x100 box
 */
export const getBurndownPolylinePoints = (
    data: BurndownDay[],
    totalPoints: number,
    key: "remainingWork" | "idealBurndown",
): string =>
    data.flatMap((day, index) => {
        const value = day[key];
        if (value === null) return [];
        const x = data.length > 1 ? (index / (data.length - 1)) * 100 : 0;
        const y = totalPoints > 0 ? 100 - (value / totalPoints) * 100 : 100;
        return [`${x},${y}`];
    }).join(' ');

export const getBurndownAxisLabels = (totalPoints: number): number[] => [
    totalPoints,
    Math.round(totalPoints * 0.75),
    Math.round(totalPoints * 0.5),
    Math.round(totalPoints * 0.25),
    0,
];
