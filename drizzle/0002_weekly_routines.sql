CREATE TABLE "routines" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	"assignee_id" text,
	"story_points" integer,
	"weekdays" integer[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "routine_id" text;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routines_workspace_idx" ON "routines" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_routine_due_idx" ON "tasks" USING btree ("routine_id","due_date");