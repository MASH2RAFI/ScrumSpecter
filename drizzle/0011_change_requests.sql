CREATE TYPE "public"."change_request_kind" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."change_request_status" AS ENUM('pending', 'approved', 'declined');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'change_request';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'change_reviewed';--> statement-breakpoint
CREATE TABLE "change_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"requester_id" text NOT NULL,
	"kind" "change_request_kind" NOT NULL,
	"task_id" text,
	"task_name" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"status" "change_request_status" DEFAULT 'pending' NOT NULL,
	"reviewer_id" text,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requester_id_members_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_reviewer_id_members_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_requests_workspace_status_idx" ON "change_requests" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "change_requests_requester_idx" ON "change_requests" USING btree ("requester_id");--> statement-breakpoint
-- Requests show up for others as soon as they change (see 0004)
CREATE TRIGGER change_requests_version_ins AFTER INSERT ON change_requests REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_workspace_version();--> statement-breakpoint
CREATE TRIGGER change_requests_version_upd AFTER UPDATE ON change_requests REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_workspace_version();--> statement-breakpoint
CREATE TRIGGER change_requests_version_del AFTER DELETE ON change_requests REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_workspace_version();
