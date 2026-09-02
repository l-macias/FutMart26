CREATE TABLE "match_recruitment_needs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"role" "football_role" NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_recruitment_needs_quantity_positive_ck" CHECK ("match_recruitment_needs"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "recruitment_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "match_recruitment_needs" ADD CONSTRAINT "match_recruitment_needs_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_recruitment_needs_match_role_uq" ON "match_recruitment_needs" USING btree ("match_id","role");--> statement-breakpoint
CREATE INDEX "matches_recruitment_open_scheduled_idx" ON "matches" USING btree ("scheduled_at","id") WHERE "matches"."recruitment_enabled" and "matches"."status" = 'OPEN';