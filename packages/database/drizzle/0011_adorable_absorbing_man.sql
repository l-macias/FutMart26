CREATE TYPE "public"."football_role" AS ENUM('LIBRE', 'DEFENSIVO', 'MEDIO', 'OFENSIVO', 'PORTERO');--> statement-breakpoint
CREATE TYPE "public"."football_strength" AS ENUM('VELOCIDAD', 'PASE', 'REGATE', 'REMATE', 'DEFENSA', 'FISICO');--> statement-breakpoint
CREATE TYPE "public"."group_guest_status" AS ENUM('ACTIVE', 'ARCHIVED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."invitation_type" AS ENUM('SINGLE_USE', 'TIME_LIMITED');--> statement-breakpoint
ALTER TYPE "public"."membership_status" ADD VALUE 'BLOCKED';--> statement-breakpoint
CREATE TABLE "group_guests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"normalized_display_name" text NOT NULL,
	"status" "group_guest_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by_player_id" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by_player_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_player_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_guests_names_nonempty_ck" CHECK (btrim("group_guests"."display_name") <> '' and btrim("group_guests"."normalized_display_name") <> '')
);
--> statement-breakpoint
CREATE TABLE "group_invitation_usages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"invitation_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"type" "invitation_type" NOT NULL,
	"token_hash" text NOT NULL,
	"created_by_player_id" uuid NOT NULL,
	"created_by_role" "membership_role" NOT NULL,
	"expires_at" timestamp with time zone,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_player_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_invitations_use_count_ck" CHECK ("group_invitations"."use_count" >= 0),
	CONSTRAINT "group_invitations_max_uses_ck" CHECK ("group_invitations"."max_uses" is null or ("group_invitations"."max_uses" > 0 and "group_invitations"."use_count" <= "group_invitations"."max_uses")),
	CONSTRAINT "group_invitations_type_ck" CHECK (("group_invitations"."type" = 'SINGLE_USE' and "group_invitations"."expires_at" is null and "group_invitations"."max_uses" = 1) or ("group_invitations"."type" = 'TIME_LIMITED' and "group_invitations"."expires_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "player_football_preferences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"discipline" text DEFAULT 'F5' NOT NULL,
	"preferred_roles" "football_role"[] NOT NULL,
	"willing_to_play_goalkeeper" boolean DEFAULT false NOT NULL,
	"strengths" "football_strength"[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_football_preferences_discipline_ck" CHECK ("player_football_preferences"."discipline" = 'F5'),
	CONSTRAINT "player_football_preferences_roles_ck" CHECK (cardinality("player_football_preferences"."preferred_roles") <= 2),
	CONSTRAINT "player_football_preferences_strengths_ck" CHECK (cardinality("player_football_preferences"."strengths") <= 3),
	CONSTRAINT "player_football_preferences_keeper_ck" CHECK (not ('PORTERO' = any("player_football_preferences"."preferred_roles")) or "player_football_preferences"."willing_to_play_goalkeeper")
);
--> statement-breakpoint
ALTER TABLE "match_participants" DROP CONSTRAINT "match_participants_identity_ck";--> statement-breakpoint
ALTER TABLE "group_memberships" ADD COLUMN "guest_allowance_override" integer;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "guests_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "default_guest_allowance_per_member" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "group_guest_id" uuid;--> statement-breakpoint
-- Existing development Guest admissions become distinct deleted directory identities.
-- This preserves every historical participant without merging people by display name.
INSERT INTO "group_guests" (
	"id", "group_id", "display_name", "normalized_display_name", "status",
	"created_by_player_id", "deleted_at", "deleted_by_player_id", "created_at", "updated_at"
)
SELECT mp."id", m."group_id", mp."guest_display_name",
	lower(regexp_replace(btrim(mp."guest_display_name"), '\s+', ' ', 'g')),
	'DELETED', mp."guest_created_by_player_id", now(), mp."guest_created_by_player_id",
	mp."created_at", now()
FROM "match_participants" mp
JOIN "matches" m ON m."id" = mp."match_id"
WHERE mp."kind" = 'GUEST';--> statement-breakpoint
UPDATE "match_participants"
SET "group_guest_id" = "id"
WHERE "kind" = 'GUEST';--> statement-breakpoint
ALTER TABLE "group_guests" ADD CONSTRAINT "group_guests_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_guests" ADD CONSTRAINT "group_guests_created_by_player_id_players_id_fk" FOREIGN KEY ("created_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_guests" ADD CONSTRAINT "group_guests_archived_by_player_id_players_id_fk" FOREIGN KEY ("archived_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_guests" ADD CONSTRAINT "group_guests_deleted_by_player_id_players_id_fk" FOREIGN KEY ("deleted_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitation_usages" ADD CONSTRAINT "group_invitation_usages_invitation_id_group_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."group_invitations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitation_usages" ADD CONSTRAINT "group_invitation_usages_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitation_usages" ADD CONSTRAINT "group_invitation_usages_membership_id_group_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."group_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_created_by_player_id_players_id_fk" FOREIGN KEY ("created_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_revoked_by_player_id_players_id_fk" FOREIGN KEY ("revoked_by_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_football_preferences" ADD CONSTRAINT "player_football_preferences_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_guests_reusable_name_uq" ON "group_guests" USING btree ("group_id","normalized_display_name") WHERE "group_guests"."status" in ('ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE INDEX "group_guests_group_status_name_idx" ON "group_guests" USING btree ("group_id","status","normalized_display_name");--> statement-breakpoint
CREATE UNIQUE INDEX "group_invitation_usages_invitation_player_uq" ON "group_invitation_usages" USING btree ("invitation_id","player_id");--> statement-breakpoint
CREATE INDEX "group_invitation_usages_invitation_time_idx" ON "group_invitation_usages" USING btree ("invitation_id","used_at");--> statement-breakpoint
CREATE UNIQUE INDEX "group_invitations_token_hash_uq" ON "group_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "group_invitations_group_created_idx" ON "group_invitations" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "player_football_preferences_player_discipline_uq" ON "player_football_preferences" USING btree ("player_id","discipline");--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_group_guest_id_group_guests_id_fk" FOREIGN KEY ("group_guest_id") REFERENCES "public"."group_guests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_participants_group_guest_match_idx" ON "match_participants" USING btree ("group_guest_id","match_id");--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_guest_allowance_nonnegative_ck" CHECK ("group_memberships"."guest_allowance_override" is null or "group_memberships"."guest_allowance_override" >= 0);--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_default_guest_allowance_nonnegative_ck" CHECK ("groups"."default_guest_allowance_per_member" >= 0);--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_identity_ck" CHECK (("match_participants"."kind" = 'PLAYER' and "match_participants"."player_id" is not null and "match_participants"."group_guest_id" is null and "match_participants"."guest_display_name" is null and "match_participants"."guest_created_by_player_id" is null) or ("match_participants"."kind" = 'GUEST' and "match_participants"."player_id" is null and "match_participants"."group_guest_id" is not null and "match_participants"."guest_display_name" is not null and btrim("match_participants"."guest_display_name") <> '' and "match_participants"."guest_created_by_player_id" is not null));
--> statement-breakpoint
CREATE FUNCTION enforce_match_participant_group_guest_group()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.kind = 'GUEST' AND NEW.group_guest_id IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM group_guests gg
		JOIN matches m ON m.id = NEW.match_id
		WHERE gg.id = NEW.group_guest_id AND gg.group_id = m.group_id
	) THEN
		RAISE EXCEPTION 'GroupGuest must belong to the Match Group'
			USING ERRCODE = '23514', CONSTRAINT = 'match_participants_group_guest_group_ck';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER match_participants_group_guest_group_trg
BEFORE INSERT OR UPDATE OF match_id, group_guest_id, kind ON match_participants
FOR EACH ROW EXECUTE FUNCTION enforce_match_participant_group_guest_group();
