import { sessionMiddleware } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createWorkspaceSchema } from "../schemas";
import { DATABASE_ID, WORKSPACES_ID } from "@/config";
import { ID } from "node-appwrite";

const app = new Hono()
    .get(
        "/", 
        sessionMiddleware,
        async (c) => {
        const databases = c.get("databases");
        const workspaces = await databases.listDocuments(
            DATABASE_ID,
            WORKSPACES_ID,
        );
        return c.json({ data: workspaces });
    })
    .post(
        "/",
        zValidator("form", createWorkspaceSchema),
        sessionMiddleware,
        async (c) => {
            const databases = c.get("databases");
            const user = c.get("user");
            const { name } = c.req.valid("form");
            const workspace = await databases.createDocument(
                DATABASE_ID,
                WORKSPACES_ID,
                ID.unique(),
                {
                    name,
                    userId: user.$id,
                }
            );
            return c.json({data: workspace});
        }
);
export default app;