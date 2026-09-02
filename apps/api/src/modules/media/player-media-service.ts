import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import type { z } from "zod";
import type { avatarCropSchema, playerImageSchema } from "@football/contracts";
import type { Database } from "@football/database";
import { mediaAssets, players } from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { processAvatar } from "./avatar-image-processor.js";
import {
  StorageFeatureUnavailableError,
  type StorageProvider,
} from "./storage-provider.js";

type PlayerImage = z.infer<typeof playerImageSchema>;

interface MediaLogger {
  warn(metadata: Record<string, unknown>, message: string): void;
}

export class PlayerMediaService {
  constructor(
    private readonly database: Database,
    private readonly storage: StorageProvider,
    private readonly logger?: MediaLogger,
  ) {}

  async getPlayerImage(playerId: string): Promise<PlayerImage | null> {
    const [row] = await this.database
      .select({
        id: mediaAssets.id,
        version: mediaAssets.version,
        width: mediaAssets.width,
        height: mediaAssets.height,
      })
      .from(players)
      .innerJoin(
        mediaAssets,
        and(
          eq(mediaAssets.id, players.avatarMediaAssetId),
          eq(mediaAssets.status, "READY"),
          eq(mediaAssets.purpose, "PLAYER_AVATAR"),
        ),
      )
      .where(eq(players.id, playerId))
      .limit(1);
    return row ? projection(row) : null;
  }

