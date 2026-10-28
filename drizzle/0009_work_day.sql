ALTER TABLE "workspaces" ADD COLUMN "work_day_start" text DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "work_day_end" text DEFAULT '18:00' NOT NULL;