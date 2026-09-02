CREATE TYPE "public"."notification_type" AS ENUM('VOTING_AVAILABLE', 'PROGRESSION_AVAILABLE', 'MATCH_CANCELLED');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipient_player_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"match_id" uuid NOT NULL,
	"deduplication_key" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_player_id_players_id_fk" FOREIGN KEY ("recipient_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_deduplication_key_uq" ON "notifications" USING btree ("deduplication_key");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_player_id","created_at","id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications" USING btree ("recipient_player_id","created_at") WHERE "notifications"."read_at" is null;