import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { z } from "zod";
import type {
  avatarCropSchema,
  avatarEditorStateSchema,
  playerImageSchema,
} from "@football/contracts";
import type { Database } from "@football/database";
import {
  mediaAssets,
  playerAvatarStates,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import {
  processAvatar,
  renderAvatarRendition,
  type ProcessedImage,
} from "./avatar-image-processor.js";
import {
  StorageFeatureUnavailableError,
  type StorageProvider,
} from "./storage-provider.js";

type PlayerImage = z.infer<typeof playerImageSchema>;
type AvatarEditorState = z.infer<typeof avatarEditorStateSchema>;
type AvatarCrop = z.infer<typeof avatarCropSchema>;
type StoredAsset = { id: string; storageKey: string };

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

  async getAvatarEditorState(playerId: string): Promise<AvatarEditorState> {
    const image = await this.getPlayerImage(playerId);
    if (!image) return { status: "EMPTY" };

    const [state] = await this.database
      .select({
        cropX: playerAvatarStates.cropX,
        cropY: playerAvatarStates.cropY,
        zoom: playerAvatarStates.zoom,
        revision: playerAvatarStates.revision,
        sourceWidth: mediaAssets.width,
        sourceHeight: mediaAssets.height,
      })
      .from(playerAvatarStates)
      .innerJoin(
        mediaAssets,
        and(
          eq(mediaAssets.id, playerAvatarStates.sourceMediaAssetId),
          eq(mediaAssets.ownerPlayerId, playerId),
          eq(mediaAssets.purpose, "PLAYER_AVATAR_SOURCE"),
          eq(mediaAssets.status, "READY"),
        ),
      )
      .where(
        and(
          eq(playerAvatarStates.playerId, playerId),
          eq(playerAvatarStates.renditionMediaAssetId, image.assetId),
        ),
      )
      .limit(1);

    if (!state) return { status: "LEGACY", image };
    return {
      status: "EDITABLE",
      image,
      source: {
        url: "/me/player/avatar/source",
        width: state.sourceWidth,
        height: state.sourceHeight,
      },
      crop: {
        cropX: Number(state.cropX),
        cropY: Number(state.cropY),
        zoom: Number(state.zoom),
      },
      revision: state.revision,
    };
  }

  async uploadAvatar(
    playerId: string,
    input: {
      body: Buffer;
      claimedMimeType: string;
      crop: AvatarCrop;
    },
  ): Promise<PlayerImage> {
    this.assertStorage();
    const processed = await processAvatar(input);
    const sourceId = randomUUID();
    const renditionId = randomUUID();
    const sourceKey = `player-avatar-source/${sourceId}/v1.webp`;
    const renditionKey = `player-avatar/${renditionId}/v1.webp`;

    await this.database
      .insert(mediaAssets)
      .values([
        assetRow(
          sourceId,
          playerId,
          "PLAYER_AVATAR_SOURCE",
          sourceKey,
          processed.source,
        ),
        assetRow(
          renditionId,
          playerId,
          "PLAYER_AVATAR",
          renditionKey,
          processed.rendition,
        ),
      ]);

    try {
      await this.put(sourceKey, processed.source);
      await this.put(renditionKey, processed.rendition);
    } catch (error) {
      await this.compensateAssets([
        { id: sourceId, storageKey: sourceKey },
        { id: renditionId, storageKey: renditionKey },
      ]);
      throw this.storageWriteError(error);
    }

    let previous: StoredAsset[];
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

        const oldAssets = await this.currentAvatarAssets(
          tx as unknown as Database,
          playerId,
          player.avatar_media_asset_id,
        );
        await this.activateAssets(tx as unknown as Database, playerId, [
          sourceId,
          renditionId,
        ]);
        await tx
          .insert(playerAvatarStates)
          .values({
            playerId,
            sourceMediaAssetId: sourceId,
            renditionMediaAssetId: renditionId,
            cropX: String(input.crop.cropX),
            cropY: String(input.crop.cropY),
            zoom: String(input.crop.zoom),
            revision: 1,
          })
          .onConflictDoUpdate({
            target: playerAvatarStates.playerId,
            set: {
              sourceMediaAssetId: sourceId,
              renditionMediaAssetId: renditionId,
              cropX: String(input.crop.cropX),
              cropY: String(input.crop.cropY),
              zoom: String(input.crop.zoom),
              revision: 1,
              updatedAt: new Date(),
            },
          });
        await tx
          .update(players)
          .set({ avatarMediaAssetId: renditionId, updatedAt: new Date() })
          .where(eq(players.id, playerId));
        return oldAssets;
      });
    } catch (error) {
      await this.compensateAssets([
        { id: sourceId, storageKey: sourceKey },
        { id: renditionId, storageKey: renditionKey },
      ]);
      throw error;
    }

    await this.retireAssets(previous);
    return projection({
      id: renditionId,
      version: 1,
      width: processed.rendition.width,
      height: processed.rendition.height,
    });
  }

  async reframeAvatar(
    playerId: string,
    input: AvatarCrop & { expectedRevision: number },
  ): Promise<PlayerImage> {
    this.assertStorage();
    const current = await this.editableAvatar(playerId);
    if (!current)
      throw new ApplicationError(
        "avatar_source_unavailable",
        "Volvé a seleccionar esta foto una vez para editar su encuadre.",
        409,
      );
    if (current.revision !== input.expectedRevision) throw revisionConflict();

    const sourceObject = await this.getStoredObject(current.source.storageKey);
    const sourceBody = await streamToBuffer(sourceObject.body);
    const rendition = await renderAvatarRendition(
      {
        body: sourceBody,
        mimeType: "image/webp",
        width: current.source.width,
        height: current.source.height,
      },
      input,
    );
    const renditionId = randomUUID();
    const renditionKey = `player-avatar/${renditionId}/v1.webp`;
    await this.database
      .insert(mediaAssets)
      .values(
        assetRow(
          renditionId,
          playerId,
          "PLAYER_AVATAR",
          renditionKey,
          rendition,
        ),
      );
    try {
      await this.put(renditionKey, rendition);
    } catch (error) {
      await this.compensateAssets([
        { id: renditionId, storageKey: renditionKey },
      ]);
      throw this.storageWriteError(error);
    }

    try {
      await this.database.transaction(async (tx) => {
        const locked = await tx.execute(sql`
          select revision, rendition_media_asset_id
          from ${playerAvatarStates}
          where player_id = ${playerId}
          for update
        `);
        const state = locked[0] as
          { revision: number; rendition_media_asset_id: string } | undefined;
        if (
          !state ||
          state.revision !== input.expectedRevision ||
          state.rendition_media_asset_id !== current.rendition.id
        )
          throw revisionConflict();

        await this.activateAssets(tx as unknown as Database, playerId, [
          renditionId,
        ]);
        await tx
          .update(playerAvatarStates)
          .set({
            renditionMediaAssetId: renditionId,
            cropX: String(input.cropX),
            cropY: String(input.cropY),
            zoom: String(input.zoom),
            revision: input.expectedRevision + 1,
            updatedAt: new Date(),
          })
          .where(eq(playerAvatarStates.playerId, playerId));
        await tx
          .update(players)
          .set({ avatarMediaAssetId: renditionId, updatedAt: new Date() })
          .where(eq(players.id, playerId));
      });
    } catch (error) {
      await this.compensateAssets([
        { id: renditionId, storageKey: renditionKey },
      ]);
      throw error;
    }

    await this.retireAssets([current.rendition]);
    return projection({
      id: renditionId,
      version: 1,
      width: rendition.width,
      height: rendition.height,
    });
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
      if (!player.avatar_media_asset_id) return [];

      const assets = await this.currentAvatarAssets(
        tx as unknown as Database,
        playerId,
        player.avatar_media_asset_id,
      );
      if (assets.length === 0)
        throw new Error("Player avatar reference is inconsistent");

      await tx
        .delete(playerAvatarStates)
        .where(eq(playerAvatarStates.playerId, playerId));
      await tx
        .update(players)
        .set({ avatarMediaAssetId: null, updatedAt: new Date() })
        .where(eq(players.id, playerId));
      await tx
        .update(mediaAssets)
        .set({ status: "DELETED", updatedAt: new Date() })
        .where(
          inArray(
            mediaAssets.id,
            assets.map((asset) => asset.id),
          ),
        );
      return assets;
    });

    await this.deleteObjectsBestEffort(previous);
  }

  async content(assetId: string) {
    this.assertStorage();
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
    return this.deliver(asset);
  }

  async sourceContent(playerId: string) {
    this.assertStorage();
    const editable = await this.editableAvatar(playerId);
    if (!editable)
      throw new ApplicationError("media_not_found", "Media not found", 404);
    return this.deliver({
      storageKey: editable.source.storageKey,
      mimeType: editable.source.mimeType,
    });
  }

  private async editableAvatar(playerId: string) {
    const [row] = await this.database
      .select({
        revision: playerAvatarStates.revision,
        sourceId: mediaAssets.id,
        sourceKey: mediaAssets.storageKey,
        sourceMimeType: mediaAssets.mimeType,
        sourceWidth: mediaAssets.width,
        sourceHeight: mediaAssets.height,
        renditionId: playerAvatarStates.renditionMediaAssetId,
      })
      .from(playerAvatarStates)
      .innerJoin(
        mediaAssets,
        and(
          eq(mediaAssets.id, playerAvatarStates.sourceMediaAssetId),
          eq(mediaAssets.ownerPlayerId, playerId),
          eq(mediaAssets.purpose, "PLAYER_AVATAR_SOURCE"),
          eq(mediaAssets.status, "READY"),
        ),
      )
      .innerJoin(
        players,
        and(
          eq(players.id, playerAvatarStates.playerId),
          eq(
            players.avatarMediaAssetId,
            playerAvatarStates.renditionMediaAssetId,
          ),
        ),
      )
      .where(eq(playerAvatarStates.playerId, playerId))
      .limit(1);
    if (!row) return null;
    const [rendition] = await this.database
      .select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, row.renditionId),
          eq(mediaAssets.ownerPlayerId, playerId),
          eq(mediaAssets.purpose, "PLAYER_AVATAR"),
          eq(mediaAssets.status, "READY"),
        ),
      )
      .limit(1);
    return rendition
      ? {
          revision: row.revision,
          source: {
            id: row.sourceId,
            storageKey: row.sourceKey,
            mimeType: row.sourceMimeType,
            width: row.sourceWidth,
            height: row.sourceHeight,
          },
          rendition,
        }
      : null;
  }

  private async currentAvatarAssets(
    database: Database,
    playerId: string,
    renditionId: string | null,
  ): Promise<StoredAsset[]> {
    if (!renditionId) return [];
    const [state] = await database
      .select({
        sourceId: playerAvatarStates.sourceMediaAssetId,
        renditionId: playerAvatarStates.renditionMediaAssetId,
      })
      .from(playerAvatarStates)
      .where(eq(playerAvatarStates.playerId, playerId))
      .limit(1);
    const ids = state ? [state.sourceId, state.renditionId] : [renditionId];
    return database
      .select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.ownerPlayerId, playerId),
          inArray(mediaAssets.id, ids),
        ),
      );
  }

  private async activateAssets(
    database: Database,
    playerId: string,
    assetIds: string[],
  ) {
    const ready = await database
      .update(mediaAssets)
      .set({ status: "READY", updatedAt: new Date() })
      .where(
        and(
          eq(mediaAssets.ownerPlayerId, playerId),
          eq(mediaAssets.status, "PENDING"),
          inArray(mediaAssets.id, assetIds),
        ),
      )
      .returning({ id: mediaAssets.id });
    if (ready.length !== assetIds.length)
      throw new Error("Pending avatar assets disappeared before activation");
  }

  private async put(key: string, image: ProcessedImage) {
    await this.storage.putObject({
      key,
      body: image.body,
      contentType: image.mimeType,
    });
  }

  private async deliver(asset: { storageKey: string; mimeType: string }) {
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

  private assertStorage() {
    if (!this.storage.available)
      throw new ApplicationError(
        "media_feature_unavailable",
        "Avatar storage is not configured",
        503,
      );
  }

  private storageWriteError(error: unknown) {
    if (error instanceof StorageFeatureUnavailableError)
      return new ApplicationError(
        "media_feature_unavailable",
        "Avatar storage is not configured",
        503,
      );
    return new ApplicationError(
      "media_storage_unavailable",
      "Object storage could not persist the avatar",
      503,
      { cause: error instanceof Error ? error.name : "unknown" },
    );
  }

  private async retireAssets(assets: StoredAsset[]) {
    if (assets.length === 0) return;
    await this.database
      .update(mediaAssets)
      .set({ status: "DELETED", updatedAt: new Date() })
      .where(
        inArray(
          mediaAssets.id,
          assets.map((asset) => asset.id),
        ),
      );
    await this.deleteObjectsBestEffort(assets);
  }

  private async compensateAssets(assets: StoredAsset[]) {
    await this.database
      .update(mediaAssets)
      .set({ status: "DELETED", updatedAt: new Date() })
      .where(
        inArray(
          mediaAssets.id,
          assets.map((asset) => asset.id),
        ),
      );
    await this.deleteObjectsBestEffort(assets);
  }

  private async deleteObjectsBestEffort(assets: StoredAsset[]) {
    await Promise.all(
      assets.map((asset) => this.deleteObjectBestEffort(asset)),
    );
  }

  private async deleteObjectBestEffort(asset: StoredAsset) {
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

  private async getStoredObject(key: string) {
    try {
      const object = await this.storage.getObject(key);
      if (!object)
        throw new ApplicationError("media_not_found", "Media not found", 404);
      return object;
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw new ApplicationError(
        "media_storage_unavailable",
        "Object storage could not deliver the avatar source",
        503,
      );
    }
  }
}

function assetRow(
  id: string,
  playerId: string,
  purpose: "PLAYER_AVATAR" | "PLAYER_AVATAR_SOURCE",
  storageKey: string,
  image: ProcessedImage,
) {
  return {
    id,
    ownerPlayerId: playerId,
    purpose,
    storageKey,
    mimeType: image.mimeType,
    byteSize: image.body.byteLength,
    width: image.width,
    height: image.height,
    status: "PENDING" as const,
    version: 1,
  };
}

function revisionConflict() {
  return new ApplicationError(
    "avatar_revision_conflict",
    "El encuadre cambió en otra sesión. Recargá la foto antes de guardar.",
    409,
  );
}

async function streamToBuffer(
  stream: NodeJS.ReadableStream & AsyncIterable<Buffer | Uint8Array | string>,
) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
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
