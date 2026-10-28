import { randomUUID } from "crypto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, eq, gt, isNull, lt, max, or, sql, TransactionRollbackError } from "drizzle-orm";
import { sessionMiddleware } from "@/lib/session-middleware";
import { generateInviteCode } from "@/lib/utils";
import { db } from "@/lib/db";
import { findById } from "@/lib/db/find-by-id";
import { members, notifications, routines, users, workspaceHolidays, workspaces } from "@/lib/db/schema";
import { getHolidays, isSupportedCountry, listCountries, weekendDays } from "@/lib/holidays";
import { generateRoutineTasks, removeRoutineTasksOn } from "@/lib/routines";
import { toDoc } from "@/lib/db/types";
import { MemberRole } from "@/features/members/types";
import { getMember, handOverPlaceholder, requireMember, requireRole } from "@/features/members/utils";
import { canEditWork, canManageWorkspace } from "@/features/members/permissions";
import { MAX_SCRIPT_LENGTH, planScript } from "./bulk-input";
import { applyPlan, countPlan, finishPlan, loadContext, newWorkspaceContext, writePlan } from "./bulk-apply";
import { isValidTimeZone } from "@/lib/time-zone";
import { createWorkspaceSchema, holidayChangeSchema, holidayRangeSchema, inviteLimitsSchema, updateWorkspaceSchema } from "../schemas";
import { listUserWorkspaces } from "../queries";

