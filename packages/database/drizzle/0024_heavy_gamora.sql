ALTER TYPE "public"."media_asset_purpose" ADD VALUE 'PLAYER_AVATAR_SOURCE';--> statement-breakpoint
CREATE TABLE "player_avatar_states" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"source_media_asset_id" uuid NOT NULL,
	"rendition_media_asset_id" uuid NOT NULL,
	"crop_x" numeric(6, 5) NOT NULL,
	"crop_y" numeric(6, 5) NOT NULL,
	"zoom" numeric(6, 5) NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_avatar_states_source_media_asset_id_unique" UNIQUE("source_media_asset_id"),
	CONSTRAINT "player_avatar_states_rendition_media_asset_id_unique" UNIQUE("rendition_media_asset_id"),
	CONSTRAINT "player_avatar_states_crop_x_ck" CHECK (crop_x >= 0 and crop_x <= 1),
	CONSTRAINT "player_avatar_states_crop_y_ck" CHECK (crop_y >= 0 and crop_y <= 1),
	CONSTRAINT "player_avatar_states_zoom_ck" CHECK (zoom >= 1 and zoom <= 3),
	CONSTRAINT "player_avatar_states_revision_ck" CHECK (revision > 0)
);
--> statement-breakpoint
ALTER TABLE "player_avatar_states" ADD CONSTRAINT "player_avatar_states_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_avatar_states" ADD CONSTRAINT "player_avatar_states_source_media_asset_id_media_assets_id_fk" FOREIGN KEY ("source_media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_avatar_states" ADD CONSTRAINT "player_avatar_states_rendition_media_asset_id_media_assets_id_fk" FOREIGN KEY ("rendition_media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;