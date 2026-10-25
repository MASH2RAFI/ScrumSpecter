import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { poolConfig } from "./pool-config";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

// Opening a connection costs ~4 round trips to the Pi (TLS + SCRAM), so keep them warm.
// attachDatabasePool closes idle clients before Fluid suspends the instance,
// so a resumed instance never queries a dead socket.
const pool =
    globalForDb.pgPool ??
    new Pool({
        ...poolConfig(process.env.DATABASE_URL!),
        max: 5,
        idleTimeoutMillis: 5 * 60_000,
        keepAlive: true,
    });

if (process.env.NODE_ENV !== "production") {
    globalForDb.pgPool = pool;
} else {
    attachDatabasePool(pool);
}

export const db = drizzle(pool, { schema });
