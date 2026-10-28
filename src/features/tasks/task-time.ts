// Shared helpers for optional task time blocks (startAt + durationMinutes)

export const DEFAULT_DURATION_MINUTES = 30;

export const DURATION_CHIPS = [
    { minutes: 15, label: "15m" },
    { minutes: 30, label: "30m" },
    { minutes: 60, label: "1h" },
    { minutes: 90, label: "1.5h" },
    { minutes: 120, label: "2h" },
    { minutes: 180, label: "3h" },
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

const makeTimeFormat = (hour12: boolean) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", hour12 });

let timeFormat = makeTimeFormat(true);

// Set from the user's 12h/24h preference (PreferencesSync); affects every formatter below
export const setHour12 = (hour12: boolean) => {
    timeFormat = makeTimeFormat(hour12);
};

export const usesHour12 = () => timeFormat.resolvedOptions().hour12 !== false;

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

// When a task ends: its time block's end, or (local) the end of the working day ("HH:MM", the
// workspace's setting) on its due date; null without a date. The reminders use the same rule.
export const taskEndAt = (
    task: { startAt?: string | null; durationMinutes?: number | null; dueDate?: string | null },
    dayEnd: string | null | undefined = "18:00",
) => {
    if (task.startAt) return taskTimeRange(task.startAt, task.durationMinutes).end;
    if (!task.dueDate) return null;
    const due = new Date(task.dueDate);
    const [hours, minutes] = (dayEnd || "18:00").split(":").map(Number);
    return new Date(due.getFullYear(), due.getMonth(), due.getDate(), hours, minutes);
};

const roughDuration = (ms: number) => {
    const minutes = Math.max(1, Math.round(ms / 60_000));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
};

// "45m left", "1h 20m left", or "ended 10m ago" once past
export const formatCountdown = (end: Date, now: number) => {
    const diff = end.getTime() - now;
    return diff >= 0 ? `${roughDuration(diff)} left` : `ended ${roughDuration(-diff)} ago`;
};

// Where a task is in time: before its start ("starts in 25m"), running ("40m left"), or over
export const taskCountdown = (
    task: { startAt?: string | null; durationMinutes?: number | null; dueDate?: string | null },
    now: number,
    dayEnd?: string | null,
) => {
    const end = taskEndAt(task, dayEnd);
    if (!end) return null;
    const start = task.startAt ? new Date(task.startAt).getTime() : null;
    if (start !== null && start > now) {
        return { phase: "upcoming" as const, label: `starts in ${roughDuration(start - now)}`, msLeft: start - now };
    }
    return end.getTime() > now
        ? { phase: "running" as const, label: formatCountdown(end, now), msLeft: end.getTime() - now }
        : { phase: "ended" as const, label: formatCountdown(end, now), msLeft: 0 };
};
