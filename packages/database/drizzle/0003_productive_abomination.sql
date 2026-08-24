CREATE TYPE "public"."match_discipline" AS ENUM('F5');--> statement-breakpoint
CREATE TYPE "public"."match_participant_kind" AS ENUM('PLAYER', 'GUEST');--> statement-breakpoint
CREATE TYPE "public"."match_participant_status" AS ENUM('CONFIRMED', 'WAITLISTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('DRAFT', 'OPEN', 'STARTED', 'FINISHED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "match_participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"kind" "match_participant_kind" NOT NULL,
	"player_id" uuid,
	"guest_display_name" text,
	"guest_created_by_player_id" uuid,
	"status" "match_participant_status" NOT NULL,
	"admission_order" bigint NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"promoted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_participants_identity_ck" CHECK (("match_participants"."kind" = 'PLAYER' and "match_participants"."player_id" is not null and "match_participants"."guest_display_name" is null and "match_participants"."guest_created_by_player_id" is null) or ("match_participants"."kind" = 'GUEST' and "match_participants"."player_id" is null and "match_participants"."guest_created_by_player_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"discipline" "match_discipline" DEFAULT 'F5' NOT NULL,
	"status" "match_status" DEFAULT 'DRAFT' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"capacity" integer NOT NULL,
	"location_text" text NOT NULL,
	"created_by_player_id" uuid NOT NULL,
	"roster_locked_at" timestamp with time zone,
	"next_admission_order" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_duration_positive_ck" CHECK ("matches"."duration_minutes" > 0),
	CONSTRAINT "matches_capacity_positive_ck" CHECK ("matches"."capacity" > 0)
);
--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_guest_created_by_player_id_players_id_fk" FOREIGN KEY ("guest_created_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_by_player_id_players_id_fk" FOREIGN KEY ("created_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_participants_admission_order_uq" ON "match_participants" USING btree ("match_id","admission_order");--> statement-breakpoint
CREATE UNIQUE INDEX "match_participants_active_player_uq" ON "match_participants" USING btree ("match_id","player_id") WHERE "match_participants"."kind" = 'PLAYER' and "match_participants"."status" in ('CONFIRMED', 'WAITLISTED');--> statement-breakpoint
CREATE INDEX "match_participants_match_status_order_idx" ON "match_participants" USING btree ("match_id","status","admission_order");--> statement-breakpoint
CREATE INDEX "match_participants_player_match_idx" ON "match_participants" USING btree ("player_id","match_id");--> statement-breakpoint
CREATE INDEX "matches_group_scheduled_idx" ON "matches" USING btree ("group_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "matches_group_status_idx" ON "matches" USING btree ("group_id","status");