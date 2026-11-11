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
export const POOL_MAX = Number(process.env.DB_POOL_MAX) || 6;

const isNewPool = !globalForDb.pgPool;
const pool =
    globalForDb.pgPool ??
    new Pool({
        ...poolConfig(process.env.DATABASE_URL!),
        // Per server copy; Vercel adds copies under load, and the app role is limited on the Pi
        // (scripts/pi/app-role-limits.sql: 80, so about 13 copies of 6). A page load makes ~25 queries, each a
        // round trip to the Pi: with 3 connections they queue in waves (measured: 6 is a third faster to load).
        // The copy that finds the role full gets an error, not a queue, so raise this only with that limit.
        // The e2e suite sets 1: PGlite shares one session, so parallel connections can interleave.
        max: POOL_MAX,
        idleTimeoutMillis: 5 * 60_000,
        // Fail fast when the Pi or the Funnel is down, instead of hanging the request
        connectionTimeoutMillis: 10_000,
        // One slow query can't hold a connection forever
        statement_timeout: 15_000,
        keepAlive: true,
    });

// A new server copy starts its first connection now, while the rest of the code loads and the first
// request is read, instead of when the first query needs it (the handshake above is about a second
// to the Pi). Not while building, and a failure here is left for the first real query to report.
if (isNewPool && process.env.NEXT_PHASE !== "phase-production-build") {
    void pool.query("select 1").catch(() => {});
}

// Kept on globalThis in production too, so a second load of this file in the same process
// (the page render and the API route both import it) shares the pool instead of opening another
globalForDb.pgPool = pool;
if (isNewPool && process.env.NODE_ENV === "production") {
    attachDatabasePool(pool);
}

export const db = drizzle(pool, { schema });

// The handle a db.transaction callback gets
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
