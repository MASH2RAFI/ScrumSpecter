// Wall-clock time in an IANA zone -> UTC instant, using only Intl (no tz database dependency)

// Offset of `timeZone` from UTC at `instant`, in minutes (Dhaka = +360)
const offsetMinutes = (timeZone: string, instant: Date) => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", {
            timeZone,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        })
            .formatToParts(instant)
            .map(({ type, value }) => [type, Number(value)])
    );
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return Math.round((asUtc - instant.getTime()) / 60_000);
};

export const isValidTimeZone = (timeZone: string) => {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone });
        return true;
    } catch {
        return false;
    }
};

// "HH:MM" on calendar day year-month-day in timeZone, as a UTC Date.
// Re-checks the offset once so times next to a DST switch land correctly.
export const zonedTimeToUtc = (year: number, month: number, day: number, time: string, timeZone: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const wallClock = Date.UTC(year, month - 1, day, hours, minutes);
    const first = wallClock - offsetMinutes(timeZone, new Date(wallClock)) * 60_000;
    return new Date(wallClock - offsetMinutes(timeZone, new Date(first)) * 60_000);
};
