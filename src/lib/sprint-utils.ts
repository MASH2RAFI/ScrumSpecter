/**
 * Utility functions for sprint calculations
 * Ensures consistent sprint duration and date calculations across the application
 */

/**
 * Calculate sprint end date from start date and duration
 * @param startDate - Sprint start date
 * @param duration - Sprint duration in days
 * @returns Sprint end date (inclusive of the last day)
 */
export const calculateSprintEndDate = (startDate: Date, duration: number): Date => {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + duration - 1); // -1 because start date is included
    return endDate;
};

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

/**
 * Format date to DD/MM/YYYY format
 */
export const formatDateDDMMYYYY = (date: Date | string): string => {
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

/**
 * Convert DD/MM/YYYY format to Date object
 */
export const convertDDMMYYYYToDate = (dateString: string): Date => {
    const [day, month, year] = dateString.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
};

/**
 * Convert Date object to DD/MM/YYYY format
 */
export const convertDateToDDMMYYYY = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};
