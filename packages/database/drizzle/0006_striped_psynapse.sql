CREATE TYPE "public"."match_attendance_status" AS ENUM('PLAYED', 'NO_SHOW');--> statement-breakpoint
CREATE TABLE "match_participant_stats" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"goals" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"updated_by_player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_participant_stats_goals_ck" CHECK ("match_participant_stats"."goals" >= 0),
	CONSTRAINT "match_participant_stats_assists_ck" CHECK ("match_participant_stats"."assists" >= 0)
);
--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "attendance" "match_attendance_status";--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "attendance_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "attendance_confirmed_by_player_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "observer_player_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "roster_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "roster_confirmed_by_player_id" uuid;--> statement-breakpoint
ALTER TABLE "match_participant_stats" ADD CONSTRAINT "match_participant_stats_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participant_stats" ADD CONSTRAINT "match_participant_stats_participant_id_match_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."match_participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participant_stats" ADD CONSTRAINT "match_participant_stats_updated_by_player_id_players_id_fk" FOREIGN KEY ("updated_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_participant_stats_participant_uq" ON "match_participant_stats" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "match_participant_stats_match_idx" ON "match_participant_stats" USING btree ("match_id");--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_attendance_confirmed_by_player_id_players_id_fk" FOREIGN KEY ("attendance_confirmed_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_observer_player_id_players_id_fk" FOREIGN KEY ("observer_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_roster_confirmed_by_player_id_players_id_fk" FOREIGN KEY ("roster_confirmed_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;