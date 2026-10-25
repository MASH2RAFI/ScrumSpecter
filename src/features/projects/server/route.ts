import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { sessionMiddleware } from "@/lib/session-middleware";
import { db } from "@/lib/db";
import { findById } from "@/lib/db/find-by-id";
import { projects, routines } from "@/lib/db/schema";
import { generateRoutineTasks } from "@/lib/routines";
import { toDoc } from "@/lib/db/types";
import { MemberRole } from "@/features/members/types";
import { requireAdmin, requireMember } from "@/features/members/utils";
import { createProjectFormSchema, updateProjectFormSchema } from "../schemas";
import { Project } from "../types";

const toProject = (project: typeof projects.$inferSelect) => toDoc(project) as Project;

const app = new Hono()
    .post(
        "/",
        sessionMiddleware,
        zValidator("form", createProjectFormSchema),
        async (c) => {
            const { name, workspaceId, sprintDuration, sprintNumber, currentSprintStartDate, currentSprintEndDate } = c.req.valid("form");

            const member = await requireAdmin(c, workspaceId, "Only admins can create projects");
            if (member instanceof Response) {
                return member;
            }

            const [project] = await db
                .insert(projects)
                .values({
                    name,
                    workspaceId,
                    sprintDuration,
                    sprintNumber,
                    currentSprintStartDate,
                    currentSprintEndDate,
                })
                .returning();

            return c.json({ data: toProject(project) });
        }
    )

    .get(
        "/",
        sessionMiddleware,
        zValidator("query", z.object({ workspaceId: z.string() })),
        async (c) => {
            const { workspaceId } = c.req.valid("query");

            if (!workspaceId) {
                return c.json({ error: "Missing workspaceId" }, 400);
            }

            // Rows are only returned once membership is confirmed
            const [member, rows] = await Promise.all([
                requireMember(c, workspaceId),
                db
                    .select()
                    .from(projects)
                    .where(eq(projects.workspaceId, workspaceId))
                    .orderBy(desc(projects.createdAt)),
            ]);

            if (member instanceof Response) {
                return member;
            }

            return c.json({ data: { documents: rows.map(toProject), total: rows.length } });
        }
    )

    .get(
        "/:projectId",
        sessionMiddleware,
        async (c) => {
            const { projectId } = c.req.param();

            const project = await findById(projects, projectId);

            if (!project) {
                return c.json({ error: "Project not found" }, 404);
            }

            const member = await requireMember(c, project.workspaceId);
            if (member instanceof Response) {
                return member;
            }

            return c.json({ data: toProject(project) });
        }
    )

    .patch(
        "/:projectId",
        sessionMiddleware,
        zValidator("form", updateProjectFormSchema),
        async (c) => {
            const { projectId } = c.req.param();
            const { name, sprintDuration, currentSprintStartDate, currentSprintEndDate, sprintNumber } = c.req.valid("form");

            const existingProject = await findById(projects, projectId);

            if (!existingProject) {
                return c.json({ error: "Project not found" }, 404);
            }

            const member = await requireMember(c, existingProject.workspaceId);
            if (member instanceof Response) {
                return member;
            }

            if (currentSprintStartDate !== undefined && member.role !== MemberRole.ADMIN) {
                return c.json({ error: "Only admins can update the starting sprint date" }, 403);
            }

            const updateData = {
                name,
                sprintDuration,
                currentSprintStartDate,
                currentSprintEndDate,
                sprintNumber,
            };

            // Drizzle rejects an update with nothing to set
            if (Object.values(updateData).every((value) => value === undefined)) {
                return c.json({ data: toProject(existingProject) });
            }

            const [project] = await db
                .update(projects)
                .set(updateData)
                .where(eq(projects.id, projectId))
                .returning();

            // A new or extended sprint gets its routine tasks right away, not at the next cron
            if (currentSprintEndDate !== undefined) {
                await generateRoutineTasks(eq(routines.projectId, projectId));
            }

            return c.json({ data: toProject(project) });
        }
    )

    .delete(
        "/:projectId",
        sessionMiddleware,
        async (c) => {
            const { projectId } = c.req.param();

            const existingProject = await findById(projects, projectId);

            if (!existingProject) {
                return c.json({ error: "Project not found" }, 404);
            }

            const member = await requireAdmin(c, existingProject.workspaceId, "Only admins can delete projects");
            if (member instanceof Response) {
                return member;
            }

            // Tasks are removed by ON DELETE CASCADE
            await db.delete(projects).where(eq(projects.id, projectId));

            return c.json({ data: { $id: existingProject.id } });
        }
    );

export default app;
