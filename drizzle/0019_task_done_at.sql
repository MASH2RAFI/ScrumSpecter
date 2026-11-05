-- When a task was finished. updated_at moves on every edit and Kanban drop, so it can't say.
ALTER TABLE "tasks" ADD COLUMN "done_at" timestamp with time zone;--> statement-breakpoint
-- Tasks that are Done already: their last update is the best guess there is
UPDATE "tasks" SET "done_at" = "updated_at" WHERE "status" = 'DONE';--> statement-breakpoint
-- Set when a task becomes DONE (or is inserted as DONE, keeping a given time: Undo of a delete),
-- kept while it stays DONE, cleared when it leaves DONE. A trigger, so every way a task can
-- change (routes, Kanban, bulk input, restore, change requests, jobs) is covered at once.
CREATE FUNCTION set_task_done_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.status = 'DONE' THEN
		IF TG_OP = 'INSERT' THEN
			NEW.done_at := COALESCE(NEW.done_at, now());
		ELSIF OLD.status IS DISTINCT FROM 'DONE' THEN
			NEW.done_at := now();
		ELSE
			NEW.done_at := COALESCE(NEW.done_at, OLD.done_at, now());
		END IF;
	ELSE
		NEW.done_at := NULL;
	END IF;
	RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER tasks_done_at BEFORE INSERT OR UPDATE OF status ON tasks FOR EACH ROW EXECUTE FUNCTION set_task_done_at();
