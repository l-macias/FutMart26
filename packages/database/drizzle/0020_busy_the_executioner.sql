CREATE TYPE "public"."media_asset_purpose" AS ENUM('PLAYER_AVATAR');--> statement-breakpoint
CREATE TYPE "public"."media_asset_status" AS ENUM('PENDING', 'READY', 'DELETED');--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_player_id" uuid NOT NULL,
	"purpose" "media_asset_purpose" NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"status" "media_asset_status" DEFAULT 'PENDING' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "media_assets_byte_size_positive_ck" CHECK ("media_assets"."byte_size" > 0),
	CONSTRAINT "media_assets_dimensions_positive_ck" CHECK ("media_assets"."width" > 0 and "media_assets"."height" > 0),
	CONSTRAINT "media_assets_version_positive_ck" CHECK ("media_assets"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "avatar_media_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_owner_status_idx" ON "media_assets" USING btree ("owner_player_id","status");--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_avatar_media_asset_id_media_assets_id_fk" FOREIGN KEY ("avatar_media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;