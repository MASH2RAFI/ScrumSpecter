import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"] });

const url = new URL(process.env.DATABASE_URL!);

export default defineConfig({
    schema: "./src/lib/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        host: url.hostname,
        port: Number(url.port || 5432),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        // Server uses a self-signed cert; matches src/lib/db/pool-config.ts except for DATABASE_SSL=direct
        ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    },
});
