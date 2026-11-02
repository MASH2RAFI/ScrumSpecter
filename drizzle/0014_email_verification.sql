CREATE TABLE "email_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_verifications_user_idx" ON "email_verifications" USING btree ("user_id");--> statement-breakpoint
-- Accounts from before verification existed count as verified
UPDATE "users" SET "email_verified_at" = "created_at";--> statement-breakpoint
-- A new email address has to be verified again
CREATE FUNCTION unverify_changed_email() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	NEW.email_verified_at := NULL;
	RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER users_email_unverify BEFORE UPDATE OF email ON users FOR EACH ROW
	WHEN (OLD.email IS DISTINCT FROM NEW.email)
	EXECUTE FUNCTION unverify_changed_email();
