CREATE TYPE "public"."holiday_kind" AS ENUM('custom', 'hidden');--> statement-breakpoint
CREATE TABLE "workspace_holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"kind" "holiday_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "holiday_country" text DEFAULT 'BD';--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "data_version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_holidays" ADD CONSTRAINT "workspace_holidays_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_holidays_day_idx" ON "workspace_holidays" USING btree ("workspace_id","date","kind");--> statement-breakpoint
-- Any change to a workspace's rows bumps workspaces.data_version, so clients can keep
-- their cached data until it moves. Statement-level, so a bulk insert bumps once.
CREATE FUNCTION bump_workspace_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		UPDATE workspaces SET data_version = data_version + 1 WHERE id IN (SELECT workspace_id FROM new_rows);
	ELSIF TG_OP = 'DELETE' THEN
		UPDATE workspaces SET data_version = data_version + 1 WHERE id IN (SELECT workspace_id FROM old_rows);
	ELSE
		UPDATE workspaces SET data_version = data_version + 1
		WHERE id IN (SELECT workspace_id FROM new_rows UNION SELECT workspace_id FROM old_rows);
	END IF;
	RETURN NULL;
END $$;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
	FOREACH t IN ARRAY ARRAY['tasks', 'projects', 'members', 'routines', 'workspace_holidays'] LOOP
		EXECUTE format('CREATE TRIGGER %1$s_version_ins AFTER INSERT ON %1$I REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_workspace_version()', t);
		EXECUTE format('CREATE TRIGGER %1$s_version_upd AFTER UPDATE ON %1$I REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_workspace_version()', t);
		EXECUTE format('CREATE TRIGGER %1$s_version_del AFTER DELETE ON %1$I REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_workspace_version()', t);
	END LOOP;
END $$;
--> statement-breakpoint
-- Edits to the workspace row itself (name, invite code, holiday country)
CREATE FUNCTION bump_own_workspace_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.data_version = OLD.data_version THEN
		NEW.data_version := OLD.data_version + 1;
	END IF;
	RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER workspaces_version_self BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION bump_own_workspace_version();
--> statement-breakpoint
-- Member lists show names and emails, so a profile change touches every workspace the user is in
CREATE FUNCTION bump_user_workspaces_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	UPDATE workspaces SET data_version = data_version + 1
	WHERE id IN (SELECT workspace_id FROM members WHERE user_id = NEW.id);
	RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER users_version_profile AFTER UPDATE OF name, email ON users FOR EACH ROW
	WHEN (OLD.name IS DISTINCT FROM NEW.name OR OLD.email IS DISTINCT FROM NEW.email)
	EXECUTE FUNCTION bump_user_workspaces_version();
