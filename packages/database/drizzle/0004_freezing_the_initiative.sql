ALTER TABLE "match_participants" ADD COLUMN "cancelled_by_player_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "cancelled_by_player_id" uuid;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_cancelled_by_player_id_players_id_fk" FOREIGN KEY ("cancelled_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_cancelled_by_player_id_players_id_fk" FOREIGN KEY ("cancelled_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;