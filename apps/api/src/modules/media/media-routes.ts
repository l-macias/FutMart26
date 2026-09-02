import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";

import { resolveAuthIdentity, type FootballAuth } from "@football/auth";
import {
  avatarCropSchema,
  mediaAssetParamsSchema,
  playerImageSchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
import { AVATAR_INPUT_MAX_BYTES } from "./avatar-image-processor.js";
import { PlayerMediaService } from "./player-media-service.js";
import { UploadRateLimiter } from "./upload-rate-limiter.js";

export function createMediaRoutes(
  auth: FootballAuth,
  players: PlayerService,
  media: PlayerMediaService,
  limiter = new UploadRateLimiter(),
): FastifyPluginAsync {
  return async (app) => {
    await app.register(multipart, {
      limits: {
        fileSize: AVATAR_INPUT_MAX_BYTES,
        files: 1,
        fields: 3,
        parts: 4,
      },
    });

    async function actor(request: { headers: NodeJS.Dict<string | string[]> }) {
      const identity = await resolveAuthIdentity(auth, request.headers);
      if (!identity)
        throw new ApplicationError(
          "unauthenticated",
          "Authentication required",
          401,
        );
      return players.provision(identity.authUserId, identity.displayName);
    }

    app.post("/me/player/avatar", async (request, reply) => {
      const player = await actor(request);
      const rateLimit = limiter.consume(`${player.id}:${request.ip}`);
      if (!rateLimit.allowed) {
        reply.header("retry-after", String(rateLimit.retryAfter));
        throw new ApplicationError(
          "media_rate_limited",
          "Too many avatar uploads",
          429,
        );
      }

      const fields: Record<string, string> = {};
      let file: { body: Buffer; claimedMimeType: string } | null = null;
      try {
        for await (const part of request.parts()) {
          if (part.type === "file") {
            if (file)
              throw new ApplicationError(
                "invalid_media_upload",
                "Only one avatar file is allowed",
                400,
              );
            const body = await part.toBuffer();
            if (part.file.truncated)
              throw new ApplicationError(
                "media_too_large",
                "Avatar exceeds the input byte limit",
                413,
              );
            file = { body, claimedMimeType: part.mimetype };
          } else {
            fields[part.fieldname] = String(part.value);
          }
        }
      } catch (error) {
        if (error instanceof ApplicationError) throw error;
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          String(error.code) === "FST_REQ_FILE_TOO_LARGE"
        )
          throw new ApplicationError(
            "media_too_large",
            "Avatar exceeds the input byte limit",
            413,
          );
        throw new ApplicationError(
          "invalid_media_upload",
          "Avatar multipart payload is invalid",
          400,
        );
      }
      if (!file)
        throw new ApplicationError(
          "invalid_media_upload",
          "Avatar file is required",
          400,
        );

      const crop = avatarCropSchema.parse(fields);
      return playerImageSchema.parse(
        await media.uploadAvatar(player.id, { ...file, crop }),
      );
    });

    app.delete("/me/player/avatar", async (request, reply) => {
      await media.removeAvatar((await actor(request)).id);
      return reply.status(204).send();
    });

    app.get("/media/:assetId/content", async (request, reply) => {
      await actor(request);
      const { assetId } = mediaAssetParamsSchema.parse(request.params);
      const content = await media.content(assetId);
      const etag = content.etag?.startsWith('"')
        ? content.etag
        : content.etag
          ? `"${content.etag}"`
          : null;
      if (etag && request.headers["if-none-match"] === etag)
        return reply.status(304).send();
      reply.header("cache-control", "private, max-age=31536000, immutable");
      reply.header("content-type", content.contentType);
      reply.header("content-length", String(content.contentLength));
      reply.header("content-disposition", "inline");
      reply.header("x-content-type-options", "nosniff");
      if (etag) reply.header("etag", etag);
      return reply.send(content.body);
    });
  };
}
