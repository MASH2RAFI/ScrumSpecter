// Local Postgres (PGlite) with every migration in drizzle/ applied.
// Started by playwright.config.ts with a fresh in-memory database for each test run.
// Set PGLITE_DIR to keep the data in that folder instead (e.g. a local demo); migrations
// already applied there are skipped. SKIP_MIGRATIONS=1 leaves the schema alone, for a copy
// restored from pg_dump that is migrated with `drizzle-kit migrate` like the real server.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.env.E2E_DB_PORT || 55433);
const migrations = join(import.meta.dirname, "..", "drizzle");

const db = await PGlite.create(process.env.PGLITE_DIR || undefined);

const skipMigrations = process.env.SKIP_MIGRATIONS === "1";
if (!skipMigrations) {
    await db.exec("CREATE TABLE IF NOT EXISTS local_migrations (name text PRIMARY KEY)");
}
const applied = skipMigrations
    ? null
    : new Set((await db.query("SELECT name FROM local_migrations")).rows.map((row) => row.name));

for (const file of applied ? readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort() : []) {
    if (applied.has(file)) continue;
    for (const statement of readFileSync(join(migrations, file), "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) await db.exec(statement);
    }
    await db.query("INSERT INTO local_migrations (name) VALUES ($1)", [file]);
    console.log(`applied ${file}`);
}

const server = new PGLiteSocketServer({ db, port, maxConnections: 20 });
await server.start();
console.log(`database ready on 127.0.0.1:${port}`);

const stop = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
