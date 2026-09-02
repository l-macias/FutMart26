CREATE TYPE "public"."achievement_type" AS ENUM('FIRST_MATCH', 'FIVE_MATCHES', 'TEN_MATCHES', 'FIRST_GOAL', 'HAT_TRICK', 'FIRST_ASSIST', 'HIGH_RATING');--> statement-breakpoint
CREATE TYPE "public"."match_award_type" AS ENUM('TOP_RATED', 'TOP_SCORER', 'TOP_ASSIST');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'ACHIEVEMENT_EARNED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'AWARD_EARNED';--> statement-breakpoint
CREATE TABLE "match_awards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"type" "match_award_type" NOT NULL,
	"awarded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_achievements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"type" "achievement_type" NOT NULL,
	"source_match_id" uuid NOT NULL,
	"earned_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_awards" ADD CONSTRAINT "match_awards_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_awards" ADD CONSTRAINT "match_awards_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_source_match_id_matches_id_fk" FOREIGN KEY ("source_match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_awards_match_player_type_uq" ON "match_awards" USING btree ("match_id","player_id","type");--> statement-breakpoint
CREATE INDEX "match_awards_player_awarded_idx" ON "match_awards" USING btree ("player_id","awarded_at","id");--> statement-breakpoint
CREATE INDEX "match_awards_match_idx" ON "match_awards" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_achievements_player_type_uq" ON "player_achievements" USING btree ("player_id","type");--> statement-breakpoint
CREATE INDEX "player_achievements_player_earned_idx" ON "player_achievements" USING btree ("player_id","earned_at","id");--> statement-breakpoint
CREATE INDEX "player_achievements_source_match_idx" ON "player_achievements" USING btree ("source_match_id");