import "server-only";

import { and, eq, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { forgetCachedSessions } from "@/lib/auth";
import { projects, users } from "@/lib/db/schema";

type Executor = Pick<typeof db, "update" | "select">;

// Saved filters are kept per workspace and per project in the account's preferences. When the
// workspace or project goes away (or the person leaves), its entry goes too; otherwise the maps only
// grow until they hit their limit and saving fails. `userId`: only that account (leaving); without
// it, every account that has an entry (deleting). Ids are database ids, safe in a path.
export const forgetSavedFilters = async (
    executor: Executor,
    { workspaceId, projectIds: given = [], userId }: { workspaceId?: string; projectIds?: string[]; userId?: string },
) => {
    // Someone leaving a workspace also forgets its projects (their filters and eyes); on deleting,
    // the caller names the projects
    const left = workspaceId && userId
        ? (await executor.select({ id: projects.id }).from(projects).where(eq(projects.workspaceId, workspaceId))).map((row) => row.id)
        : [];
    const projectIds = [...given, ...left];
    const keys = [
        ...(workspaceId ? ["taskFilters", "routineFilters"].map((map) => [map, workspaceId] as const) : []),
        ...projectIds.map((id) => ["projectFilters", id] as const),
    ];
    if (keys.length === 0) return;

    let next: SQL = sql`${users.preferences}`;
    for (const [map, id] of keys) next = sql`${next} #- ${`{${map},${id}}`}::text[]`;
    const has = [...keys.map(([map, id]) => sql`${users.preferences} -> ${map} ? ${id}`)];
    // A deleted project also leaves the lists of hidden projects (they would count as hidden, and
    // take room in the 200 allowed)
    if (projectIds.length > 0) {
        const ids = sql`array[${sql.join(projectIds.map((id) => sql`${id}`), sql`, `)}]::text[]`;
        for (const list of ["hiddenProjects", "hiddenRoutineProjects"]) {
            const before = next;
            next = sql`case when ${before} -> ${list} ?| ${ids}
                then jsonb_set(${before}, ${`{${list}}`}::text[], coalesce((select jsonb_agg(e) from jsonb_array_elements(${before} -> ${list}) e where e #>> '{}' <> all(${ids})), '[]'::jsonb))
                else ${before} end`;
            has.push(sql`${users.preferences} -> ${list} ?| ${ids}`);
        }
    }
    const touched = or(...has)!;
    const changed = await executor.update(users).set({ preferences: next }).where(userId ? and(eq(users.id, userId), touched) : touched).returning({ id: users.id });
    // Signed-in copies of these accounts (kept 30 s per server) must not show the old filters
    for (const { id } of changed) forgetCachedSessions(id);
};
