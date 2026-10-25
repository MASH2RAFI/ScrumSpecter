// Shared helpers for optional task time blocks (startAt + durationMinutes)

export const DEFAULT_DURATION_MINUTES = 30;

export const DURATION_CHIPS = [
    { minutes: 15, label: "15m" },
    { minutes: 30, label: "30m" },
    { minutes: 60, label: "1h" },
    { minutes: 120, label: "2h" },
    { minutes: 240, label: "½ day" },
] as const;

// A calendar date (local) plus "HH:MM" (local) -> ISO instant
export const combineDateAndTime = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const combined = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
    return combined.toISOString();
};

// ISO instant -> "HH:MM" in the viewer's timezone, for <input type="time">
export const toTimeInput = (iso?: string | null) => {
    if (!iso) return "";
    const date = new Date(iso);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export const formatDuration = (minutes?: number | null) => {
    if (!minutes) return "";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours && rest) return `${hours}h ${rest}m`;
    return hours ? `${hours}h` : `${rest}m`;
};

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

// "10:00 – 10:30" in the viewer's locale/timezone
export const formatTimeRange = (startAt: string, durationMinutes?: number | null) => {
    const start = new Date(startAt);
    const end = new Date(start.getTime() + (durationMinutes || DEFAULT_DURATION_MINUTES) * 60_000);
    return `${timeFormat.format(start)} – ${timeFormat.format(end)}`;
};

export const formatTime = (startAt: string) => timeFormat.format(new Date(startAt));

// The time block as a [start, end) pair of Dates
export const taskTimeRange = (startAt: string, durationMinutes?: number | null) => {
    const start = new Date(startAt);
    return { start, end: new Date(start.getTime() + (durationMinutes || DEFAULT_DURATION_MINUTES) * 60_000) };
};
