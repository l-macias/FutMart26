CREATE TYPE "public"."venue_provenance" AS ENUM('USER_CREATED');--> statement-breakpoint
CREATE TYPE "public"."venue_status" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "group_match_defaults" (
	"group_id" uuid PRIMARY KEY NOT NULL,
	"discipline" text DEFAULT 'F5' NOT NULL,
	"default_venue_id" uuid,
	"default_court_id" uuid,
	"default_location_text" text,
	"default_start_time" text,
	"default_duration_minutes" integer DEFAULT 60 NOT NULL,
	"default_capacity" integer DEFAULT 10 NOT NULL,
	"updated_by_player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_match_defaults_discipline_ck" CHECK ("group_match_defaults"."discipline" = 'F5'),
	CONSTRAINT "group_match_defaults_duration_ck" CHECK ("group_match_defaults"."default_duration_minutes" > 0),
	CONSTRAINT "group_match_defaults_capacity_ck" CHECK ("group_match_defaults"."default_capacity" > 0),
	CONSTRAINT "group_match_defaults_court_requires_venue_ck" CHECK ("group_match_defaults"."default_court_id" is null or "group_match_defaults"."default_venue_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "match_schedule_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"previous_scheduled_at" timestamp with time zone NOT NULL,
	"next_scheduled_at" timestamp with time zone NOT NULL,
	"changed_by_player_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_courts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"venue_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"status" "venue_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by_player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_courts_name_nonempty_ck" CHECK (btrim("venue_courts"."display_name") <> '' and btrim("venue_courts"."normalized_name") <> '')
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"city" text NOT NULL,
	"normalized_city" text NOT NULL,
	"address" text,
	"status" "venue_status" DEFAULT 'ACTIVE' NOT NULL,
	"provenance" "venue_provenance" DEFAULT 'USER_CREATED' NOT NULL,
	"created_by_player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_names_nonempty_ck" CHECK (btrim("venues"."display_name") <> '' and btrim("venues"."normalized_name") <> '' and btrim("venues"."city") <> '' and btrim("venues"."normalized_city") <> '')
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "venue_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "court_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_courts_id_venue_uq" ON "venue_courts" USING btree ("id","venue_id");--> statement-breakpoint
ALTER TABLE "group_match_defaults" ADD CONSTRAINT "group_match_defaults_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_match_defaults" ADD CONSTRAINT "group_match_defaults_default_venue_id_venues_id_fk" FOREIGN KEY ("default_venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_match_defaults" ADD CONSTRAINT "group_match_defaults_updated_by_player_id_players_id_fk" FOREIGN KEY ("updated_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_match_defaults" ADD CONSTRAINT "group_match_defaults_court_venue_fk" FOREIGN KEY ("default_court_id","default_venue_id") REFERENCES "public"."venue_courts"("id","venue_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_schedule_changes" ADD CONSTRAINT "match_schedule_changes_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_schedule_changes" ADD CONSTRAINT "match_schedule_changes_changed_by_player_id_players_id_fk" FOREIGN KEY ("changed_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_courts" ADD CONSTRAINT "venue_courts_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_courts" ADD CONSTRAINT "venue_courts_created_by_player_id_players_id_fk" FOREIGN KEY ("created_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_created_by_player_id_players_id_fk" FOREIGN KEY ("created_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_schedule_changes_match_time_idx" ON "match_schedule_changes" USING btree ("match_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_courts_active_name_uq" ON "venue_courts" USING btree ("venue_id","normalized_name") WHERE "venue_courts"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "venue_courts_venue_status_idx" ON "venue_courts" USING btree ("venue_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "venues_active_name_city_uq" ON "venues" USING btree ("normalized_name","normalized_city") WHERE "venues"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "venues_search_idx" ON "venues" USING btree ("normalized_city","normalized_name","status");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_court_venue_fk" FOREIGN KEY ("court_id","venue_id") REFERENCES "public"."venue_courts"("id","venue_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_participants_active_group_guest_uq" ON "match_participants" USING btree ("match_id","group_guest_id") WHERE "match_participants"."kind" = 'GUEST' and "match_participants"."status" in ('CONFIRMED', 'WAITLISTED');--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_court_requires_venue_ck" CHECK ("matches"."court_id" is null or "matches"."venue_id" is not null);
