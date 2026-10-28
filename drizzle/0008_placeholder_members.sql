ALTER TABLE "members" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "placeholder_name" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "placeholder_email" text;--> statement-breakpoint
-- Every member is either a person with an account or a named placeholder
ALTER TABLE "members" ADD CONSTRAINT "members_person_or_placeholder" CHECK ("user_id" IS NOT NULL OR "placeholder_name" IS NOT NULL);
