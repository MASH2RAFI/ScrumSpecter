CREATE TABLE "routine_skips" (
	"id" text PRIMARY KEY NOT NULL,
	"routine_id" text NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "routine_skips" ADD CONSTRAINT "routine_skips_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "routine_skips_day_idx" ON "routine_skips" USING btree ("routine_id","date");