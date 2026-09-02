CREATE TYPE "public"."player_connection_status" AS ENUM('PENDING', 'ACCEPTED');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'CONNECTION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'CONNECTION_ACCEPTED';--> statement-breakpoint
CREATE TABLE "player_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"player_low_id" uuid NOT NULL,
	"player_high_id" uuid NOT NULL,
	"requester_player_id" uuid NOT NULL,
	"status" "player_connection_status" DEFAULT 'PENDING' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_connections_distinct_players_ck" CHECK ("player_connections"."player_low_id" < "player_connections"."player_high_id"),
	CONSTRAINT "player_connections_requester_in_pair_ck" CHECK ("player_connections"."requester_player_id" in ("player_connections"."player_low_id", "player_connections"."player_high_id")),
	CONSTRAINT "player_connections_accepted_at_ck" CHECK (("player_connections"."status" = 'PENDING' and "player_connections"."accepted_at" is null) or ("player_connections"."status" = 'ACCEPTED' and "player_connections"."accepted_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "match_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "related_player_id" uuid;--> statement-breakpoint
ALTER TABLE "player_connections" ADD CONSTRAINT "player_connections_player_low_id_players_id_fk" FOREIGN KEY ("player_low_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_connections" ADD CONSTRAINT "player_connections_player_high_id_players_id_fk" FOREIGN KEY ("player_high_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_connections" ADD CONSTRAINT "player_connections_requester_player_id_players_id_fk" FOREIGN KEY ("requester_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_connections_pair_uq" ON "player_connections" USING btree ("player_low_id","player_high_id");--> statement-breakpoint
CREATE INDEX "player_connections_low_status_time_idx" ON "player_connections" USING btree ("player_low_id","status","accepted_at");--> statement-breakpoint
CREATE INDEX "player_connections_high_status_time_idx" ON "player_connections" USING btree ("player_high_id","status","accepted_at");--> statement-breakpoint
CREATE INDEX "player_connections_requester_status_time_idx" ON "player_connections" USING btree ("requester_player_id","status","requested_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_player_id_players_id_fk" FOREIGN KEY ("related_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;
