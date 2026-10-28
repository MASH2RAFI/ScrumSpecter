-- Roles: ADMIN, SUPERVISOR, REVIEWER, ASSIGNEE, VIEWER. Existing MEMBERs become ASSIGNEEs.
-- (A new enum is swapped in, since a value added with ALTER TYPE can't be used in the same transaction.)
CREATE TYPE "public"."member_role_new" AS ENUM('ADMIN', 'SUPERVISOR', 'REVIEWER', 'ASSIGNEE', 'VIEWER');--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "role" TYPE "public"."member_role_new"
	USING (CASE "role"::text WHEN 'MEMBER' THEN 'ASSIGNEE' ELSE "role"::text END)::"public"."member_role_new";--> statement-breakpoint
DROP TYPE "public"."member_role";--> statement-breakpoint
ALTER TYPE "public"."member_role_new" RENAME TO "member_role";--> statement-breakpoint
-- Several assignees per task and routine; existing single assignees carry over
ALTER TABLE "tasks" ADD COLUMN "assignee_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "routines" ADD COLUMN "assignee_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
UPDATE "tasks" SET "assignee_ids" = ARRAY["assignee_id"] WHERE "assignee_id" IS NOT NULL;--> statement-breakpoint
UPDATE "routines" SET "assignee_ids" = ARRAY["assignee_id"] WHERE "assignee_id" IS NOT NULL;--> statement-breakpoint
DROP INDEX "tasks_assignee_idx";--> statement-breakpoint
CREATE INDEX "tasks_assignees_idx" ON "tasks" USING gin ("assignee_ids");--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "assignee_id";--> statement-breakpoint
ALTER TABLE "routines" DROP COLUMN "assignee_id";--> statement-breakpoint
-- A separate invite link that joins people as viewers
ALTER TABLE "workspaces" ADD COLUMN "viewer_invite_code" text;--> statement-breakpoint
UPDATE "workspaces" SET "viewer_invite_code" = left(md5(random()::text || "id"), 10);
