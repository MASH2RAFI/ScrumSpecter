// Throwaway in-memory Postgres (PGlite) with every migration in drizzle/ applied.
// Started by playwright.config.ts; each test run gets a fresh, empty database.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.env.E2E_DB_PORT || 55433);
const migrations = join(import.meta.dirname, "..", "drizzle");

const db = await PGlite.create();

for (const file of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
    for (const statement of readFileSync(join(migrations, file), "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) await db.exec(statement);
    }
}

const server = new PGLiteSocketServer({ db, port, maxConnections: 20 });
await server.start();
console.log(`e2e database ready on 127.0.0.1:${port}`);

const stop = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
