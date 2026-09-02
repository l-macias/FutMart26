CREATE TYPE "public"."directed_invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'REVOKED');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'GROUP_INVITATION_RECEIVED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'MATCH_INVITATION_RECEIVED';--> statement-breakpoint
CREATE TABLE "group_connection_invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"invited_player_id" uuid NOT NULL,
	"invited_by_player_id" uuid NOT NULL,
	"invited_by_role" "membership_role" NOT NULL,
	"status" "directed_invitation_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_player_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_connection_invitations_distinct_players_ck" CHECK ("group_connection_invitations"."invited_player_id" <> "group_connection_invitations"."invited_by_player_id")
);
--> statement-breakpoint
CREATE TABLE "match_player_invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"invited_player_id" uuid NOT NULL,
	"invited_by_player_id" uuid NOT NULL,
	"status" "directed_invitation_status" DEFAULT 'PENDING' NOT NULL,
	"responded_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_player_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_player_invitations_distinct_players_ck" CHECK ("match_player_invitations"."invited_player_id" <> "match_player_invitations"."invited_by_player_id")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "group_connection_invitations" ADD CONSTRAINT "group_connection_invitations_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_connection_invitations" ADD CONSTRAINT "group_connection_invitations_invited_player_id_players_id_fk" FOREIGN KEY ("invited_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_connection_invitations" ADD CONSTRAINT "group_connection_invitations_invited_by_player_id_players_id_fk" FOREIGN KEY ("invited_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_connection_invitations" ADD CONSTRAINT "group_connection_invitations_revoked_by_player_id_players_id_fk" FOREIGN KEY ("revoked_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_player_invitations" ADD CONSTRAINT "match_player_invitations_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_player_invitations" ADD CONSTRAINT "match_player_invitations_invited_player_id_players_id_fk" FOREIGN KEY ("invited_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_player_invitations" ADD CONSTRAINT "match_player_invitations_invited_by_player_id_players_id_fk" FOREIGN KEY ("invited_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_player_invitations" ADD CONSTRAINT "match_player_invitations_revoked_by_player_id_players_id_fk" FOREIGN KEY ("revoked_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_connection_invitations_pending_uq" ON "group_connection_invitations" USING btree ("group_id","invited_player_id") WHERE "group_connection_invitations"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "group_connection_invitations_recipient_status_time_idx" ON "group_connection_invitations" USING btree ("invited_player_id","status","created_at");--> statement-breakpoint
CREATE INDEX "group_connection_invitations_group_status_time_idx" ON "group_connection_invitations" USING btree ("group_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "match_player_invitations_pending_uq" ON "match_player_invitations" USING btree ("match_id","invited_player_id") WHERE "match_player_invitations"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "match_player_invitations_recipient_status_time_idx" ON "match_player_invitations" USING btree ("invited_player_id","status","created_at");--> statement-breakpoint
CREATE INDEX "match_player_invitations_match_status_time_idx" ON "match_player_invitations" USING btree ("match_id","status","created_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;
