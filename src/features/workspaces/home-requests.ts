import { addDays, startOfWeek } from "date-fns";

import { EMPTY_TASK_FILTER, type UserPreferences } from "@/features/auth/preferences-core";
import { currentWeek, listQuery, summarySaved } from "@/features/tasks/api/use-get-tasks";
import { taskFilterQuery } from "@/features/tasks/task-filter-query";
import { client } from "@/lib/rpc";
import { localDate, zonedTimeToUtc } from "@/lib/time-zone";

// What a workspace's Home page asks the server for. The page and the sign-in that sends someone
// there both build their requests from these, so the data fetched on the way is exactly what the
// page then asks for (and the page uses the answers instead of asking again).
export type HomePreferences = Pick<UserPreferences, "weekStart" | "taskFilters" | "hiddenProjects">;

// This week and the end of tomorrow, as the browser works them out: by its own clock. The server (which
// builds the requests that start with the HTML) runs in UTC, so it is told the person's time zone and
// finds the same moments; a browser set to another zone just asks again, as it would have anyway.
const dayBounds = (weekStart: HomePreferences["weekStart"], now: Date, timeZone?: string) => {
    if (!timeZone) {
        const week = currentWeek(weekStart, now);
        const afterTomorrow = new Date(now);
        afterTomorrow.setHours(0, 0, 0, 0);
        afterTomorrow.setDate(afterTomorrow.getDate() + 2);
        return { week, afterTomorrow: afterTomorrow.toISOString() };
    }
    const [year, month, day] = localDate(now, timeZone).split("-").map(Number);
    // Noon UTC on that calendar day: the same date in any zone, so date-fns can do the week arithmetic
    const noon = new Date(Date.UTC(year, month - 1, day, 12));
    const midnight = (date: Date) => zonedTimeToUtc(date.getFullYear(), date.getMonth() + 1, date.getDate(), "00:00", timeZone);
    const start = startOfWeek(noon, { weekStartsOn: weekStart });
    return {
        week: { weekFrom: midnight(start).toISOString(), weekTo: midnight(addDays(start, 7)).toISOString() },
        afterTomorrow: zonedTimeToUtc(year, month, day + 2, "00:00", timeZone).toISOString(),
    };
};

export const homeTaskParams = (workspaceId: string, preferences: HomePreferences, now = new Date(), timeZone?: string) => {
    const { week, afterTomorrow } = dayBounds(preferences.weekStart, now, timeZone);
    // Home follows the saved My Tasks filter (people, statuses, Starred, Overdue, hidden projects)
    const followed = taskFilterQuery(preferences.taskFilters[workspaceId] ?? EMPTY_TASK_FILTER, preferences.hiddenProjects);
    return {
        week,
        followed,
        // This week's tasks, for the chart
        weekTasks: { workspaceId, scope: "home" as const, ...week, from: week.weekFrom, to: week.weekTo, ...followed },
        // The signed-in person's open tasks due by the end of tomorrow. "me" lets it start with the
        // other requests instead of after the members list; the rest of the filter applies, the
        // people choice doesn't
        myTasks: {
            workspaceId, scope: "home" as const, ...week, assigneeId: "me", openOnly: true,
            to: afterTomorrow, ...followed, assignees: undefined,
        },
    };
};

const asPath = (url: URL) => url.pathname + url.search;

// What Home itself asks for (the rest is the shell's: sidebar, bell, requests badge)
export const homePageUrls = (workspaceId: string, preferences: HomePreferences, now = new Date(), timeZone?: string) => {
    const { week, followed, weekTasks, myTasks } = homeTaskParams(workspaceId, preferences, now, timeZone);
    return [
        client.api.tasks.summary.$url({ query: { workspaceId, ...week, ...summarySaved(workspaceId, followed) } }),
        client.api.tasks.$url({ query: listQuery(weekTasks) }),
        client.api.tasks.$url({ query: listQuery(myTasks) }),
    ].map(asPath);
};

// Everything Home and its shell ask for when they open
export const homeRequestUrls = (workspaceId: string, preferences: HomePreferences, now = new Date(), timeZone?: string) => [
    ...[
        client.api.auth.current.$url(),
        client.api.workspaces.$url(),
        client.api.workspaces[":workspaceId"].$url({ param: { workspaceId } }),
        client.api.workspaces.versions.$url(),
        client.api.projects.$url({ query: { workspaceId } }),
        client.api.members.$url({ query: { workspaceId } }),
        client.api.routines.$url({ query: { workspaceId } }),
        client.api["change-requests"].$url({ query: { workspaceId } }),
        client.api.notifications.$url(),
    ].map(asPath),
    ...homePageUrls(workspaceId, preferences, now, timeZone),
];
