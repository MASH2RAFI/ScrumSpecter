/**
 * Utility functions for sprint calculations
 * Ensures consistent sprint duration and date calculations across the application
 */

/**
 * Calculate sprint duration in days between start and end dates
 * @param startDate - Sprint start date
 * @param endDate - Sprint end date
 * @returns Duration in days (inclusive of both start and end days)
 */
export const calculateSprintDuration = (startDate: Date, endDate: Date): number => {
    const timeDiff = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    return daysDiff + 1; // +1 to include both start and end days
};

/**
 * Get default sprint duration
 */
export const DEFAULT_SPRINT_DURATION = 14;

/**
 * Get default sprint number
 */
export const DEFAULT_SPRINT_NUMBER = 1;

/**
 * Get today's date in YYYY-MM-DD format
 */
export const getTodayDateString = (): string => {
    return new Date().toISOString().split('T')[0];
};

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

/**
 * Convert a picker Date (local midnight) to DD/MM/YYYY using its local calendar day
 */
export const convertDateToDDMMYYYY = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

type PointedTask = {
    projectId: string;
    status: string;
    storyPoints?: number | null;
};

export interface BurndownDay {
    day: number;
    remainingWork: number;
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

export const generateBurndownData = (
    totalPoints: number,
    completedPoints: number,
    sprintDuration: number,
): BurndownDay[] => {
    const days: BurndownDay[] = [];
    const idealBurndownRate = totalPoints / sprintDuration;
    const actualRemaining = Math.max(0, totalPoints - completedPoints);

    for (let day = 1; day <= sprintDuration; day++) {
        const idealBurndown = Math.max(0, totalPoints - (idealBurndownRate * day));
        days.push({
            day,
            remainingWork: actualRemaining,
            idealBurndown: Math.round(idealBurndown * 100) / 100,
        });
    }
    return days;
};

/**
 * SVG polyline `points` for a burndown series, scaled to a 100x100 box
 */
export const getBurndownPolylinePoints = (
    data: BurndownDay[],
    totalPoints: number,
    key: "remainingWork" | "idealBurndown",
): string =>
    data.map((day, index) =>
        `${(index / (data.length - 1)) * 100},${100 - (day[key] / totalPoints) * 100}`
    ).join(' ');

export const getBurndownAxisLabels = (totalPoints: number): number[] => [
    totalPoints,
    Math.round(totalPoints * 0.75),
    Math.round(totalPoints * 0.5),
    Math.round(totalPoints * 0.25),
    0,
];