  async uploadAvatar(
    playerId: string,
    input: {
      body: Buffer;
      claimedMimeType: string;
      crop: z.infer<typeof avatarCropSchema>;
    },
  ): Promise<PlayerImage> {
    if (!this.storage.available)
      throw new ApplicationError(
        "media_feature_unavailable",
        "Avatar storage is not configured",
        503,
      );
    const processed = await processAvatar(input);
    const assetId = randomUUID();
    const storageKey = `player-avatar/${assetId}/v1.webp`;

    await this.database.insert(mediaAssets).values({
      id: assetId,
      ownerPlayerId: playerId,
      purpose: "PLAYER_AVATAR",
      storageKey,
      mimeType: processed.mimeType,
      byteSize: processed.body.byteLength,
      width: processed.width,
      height: processed.height,
      status: "PENDING",
      version: 1,
    });

    try {
      await this.storage.putObject({
        key: storageKey,
        body: processed.body,
        contentType: processed.mimeType,
      });
    } catch (error) {
      await this.markDeleted(assetId);
      if (error instanceof StorageFeatureUnavailableError)
        throw new ApplicationError(
          "media_feature_unavailable",
          "Avatar storage is not configured",
          503,
        );
      throw new ApplicationError(
        "media_storage_unavailable",
        "Object storage could not persist the avatar",
        503,
        { cause: error instanceof Error ? error.name : "unknown" },
      );
    }

    let previous: { id: string; storageKey: string } | null;
    try {
      previous = await this.database.transaction(async (tx) => {
        const locked = await tx.execute(sql`
          select id, avatar_media_asset_id
          from ${players}
          where id = ${playerId}
          for update
        `);
        const player = locked[0] as
          { id: string; avatar_media_asset_id: string | null } | undefined;
        if (!player)
          throw new ApplicationError(
            "player_not_found",
            "Player not found",
            404,
          );

        const previousAssetId = player.avatar_media_asset_id;
        const [ready] = await tx
          .update(mediaAssets)
          .set({ status: "READY", updatedAt: new Date() })
          .where(
            and(
              eq(mediaAssets.id, assetId),
              eq(mediaAssets.ownerPlayerId, playerId),
              eq(mediaAssets.status, "PENDING"),
            ),
          )
          .returning({ id: mediaAssets.id });
        if (!ready)
          throw new Error("Pending avatar disappeared before activation");

        await tx
          .update(players)
          .set({ avatarMediaAssetId: assetId, updatedAt: new Date() })
          .where(eq(players.id, playerId));

        if (!previousAssetId) return null;
        const [old] = await tx
          .select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey })
          .from(mediaAssets)
          .where(
            and(
              eq(mediaAssets.id, previousAssetId),
              eq(mediaAssets.ownerPlayerId, playerId),
            ),
          )
          .limit(1);
        return old ?? null;
      });
    } catch (error) {
      await this.compensateFailedActivation(assetId, storageKey);
      throw error;
    }

    if (previous) await this.retire(previous);
    return {
      assetId,
      url: `/media/${assetId}/content`,
      version: 1,
      width: processed.width,
      height: processed.height,
    };
  }

  async removeAvatar(playerId: string) {
    const previous = await this.database.transaction(async (tx) => {
      const locked = await tx.execute(sql`
        select id, avatar_media_asset_id
        from ${players}
        where id = ${playerId}
        for update
      `);
      const player = locked[0] as
        { id: string; avatar_media_asset_id: string | null } | undefined;
      if (!player)
        throw new ApplicationError("player_not_found", "Player not found", 404);
      if (!player.avatar_media_asset_id) return null;

      const [asset] = await tx
        .select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey })
        .from(mediaAssets)
        .where(
          and(
            eq(mediaAssets.id, player.avatar_media_asset_id),
            eq(mediaAssets.ownerPlayerId, playerId),
            eq(mediaAssets.purpose, "PLAYER_AVATAR"),
          ),
        )
        .limit(1);
      if (!asset) throw new Error("Player avatar reference is inconsistent");

      await tx
        .update(players)
        .set({ avatarMediaAssetId: null, updatedAt: new Date() })
        .where(eq(players.id, playerId));
      await tx
        .update(mediaAssets)
        .set({ status: "DELETED", updatedAt: new Date() })
        .where(eq(mediaAssets.id, asset.id));
      return asset;
    });

    if (previous) await this.deleteObjectBestEffort(previous);
  }

  async content(assetId: string) {
    if (!this.storage.available)
      throw new ApplicationError(
        "media_feature_unavailable",
        "Avatar storage is not configured",
        503,
      );
    const [asset] = await this.database
      .select({
        storageKey: mediaAssets.storageKey,
        mimeType: mediaAssets.mimeType,
      })
      .from(mediaAssets)
      .innerJoin(players, eq(players.avatarMediaAssetId, mediaAssets.id))
      .where(
        and(
          eq(mediaAssets.id, assetId),
          eq(mediaAssets.status, "READY"),
          eq(mediaAssets.purpose, "PLAYER_AVATAR"),
        ),
      )
      .limit(1);
    if (!asset)
      throw new ApplicationError("media_not_found", "Media not found", 404);
    try {
      const object = await this.storage.getObject(asset.storageKey);
      if (!object)
        throw new ApplicationError("media_not_found", "Media not found", 404);
      return { ...object, contentType: asset.mimeType };
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      if (error instanceof StorageFeatureUnavailableError)
        throw new ApplicationError(
          "media_feature_unavailable",
          "Avatar storage is not configured",
          503,
        );
      throw new ApplicationError(
        "media_storage_unavailable",
        "Object storage could not deliver the avatar",
        503,
      );
    }
  }

  private async retire(asset: { id: string; storageKey: string }) {
    await this.markDeleted(asset.id);
    await this.deleteObjectBestEffort(asset);
  }

  private async compensateFailedActivation(
    assetId: string,
    storageKey: string,
  ) {
    await this.markDeleted(assetId);
    await this.deleteObjectBestEffort({ id: assetId, storageKey });
  }

  private async markDeleted(assetId: string) {
    await this.database
      .update(mediaAssets)
      .set({ status: "DELETED", updatedAt: new Date() })
      .where(eq(mediaAssets.id, assetId));
  }

  private async deleteObjectBestEffort(asset: {
    id: string;
    storageKey: string;
  }) {
    try {
      await this.storage.deleteObject(asset.storageKey);
    } catch (error) {
      this.logger?.warn(
        {
          assetId: asset.id,
          errorName: error instanceof Error ? error.name : "unknown",
        },
        "media object cleanup deferred",
      );
    }
  }
}

function projection(input: {
  id: string;
  version: number;
  width: number;
  height: number;
}): PlayerImage {
  return {
    assetId: input.id,
    url: `/media/${input.id}/content`,
    version: input.version,
    width: input.width,
    height: input.height,
  };
}
