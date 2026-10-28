import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { routines, tasks } from "@/lib/db/schema";

type Executor = Pick<typeof db, "update">;

// Tasks and routines keep their assignees as an array of member ids (tasks.assignee_ids)

// `from` becomes `to` everywhere it's assigned (no duplicates if `to` is already there)
export const replaceAssignee = async (executor: Executor, from: string, to: string) => {
    for (const table of [tasks, routines]) {
        const replaced: SQL = sql`case when ${table.assigneeIds} @> array[${to}]::text[]
            then array_remove(${table.assigneeIds}, ${from})
            else array_replace(${table.assigneeIds}, ${from}, ${to}) end`;
        await executor.update(table).set({ assigneeIds: replaced }).where(sql`${table.assigneeIds} @> array[${from}]::text[]`);
    }
};

// `from` is taken off everything it's assigned to; where nobody would be left, `fallback` takes over
export const removeAssignee = async (executor: Executor, from: string, fallback: string | null) => {
    for (const table of [tasks, routines]) {
        const remaining: SQL = sql`array_remove(${table.assigneeIds}, ${from})`;
        const value: SQL = fallback
            ? sql`case when cardinality(${remaining}) = 0 then array[${fallback}]::text[] else ${remaining} end`
            : remaining;
        await executor.update(table).set({ assigneeIds: value }).where(sql`${table.assigneeIds} @> array[${from}]::text[]`);
    }
};
