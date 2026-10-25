import "server-only";

import { eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "@/lib/db";

export const findById = async <T extends PgTable & { id: AnyPgColumn }>(table: T, id: string) => {
    const [row] = await db
        .select()
        .from(table as PgTable)
        .where(eq(table.id, id))
        .limit(1);

    return row as T["$inferSelect"] | undefined;
};
