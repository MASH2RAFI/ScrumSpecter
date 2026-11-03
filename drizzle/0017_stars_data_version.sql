-- Starring or unstarring moves the workspace's data_version like every other change, so other
-- devices (and a reload right after a star, before the browser copy was saved) pick it up
CREATE TRIGGER stars_version_ins AFTER INSERT ON stars REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_workspace_version();--> statement-breakpoint
CREATE TRIGGER stars_version_del AFTER DELETE ON stars REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION bump_workspace_version();
