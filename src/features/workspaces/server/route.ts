import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { sessionMiddleware } from "@/lib/session-middleware";
import { generateInviteCode } from "@/lib/utils";
import { db } from "@/lib/db";
import { findById } from "@/lib/db/find-by-id";
import { members, workspaces } from "@/lib/db/schema";
import { toDoc } from "@/lib/db/types";
import { MemberRole } from "@/features/members/types";
import { getMember, requireMember } from "@/features/members/utils";
import { createWorkspaceSchema, updateWorkspaceSchema } from "../schemas";
import { listUserWorkspaces } from "../queries";

const getWorkspace = async (workspaceId: string) => {
    const workspace = await findById(workspaces, workspaceId);

    return workspace ? toDoc(workspace) : undefined;
};

const app = new Hono()
    .get(
        "/",
        sessionMiddleware,
        async (c) => {
            const user = c.get("user");

            const workspaceList = await listUserWorkspaces(user.$id);

            return c.json({ data: workspaceList });
        }
    )

    .post(
        "/",
        zValidator("form", createWorkspaceSchema),
        sessionMiddleware,
        async (c) => {
            const user = c.get("user");
            const { name } = c.req.valid("form");

            const workspace = await db.transaction(async (tx) => {
                const [created] = await tx
                    .insert(workspaces)
                    .values({
                        name,
                        userId: user.$id,
                        inviteCode: generateInviteCode(6),
                    })
                    .returning();

                await tx.insert(members).values({
                    userId: user.$id,
                    workspaceId: created.id,
                    role: MemberRole.ADMIN,
                });

                return created;
            });

            return c.json({ data: toDoc(workspace) });
        }
    )

    .get(
        "/:workspaceId",
        sessionMiddleware,
        async (c) => {
            const { workspaceId } = c.req.param();

            // The workspace is only returned once membership is confirmed
            const [member, workspace] = await Promise.all([
                requireMember(c, workspaceId),
                getWorkspace(workspaceId),
            ]);

            if (member instanceof Response) {
                return member;
            }

            if (!workspace) {
                return c.json({ error: "Workspace not found" }, 404);
            }

            return c.json({ data: workspace });
        }
    )

    .get(
        "/:workspaceId/info",
        sessionMiddleware,
        async (c) => {
            const { workspaceId } = c.req.param();
            const workspace = await getWorkspace(workspaceId);

            if (!workspace) {
                return c.json({ error: "Workspace not found" }, 404);
            }

            return c.json({
                data: {
                    $id: workspace.$id,
                    name: workspace.name,
                },
            });
        }
    )

    .patch(
        "/:workspaceId",
        sessionMiddleware,
        zValidator("form", updateWorkspaceSchema),
        async (c) => {
            const { workspaceId } = c.req.param();
            const { name } = c.req.valid("form");

            const member = await requireMember(c, workspaceId, { adminOnly: true });
            if (member instanceof Response) {
                return member;
            }

            const [workspace] = await db
                .update(workspaces)
                .set({ name })
                .where(eq(workspaces.id, workspaceId))
                .returning();

            return c.json({ data: toDoc(workspace) });
        }
    )

    .delete(
        "/:workspaceId",
        sessionMiddleware,
        async (c) => {
            const { workspaceId } = c.req.param();

            const member = await requireMember(c, workspaceId, { adminOnly: true });
            if (member instanceof Response) {
                return member;
            }

            // Tasks, projects and members are removed by ON DELETE CASCADE
            await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

            return c.json({ data: { $id: workspaceId } });
        }
    )

    .post(
        "/:workspaceId/reset-invite-code",
        sessionMiddleware,
        async (c) => {
            const { workspaceId } = c.req.param();

            const member = await requireMember(c, workspaceId, { adminOnly: true });
            if (member instanceof Response) {
                return member;
            }

            const [workspace] = await db
                .update(workspaces)
                .set({ inviteCode: generateInviteCode(6) })
                .where(eq(workspaces.id, workspaceId))
                .returning();

            return c.json({ data: toDoc(workspace) });
        }
    )

    .post(
        "/:workspaceId/join",
        sessionMiddleware,
        zValidator("json", z.object({ code: z.string() })),
        async (c) => {
            const { workspaceId } = c.req.param();
            const { code } = c.req.valid("json");
            const user = c.get("user");

            const member = await getMember({
                workspaceId,
                userId: user.$id,
            });

            if (member) {
                return c.json({ error: "Already a member" }, 400);
            }

            const workspace = await getWorkspace(workspaceId);

            if (!workspace || workspace.inviteCode !== code) {
                return c.json({ error: "Invalid invite code" }, 400);
            }

            // A concurrent join (double click, retry) hits the unique index instead of a 500
            const [joined] = await db
                .insert(members)
                .values({
                    userId: user.$id,
                    workspaceId,
                    role: MemberRole.MEMBER,
                })
                .onConflictDoNothing()
                .returning({ id: members.id });

            if (!joined) {
                return c.json({ error: "Already a member" }, 400);
            }

            return c.json({ data: workspace });
        }
    );

export default app;