// A workspace with its creator as admin; `memberId` lets bulk setup refer to that member up front
const insertWorkspace = async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, name: string, memberId?: string) => {
    const [created] = await tx
        .insert(workspaces)
        .values({
            name,
            userId,
            inviteCode: generateInviteCode(6),
            viewerInviteCode: generateInviteCode(10),
        })
        .returning();

    await tx.insert(members).values({
        ...(memberId ? { id: memberId } : {}),
        userId,
        workspaceId: created.id,
        role: MemberRole.ADMIN,
    });

    return created;
};

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

    // One cheap query that tells clients which workspaces (and whether their own account)
    // changed since they cached them
    .get(
        "/versions",
        sessionMiddleware,
        async (c) => {
            const userId = c.get("user").$id;
            const [rows, [account], [latestNotification]] = await Promise.all([
                db
                    .select({ id: workspaces.id, version: workspaces.dataVersion })
                    .from(workspaces)
                    .innerJoin(members, eq(members.workspaceId, workspaces.id))
                    .where(eq(members.userId, userId)),
                db.select({ updatedAt: users.updatedAt }).from(users).where(eq(users.id, userId)).limit(1),
                db.select({ at: max(notifications.createdAt) }).from(notifications).where(eq(notifications.userId, userId)),
            ]);

            return c.json({
                data: {
                    workspaces: Object.fromEntries(rows.map((row) => [row.id, row.version])) as Record<string, number>,
                    // Profile and preferences
                    user: account?.updatedAt.getTime() ?? 0,
                    // Newest reminder, so the bell picks up new ones
                    notifications: latestNotification?.at?.getTime() ?? 0,
                },
            });
        }
    )

    .get("/holiday-countries", sessionMiddleware, (c) => c.json({ data: listCountries() }))

    .post(
        "/",
        zValidator("form", createWorkspaceSchema),
        sessionMiddleware,
        async (c) => {
            const user = c.get("user");
            const { name } = c.req.valid("form");

            const workspace = await db.transaction((tx) => insertWorkspace(tx, user.$id, name));

            return c.json({ data: toDoc(workspace) });
        }
    )

    // Getting started with bulk input: checks a script against a workspace that doesn't exist
    // yet, and on apply creates it (with the signed-in user as admin) and runs the script.
    // All or nothing: if the script can't be applied, the new workspace is removed again.
    .post(
        "/setup",
        sessionMiddleware,
        zValidator("json", z.object({
            name: createWorkspaceSchema.shape.name,
            script: z.string().max(MAX_SCRIPT_LENGTH),
            apply: z.boolean().default(false),
        })),
        async (c) => {
            const user = c.get("user");
            const { name, script, apply } = c.req.valid("json");
            const timeZone = isValidTimeZone(user.preferences.timeZone) ? user.preferences.timeZone : "Asia/Dhaka";

            const memberId = randomUUID();
            const { results, plan } = planScript(script, newWorkspaceContext(memberId, user, timeZone));
            const valid = results.length > 0 && results.every((result) => result.ok);

            if (!apply || !valid) {
                return c.json({ data: { results, applied: false, counts: null, workspaceId: null } });
            }

            // The workspace, its admin and every command commit together, or not at all
            const workspace = await db.transaction(async (tx) => {
                const created = await insertWorkspace(tx, user.$id, name, memberId);
                await writePlan(tx, created.id, plan);
                return created;
            });
            try {
                await finishPlan(workspace.id, plan);
            } catch (error) {
                // The data is saved; the daily routines job fills in any tasks missed here
                console.error("Routine tasks after bulk setup:", error);
            }
            return c.json({ data: { results, applied: true, counts: countPlan(plan), workspaceId: workspace.id } });
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
            const { name, holidayCountry, workDayStart, workDayEnd } = c.req.valid("form");

            if (holidayCountry && !isSupportedCountry(holidayCountry)) {
                return c.json({ error: "Unknown holiday country" }, 400);
            }

            const member = await requireMember(c, workspaceId, { adminOnly: true });
            if (member instanceof Response) {
                return member;
            }

            if (workDayStart !== undefined || workDayEnd !== undefined) {
                const current = await getWorkspace(workspaceId);
                if ((workDayStart ?? current?.workDayStart ?? "") >= (workDayEnd ?? current?.workDayEnd ?? "")) {
                    return c.json({ error: "The day has to end after it starts" }, 400);
                }
            }

            const [workspace] = await db
                .update(workspaces)
                // "" switches public holidays off
                .set({ name, workDayStart, workDayEnd, holidayCountry: holidayCountry === undefined ? undefined : holidayCountry || null })
                .where(eq(workspaces.id, workspaceId))
                .returning();

            if (holidayCountry !== undefined) {
                await generateRoutineTasks(eq(routines.workspaceId, workspaceId));
            }

            return c.json({ data: toDoc(workspace) });
        }
    )

    .get(
        "/:workspaceId/holidays",
        sessionMiddleware,
        zValidator("query", holidayRangeSchema),
        async (c) => {
            const { workspaceId } = c.req.param();
            const { from, to, includeHidden } = c.req.valid("query");

            const [member, workspace] = await Promise.all([
                requireMember(c, workspaceId),
                findById(workspaces, workspaceId),
            ]);
            if (member instanceof Response) {
                return member;
            }
            if (!workspace) {
                return c.json({ error: "Workspace not found" }, 404);
            }

            const holidays = await getHolidays(workspace, from, to, { includeHidden: includeHidden === "true" });

            return c.json({ data: { holidays, weekend: weekendDays(workspace.holidayCountry), country: workspace.holidayCountry } });
        }
    )

    // Add a custom day off, or hide a public holiday (kind "hidden")
    .post(
        "/:workspaceId/holidays",
        sessionMiddleware,
        zValidator("json", holidayChangeSchema),
        async (c) => {
            const { workspaceId } = c.req.param();
            const { date, name, kind } = c.req.valid("json");

            const member = await requireMember(c, workspaceId, { adminOnly: true });
            if (member instanceof Response) {
                return member;
            }

            await db.insert(workspaceHolidays).values({ workspaceId, date, name, kind }).onConflictDoNothing();

            if (kind === "custom") {
                await removeRoutineTasksOn(workspaceId, date);
            } else {
                // The public holiday is a working day again
                await generateRoutineTasks(eq(routines.workspaceId, workspaceId));
            }

            return c.json({ data: { date, kind } });
        }
    )

    // Remove a custom day off, or unhide a public holiday
    .delete(
        "/:workspaceId/holidays",
        sessionMiddleware,
        zValidator("json", holidayChangeSchema.pick({ date: true, kind: true })),
        async (c) => {
            const { workspaceId } = c.req.param();
            const { date, kind } = c.req.valid("json");

            const member = await requireMember(c, workspaceId, { adminOnly: true });
            if (member instanceof Response) {
                return member;
            }

            await db.delete(workspaceHolidays).where(and(
                eq(workspaceHolidays.workspaceId, workspaceId),
                eq(workspaceHolidays.date, date),
                eq(workspaceHolidays.kind, kind),
            ));

            if (kind === "custom") {
                await generateRoutineTasks(eq(routines.workspaceId, workspaceId));
            } else {
                await removeRoutineTasksOn(workspaceId, date);
            }

            return c.json({ data: { date, kind } });
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
                .set({ inviteCode: generateInviteCode(6), inviteUses: 0 })
                .where(eq(workspaces.id, workspaceId))
                .returning();

            return c.json({ data: toDoc(workspace) });
        }
    )

    // A new viewer link; the old one stops working (admins)
    .post(
        "/:workspaceId/reset-viewer-invite-code",
        sessionMiddleware,
        async (c) => {
            const { workspaceId } = c.req.param();

            const member = await requireMember(c, workspaceId, { adminOnly: true });
            if (member instanceof Response) {
                return member;
            }

            const [workspace] = await db
                .update(workspaces)
                .set({ viewerInviteCode: generateInviteCode(10) })
                .where(eq(workspaces.id, workspaceId))
                .returning();

            return c.json({ data: toDoc(workspace) });
        }
    )

    // Settings → Bulk input: checks a script line by line, and with apply: true makes every
    // change in one go (admins). Nothing is written unless every line is valid.
    .post(
        "/:workspaceId/bulk",
        sessionMiddleware,
        zValidator("json", z.object({ script: z.string().max(MAX_SCRIPT_LENGTH), apply: z.boolean().default(false) })),
        async (c) => {
            const { workspaceId } = c.req.param();
            const { script, apply } = c.req.valid("json");

            // Admins and supervisors; only admins may add holidays and placeholders
            const member = await requireRole(c, workspaceId, canEditWork, "Only admins and supervisors can use bulk input");
            if (member instanceof Response) {
                return member;
            }

            const user = c.get("user");
            const timeZone = isValidTimeZone(user.preferences.timeZone) ? user.preferences.timeZone : "Asia/Dhaka";
            const context = await loadContext(workspaceId, member.$id, timeZone, canManageWorkspace(member.role));
            const { results, plan } = planScript(script, context);
            const valid = results.length > 0 && results.every((result) => result.ok);

            if (!apply || !valid) {
                return c.json({ data: { results, applied: false, counts: null } });
            }

            const counts = await applyPlan(workspaceId, plan);
            return c.json({ data: { results, applied: true, counts } });
        }
    )

    // How long the invite link works, and for how many people (admins)
    .patch(
        "/:workspaceId/invite",
        sessionMiddleware,
        zValidator("json", inviteLimitsSchema),
        async (c) => {
            const { workspaceId } = c.req.param();
            const { expiresInDays, maxUses } = c.req.valid("json");

            const member = await requireMember(c, workspaceId, { adminOnly: true });
            if (member instanceof Response) {
                return member;
            }

            const [workspace] = await db.update(workspaces)
                .set({
                    ...(expiresInDays !== undefined
                        ? { inviteExpiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60_000) : null }
                        : {}),
                    // A new limit counts from now
                    ...(maxUses !== undefined ? { inviteMaxUses: maxUses, inviteUses: 0 } : {}),
                })
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

            // The viewer link joins people read-only; its limits are the regular link's business
            const viaViewerLink = Boolean(workspace?.viewerInviteCode) && workspace?.viewerInviteCode === code;
            if (!workspace || (workspace.inviteCode !== code && !viaViewerLink)) {
                return c.json({ error: "Invalid invite code" }, 400);
            }
            if (!viaViewerLink && workspace.inviteExpiresAt && new Date(workspace.inviteExpiresAt).getTime() <= Date.now()) {
                return c.json({ error: "This invite link has expired" }, 400);
            }
            const joinRole = viaViewerLink ? MemberRole.VIEWER : MemberRole.ASSIGNEE;

            const outcome = await db.transaction(async (tx) => {
                if (viaViewerLink) {
                    const [joined] = await tx.insert(members).values({ userId: user.$id, workspaceId, role: joinRole })
                        .onConflictDoNothing().returning({ id: members.id });
                    if (!joined) tx.rollback();
                    return "joined" as const;
                }

                // Uses up one place on the link; the condition keeps simultaneous joins from
                // going past the limit (or past the expiry)
                const [claimed] = await tx.update(workspaces)
                    .set({ inviteUses: sql`${workspaces.inviteUses} + 1` })
                    .where(and(
                        eq(workspaces.id, workspaceId),
                        eq(workspaces.inviteCode, code),
                        or(isNull(workspaces.inviteExpiresAt), gt(workspaces.inviteExpiresAt, new Date())),
                        or(isNull(workspaces.inviteMaxUses), lt(workspaces.inviteUses, workspaces.inviteMaxUses)),
                    ))
                    .returning({ id: workspaces.id });
                if (!claimed) {
                    return "used-up" as const;
                }

                // A concurrent join (double click, retry) hits the unique index instead of a 500
                const [joined] = await tx
                    .insert(members)
                    .values({
                        userId: user.$id,
                        workspaceId,
                        role: joinRole,
                    })
                    .onConflictDoNothing()
                    .returning({ id: members.id });
                if (!joined) {
                    // Gives the place back
                    tx.rollback();
                }
                return "joined" as const;
            }).catch((error) => {
                if (error instanceof TransactionRollbackError) return "member" as const;
                throw error;
            });

            if (outcome === "used-up") {
                return c.json({ error: "This invite link has been used up" }, 400);
            }
            if (outcome === "member") {
                return c.json({ error: "Already a member" }, 400);
            }

            // Placeholders set up for this person's email: their tasks are now theirs
            const [joinedMember] = await db.select({ id: members.id }).from(members)
                .where(and(eq(members.workspaceId, workspaceId), eq(members.userId, user.$id))).limit(1);
            // (Not for viewers, who can't work on tasks)
            const placeholders = viaViewerLink ? [] : await db.select({ id: members.id }).from(members).where(and(
                eq(members.workspaceId, workspaceId),
                isNull(members.userId),
                eq(members.placeholderEmail, user.email.toLowerCase()),
            ));
            for (const placeholder of placeholders) {
                await handOverPlaceholder(placeholder.id, joinedMember.id);
            }

            return c.json({ data: workspace });
        }
    );

export default app;
