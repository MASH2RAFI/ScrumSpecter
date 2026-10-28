ALTER TABLE "routines" ADD COLUMN "show_in_table" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "routines" ADD COLUMN "show_in_kanban" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "routines" ADD COLUMN "show_in_calendar" boolean DEFAULT true NOT NULL;