// Data Saver on, or a 2G connection: leave anything speculative until it is actually needed
export const lowData = () => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    return Boolean(connection?.saveData || connection?.effectiveType?.includes("2g"));
};
