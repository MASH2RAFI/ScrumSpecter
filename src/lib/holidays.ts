import "server-only";

import Holidays from "date-holidays";
import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { workspaceHolidays } from "@/lib/db/schema";
import { liveHolidays } from "@/lib/holiday-feed";

export type Holiday = {
    // YYYY-MM-DD in the country's own calendar
    date: string;
    name: string;
    source: "public" | "custom";
    // Public holidays an admin has hidden; still listed in settings so they can be restored
    hidden?: boolean;
};

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const countryCache = new Map<string, Holidays>();
const yearCache = new Map<string, Holiday[]>();

const forCountry = (country: string) => {
    let hd = countryCache.get(country);
    if (!hd) {
        hd = new Holidays(country, { languages: ["en"] });
        countryCache.set(country, hd);
    }
    return hd;
};

export const isSupportedCountry = (country: string) => Boolean(new Holidays().getCountries("en")[country]);

export const listCountries = () =>
    Object.entries(new Holidays().getCountries("en"))
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

// Bundled public holidays (not observances or bank holidays), one entry per day
const bundledHolidays = (country: string, year: number) => {
    const key = `${country}:${year}`;
    let list = yearCache.get(key);
    if (!list) {
        const byDate = new Map<string, Holiday>();
        for (const holiday of forCountry(country).getHolidays(year) || []) {
            if (holiday.type !== "public") continue;
            const date = holiday.date.slice(0, 10);
            if (!byDate.has(date)) byDate.set(date, { date, name: holiday.name, source: "public" });
        }
        list = Array.from(byDate.values());
        yearCache.set(key, list);
    }
    return list;
};

// A year's public holidays: the live feed (government-announced dates) when it has that year,
// otherwise the bundled estimate. One entry per day.
const publicHolidays = async (country: string, year: number): Promise<Holiday[]> => {
    const live = (await liveHolidays(country))?.filter((holiday) => holiday.date.startsWith(`${year}-`));
    if (!live?.length) return bundledHolidays(country, year);

    const byDate = new Map<string, Holiday>();
    for (const { date, name } of live) {
        if (!byDate.has(date)) byDate.set(date, { date, name, source: "public" });
    }
    return Array.from(byDate.values());
};

// Weekend days as JS day numbers (0 = Sunday). date-holidays only exposes the weekend through
// its country data, so fall back to the weekly day off (plus Saturday when that's Sunday).
export const weekendDays = (country: string | null) => {
    if (!country) return [0, 6];
    const hd = forCountry(country) as Holidays & { __data?: { data?: { holidays?: Record<string, { weekend?: string[] }> } } };
    const weekend = hd.__data?.data?.holidays?.[country]?.weekend;
    if (Array.isArray(weekend) && weekend.length) {
        return weekend.map((day) => DAY_NAMES.indexOf(day)).filter((day) => day >= 0);
    }
    const dayOff = DAY_NAMES.indexOf(hd.getDayOff());
    return dayOff === 0 ? [6, 0] : [dayOff];
};

// Holidays between from and to (inclusive, YYYY-MM-DD): the country's public holidays plus the
// workspace's custom days off. Hidden public holidays are dropped unless includeHidden is set.
export const getHolidays = async (
    { id, holidayCountry }: { id: string; holidayCountry: string | null },
    from: string,
    to: string,
    { includeHidden = false } = {},
): Promise<Holiday[]> => {
    const overrides = await db
        .select({ date: workspaceHolidays.date, name: workspaceHolidays.name, kind: workspaceHolidays.kind })
        .from(workspaceHolidays)
        .where(and(eq(workspaceHolidays.workspaceId, id), gte(workspaceHolidays.date, from), lte(workspaceHolidays.date, to)));

    const years = Array.from({ length: Number(to.slice(0, 4)) - Number(from.slice(0, 4)) + 1 }, (_, i) => Number(from.slice(0, 4)) + i);
    const publicList = holidayCountry
        ? (await Promise.all(years.map((year) => publicHolidays(holidayCountry, year)))).flat()
        : [];

    return mergeHolidays(publicList, from, to, overrides, includeHidden);
};

// Pure part of getHolidays: public holidays in range, minus hidden ones, plus custom days off
export const mergeHolidays = (
    publicList: Holiday[],
    from: string,
    to: string,
    overrides: { date: string; name: string; kind: "custom" | "hidden" }[],
    includeHidden = false,
): Holiday[] => {
    const hiddenDates = new Set(overrides.filter((o) => o.kind === "hidden").map((o) => o.date));
    const result: Holiday[] = [];

    for (const holiday of publicList) {
        if (holiday.date < from || holiday.date > to) continue;
        const hidden = hiddenDates.has(holiday.date);
        if (hidden && !includeHidden) continue;
        result.push(hidden ? { ...holiday, hidden } : holiday);
    }

    for (const custom of overrides.filter((o) => o.kind === "custom")) {
        result.push({ date: custom.date, name: custom.name, source: "custom" });
    }

    return result.sort((a, b) => a.date.localeCompare(b.date));
};
