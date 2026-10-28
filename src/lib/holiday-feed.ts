import "server-only";

// Live public holidays from Google's public holiday calendars (no API key). They follow each
// government's announcements, e.g. Bangladesh's Eid holiday ranges, which the bundled
// date-holidays data can only estimate. Used by src/lib/holidays.ts, which falls back to the
// bundled data when a feed is unreachable or has nothing for a year.

type FeedHoliday = { date: string; name: string };

const FEED_TTL = 12 * 60 * 60_000;
// The feed is ~150 KB and usually arrives in about a second, but can be slow now and then
const FETCH_TIMEOUT = 15_000;
// After a failed refresh, try again this soon
const RETRY_AFTER = 5 * 60_000;

// Google calendar ids that don't follow the "en.<country code>" pattern
const CALENDAR_IDS: Record<string, string> = {
    US: "en.usa",
    GB: "en.uk",
    IN: "en.indian",
    CA: "en.canadian",
    AU: "en.australian",
    DE: "en.german",
    FR: "en.french",
    JP: "en.japanese",
    SA: "en.saudiarabian",
    MY: "en.malaysia",
    SG: "en.singapore",
};

const feedUrl = (country: string) => {
    const id = CALENDAR_IDS[country] ?? `en.${country.toLowerCase()}`;
    return `https://calendar.google.com/calendar/ical/${encodeURIComponent(`${id}#holiday@group.v.calendar.google.com`)}/public/basic.ics`;
};

const unescapeText = (value: string) =>
    value.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();

const toIsoDate = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

const nextDay = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
};

// Public holidays from an iCalendar feed: all-day events whose description says "Public holiday"
// (Google marks the rest "Observance"). Multi-day events cover each of their days.
export const parseHolidayFeed = (ics: string): FeedHoliday[] => {
    // Long lines are folded onto continuation lines that start with a space
    const text = ics.replace(/\r?\n[ \t]/g, "");
    const holidays: FeedHoliday[] = [];

    for (const event of text.split("BEGIN:VEVENT").slice(1)) {
        const field = (name: string) => event.match(new RegExp(`^${name}(?:;[^:\\r\\n]*)?:(.*)$`, "m"))?.[1]?.trim();
        const start = field("DTSTART");
        const summary = field("SUMMARY");
        const description = unescapeText(field("DESCRIPTION") ?? "");
        if (!start || !/^\d{8}$/.test(start) || !summary || !description.startsWith("Public holiday")) continue;

        const end = field("DTEND");
        const last = end && /^\d{8}$/.test(end) ? toIsoDate(end) : nextDay(toIsoDate(start));
        // DTEND is exclusive; cap runaway ranges
        for (let date = toIsoDate(start), days = 0; date < last && days < 31; date = nextDay(date), days++) {
            holidays.push({ date, name: unescapeText(summary) });
        }
    }
    return holidays;
};

const feeds = new Map<string, { at: number; holidays: FeedHoliday[] | null }>();

// The country's feed, cached for 12 hours per server instance; null when it can't be used
export const liveHolidays = async (country: string): Promise<FeedHoliday[] | null> => {
    if (process.env.HOLIDAY_FEED === "off") return null;

    const cached = feeds.get(country);
    if (cached && Date.now() - cached.at < FEED_TTL) return cached.holidays;

    let holidays: FeedHoliday[] | null = null;
    try {
        const response = await fetch(feedUrl(country), {
            signal: AbortSignal.timeout(FETCH_TIMEOUT),
            // Also cached by Next.js between instances
            next: { revalidate: FEED_TTL / 1000 },
        });
        if (response.ok) {
            const parsed = parseHolidayFeed(await response.text());
            holidays = parsed.length ? parsed : null;
        }
    } catch (error) {
        console.error(`Holiday feed for ${country} unavailable`, (error as Error).message);
    }

    if (holidays) {
        feeds.set(country, { at: Date.now(), holidays });
        return holidays;
    }
    // Keep serving the last good copy (or the bundled data, when there's none) and retry soon
    const fallback = cached?.holidays ?? null;
    feeds.set(country, { at: Date.now() - FEED_TTL + RETRY_AFTER, holidays: fallback });
    return fallback;
};
