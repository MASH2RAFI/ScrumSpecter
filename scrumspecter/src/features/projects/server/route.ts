import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { sessionMiddleware } from "@/lib/session-middleware";
import { getMember } from "@/features/members/utils";
import { DATABASE_ID, PROJECTS_ID } from "@/config";
import { ID, Query } from "node-appwrite";
import { createProjectSchema } from "../schemas";


const app = new Hono()

    .post(
        "/",
        sessionMiddleware,
        zValidator("form", createProjectSchema),
            async (c) => {
                const databases = c.get("databases");
                const user = c.get("user");
                const { name, workspaceId } = c.req.valid("form");

                const member = await getMember({
                    databases,
                    workspaceId,
                    userId: user.$id
                });

                if (!member) {
                    return c.json({ error: "Unathorized" }, 401);
                }
                const project = await databases.createDocument(
                    DATABASE_ID,
                    PROJECTS_ID,
                    ID.unique(),
                    {
                        name,
                        workspaceId,
                    }
                );


                return c.json({data: project});
        }
    )

    .get(
        "/",
        sessionMiddleware,
        zValidator("query", z.object({ workspaceId: z.string() })),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { workspaceId } = c.req.valid("query");

            if (!workspaceId) {
                return c.json({ error: "Missing workspacelId" }, 400);
            }

            const member = await getMember({ 
                databases,
                workspaceId,
                userId: user.$id,
            });

            if (!member) {
            return c.json({ error: "Unauthorized" }, 401);
            }

            const projects = await databases. listDocuments(
                DATABASE_ID,
                PROJECTS_ID,
                [
                    Query.equal("workspaceId", workspaceId),
                    Query.orderDesc("$createdAt"),
                ],
            );

            return c.json({ data: projects });

        }
    );
export default app;