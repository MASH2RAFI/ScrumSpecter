CREATE TABLE "stars" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"task_id" text,
	"routine_id" text,
	"workspace_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stars_one_item" CHECK (num_nonnulls("stars"."task_id", "stars"."routine_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "stars" ADD CONSTRAINT "stars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stars" ADD CONSTRAINT "stars_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stars" ADD CONSTRAINT "stars_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stars" ADD CONSTRAINT "stars_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stars_user_task_idx" ON "stars" USING btree ("user_id","task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stars_user_routine_idx" ON "stars" USING btree ("user_id","routine_id");--> statement-breakpoint
CREATE INDEX "stars_user_workspace_idx" ON "stars" USING btree ("user_id","workspace_id");--> statement-breakpoint
-- Leaving a workspace (or being removed) drops that person's stars there
CREATE FUNCTION drop_member_stars() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	DELETE FROM stars WHERE user_id = OLD.user_id AND workspace_id = OLD.workspace_id;
	RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER members_drop_stars AFTER DELETE ON members FOR EACH ROW
	WHEN (OLD.user_id IS NOT NULL)
	EXECUTE FUNCTION drop_member_stars();
