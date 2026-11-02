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
        // Per server copy; Vercel adds copies under load, so keep each small to spare the Pi.
        // The e2e suite sets 1: PGlite shares one session, so parallel connections can interleave.
        max: Number(process.env.DB_POOL_MAX) || 3,
        idleTimeoutMillis: 5 * 60_000,
        // Fail fast when the Pi or the Funnel is down, instead of hanging the request
        connectionTimeoutMillis: 10_000,
        // One slow query can't hold a connection forever
        statement_timeout: 15_000,
        keepAlive: true,
    });

if (process.env.NODE_ENV !== "production") {
    globalForDb.pgPool = pool;
} else {
    attachDatabasePool(pool);
}

export const db = drizzle(pool, { schema });

// The handle a db.transaction callback gets
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
