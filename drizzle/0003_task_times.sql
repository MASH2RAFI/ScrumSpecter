ALTER TABLE "routines" ADD COLUMN "start_time" text;--> statement-breakpoint
ALTER TABLE "routines" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "routines" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "duration_minutes" integer;