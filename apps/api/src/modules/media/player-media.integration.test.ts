import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import Fastify from "fastify";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import sharp from "sharp";
import { ZodError } from "zod";

import type { FootballAuth } from "@football/auth";
import { playerImageSchema, playerWithImageSchema } from "@football/contracts";
import { createDatabase } from "@football/database";
import { authUser, mediaAssets, players } from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { FootballPreferencesService } from "../identity/football-preferences-service.js";
import { createPlayerRoutes } from "../identity/player-routes.js";
import { PlayerService } from "../identity/player-service.js";
import { PublicPlayerProfileService } from "../identity/public-player-profile-service.js";
import { PlayerPerformanceReadService } from "../progression/player-performance-read-service.js";
import { RewardService } from "../rewards/reward-service.js";
import {
  AVATAR_HEIGHT,
  AVATAR_INPUT_MAX_BYTES,
  AVATAR_WIDTH,
  processAvatar,
} from "./avatar-image-processor.js";
import { createMediaRoutes } from "./media-routes.js";
import { PlayerMediaService } from "./player-media-service.js";
import { InMemoryStorageProvider } from "./storage-provider.js";
import { UploadRateLimiter } from "./upload-rate-limiter.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;

void test("avatar processing validates real raster content and emits one sanitized rendition", async () => {
  const inputs = await Promise.all([
    raster("jpeg"),
    raster("png"),
    raster("webp"),
  ]);
  const mimeTypes = ["image/jpeg", "image/png", "image/webp"];
  for (const [index, body] of inputs.entries()) {
    const output = await processAvatar({
      body,
      claimedMimeType: mimeTypes[index]!,
      crop: { cropX: 0.35, cropY: 0.45, zoom: 1.2 },
    });
    const metadata = await sharp(output.body).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, AVATAR_WIDTH);
    assert.equal(metadata.height, AVATAR_HEIGHT);
    assert.equal(metadata.exif, undefined);
    assert.ok(output.body.byteLength < 500_000);
  }

  const oriented = await sharp({
    create: {
      width: 500,
      height: 900,
      channels: 3,
      background: "#223322",
    },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const normalized = await processAvatar({
    body: oriented,
    claimedMimeType: "image/jpeg",
    crop: { cropX: 0.5, cropY: 0.5, zoom: 1 },
  });
  assert.deepEqual(
    (await sharp(normalized.body).metadata()).orientation,
    undefined,
  );

  await rejectsWithCode(
    processAvatar({
      body: inputs[1],
      claimedMimeType: "image/jpeg",
      crop: { cropX: 0.5, cropY: 0.5, zoom: 1 },
    }),
    "media_format_not_allowed",
  );
  await rejectsWithCode(
    processAvatar({
      body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      claimedMimeType: "image/svg+xml",
      crop: { cropX: 0.5, cropY: 0.5, zoom: 1 },
    }),
    "media_format_not_allowed",
  );
  await rejectsWithCode(
    processAvatar({
      body: Buffer.from("not-an-image"),
      claimedMimeType: "image/jpeg",
      crop: { cropX: 0.5, cropY: 0.5, zoom: 1 },
    }),
    "media_processing_failed",
  );
  await rejectsWithCode(
    processAvatar({
      body: Buffer.alloc(AVATAR_INPUT_MAX_BYTES + 1),
      claimedMimeType: "image/jpeg",
      crop: { cropX: 0.5, cropY: 0.5, zoom: 1 },
    }),
    "media_too_large",
  );
});

void test("upload limiter is actor scoped and returns a bounded retry window", () => {
  let now = 1_000;
  const limiter = new UploadRateLimiter(2, 10_000, () => now);
  assert.deepEqual(limiter.consume("player-a"), { allowed: true });
  assert.deepEqual(limiter.consume("player-a"), { allowed: true });
  assert.deepEqual(limiter.consume("player-a"), {
    allowed: false,
    retryAfter: 10,
  });
  assert.deepEqual(limiter.consume("player-b"), { allowed: true });
  now += 10_001;
  assert.deepEqual(limiter.consume("player-a"), { allowed: true });
});

void test(
  "Player avatar ownership, replacement, delivery and cleanup remain coherent against PostgreSQL",
  { skip: !safeUrl },
  async (context) => {
    const connection = createDatabase(safeUrl!);
    context.after(() => connection.client.end());
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });

    const playerService = new PlayerService(connection.db);
    async function createPlayer(name: string) {
      const authUserId = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        email: `${authUserId}@media.test`,
        name,
      });
      const player = await playerService.provision(authUserId, name);
      return { ...player, authUserId };
    }
    const actor = await createPlayer("Avatar Owner");
    const other = await createPlayer("Other Player");
    const storage = new InMemoryStorageProvider();
    const media = new PlayerMediaService(connection.db, storage);

    assert.equal(await media.getPlayerImage(actor.id), null);
    assert.equal(
      (
        await connection.db
          .select({ avatar: players.avatarMediaAssetId })
          .from(players)
          .where(eq(players.id, actor.id))
      )[0]?.avatar,
      null,
    );

    const auth = {
      api: {
        getSession: ({ headers }: { headers: Headers }) => {
          const authUserId = headers.get("x-test-auth-user");
          const known = [actor, other].find(
            (candidate) => candidate.authUserId === authUserId,
          );
          return Promise.resolve(
            known
              ? { user: { id: known.authUserId, name: known.displayName } }
              : null,
          );
        },
      },
    } as unknown as FootballAuth;
    const app = Fastify();
    app.setErrorHandler((error, _request, reply) => {
      const status =
        error instanceof ApplicationError
          ? error.statusCode
          : error instanceof ZodError
            ? 400
            : 500;
      return reply.status(status).send({
        error:
          error instanceof ApplicationError ? error.code : "request_failed",
      });
    });
    await app.register(createPlayerRoutes(auth, playerService, media));
    await app.register(
      createMediaRoutes(auth, playerService, media, new UploadRateLimiter(20)),
    );
    context.after(() => app.close());

    assert.equal(
      (await app.inject(`/media/${randomUUID()}/content`)).statusCode,
      401,
    );
    const jpeg = await raster("jpeg");
    const upload = await app.inject({
      method: "POST",
      url: "/me/player/avatar",
      headers: {
        "x-test-auth-user": actor.authUserId,
        "content-type": "multipart/form-data; boundary=football-avatar",
      },
      payload: multipartPayload(jpeg, "image/jpeg"),
    });
    assert.equal(upload.statusCode, 200, upload.body);
    const first = playerImageSchema.parse(upload.json());
    assert.equal(first.width, AVATAR_WIDTH);
    assert.equal(first.height, AVATAR_HEIGHT);
    assert.ok(!JSON.stringify(first).includes("storageKey"));
    assert.ok(!JSON.stringify(first).includes("bucket"));

    const [firstAsset] = await connection.db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, first.assetId));
    assert.equal(firstAsset?.status, "READY");
    assert.equal(firstAsset?.ownerPlayerId, actor.id);
    assert.equal(firstAsset?.purpose, "PLAYER_AVATAR");
    assert.equal(firstAsset?.mimeType, "image/webp");
    assert.ok(
      firstAsset?.storageKey.startsWith(`player-avatar/${first.assetId}/`),
    );
    assert.ok(!firstAsset?.storageKey.includes(actor.displayName));

    const me = await app.inject({
      url: "/me/player",
      headers: { "x-test-auth-user": actor.authUserId },
    });
    assert.equal(
      playerWithImageSchema.parse(me.json()).image?.assetId,
      first.assetId,
    );
    const content = await app.inject({
      url: first.url,
      headers: { "x-test-auth-user": other.authUserId },
    });
    assert.equal(content.statusCode, 200);
    assert.equal(content.headers["content-type"], "image/webp");
    assert.match(content.headers["cache-control"] ?? "", /immutable/);
    assert.equal(content.headers["x-content-type-options"], "nosniff");
    assert.equal(
      (
        await app.inject({
          url: first.url,
          headers: {
            "x-test-auth-user": actor.authUserId,
            "if-none-match": content.headers.etag!,
          },
        })
      ).statusCode,
      304,
    );
    assert.equal(
      (
        await app.inject({
          url: "/media/not-a-uuid/content",
          headers: { "x-test-auth-user": actor.authUserId },
        })
      ).statusCode,
      400,
    );

    storage.failNextPut = true;
    await assert.rejects(
      media.uploadAvatar(actor.id, {
        body: jpeg,
        claimedMimeType: "image/jpeg",
        crop: { cropX: 0.5, cropY: 0.5, zoom: 1 },
      }),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "media_storage_unavailable",
    );
    assert.equal(
      (await media.getPlayerImage(actor.id))?.assetId,
      first.assetId,
    );

    const second = await media.uploadAvatar(actor.id, {
      body: await raster("png"),
      claimedMimeType: "image/png",
      crop: { cropX: 0.6, cropY: 0.4, zoom: 1.4 },
    });
    assert.notEqual(second.assetId, first.assetId);
    assert.equal(
      (await media.getPlayerImage(actor.id))?.assetId,
      second.assetId,
    );
    assert.equal(
      (
        await connection.db
          .select({ status: mediaAssets.status })
          .from(mediaAssets)
          .where(eq(mediaAssets.id, first.assetId))
      )[0]?.status,
      "DELETED",
    );
    assert.equal(storage.objects.has(firstAsset.storageKey), false);

    const publicProfiles = new PublicPlayerProfileService(
      connection.db,
      new PlayerPerformanceReadService(connection.db),
      new FootballPreferencesService(connection.db),
      new RewardService(connection.db),
      media,
    );
    const visibleProfile = await publicProfiles.get(other.id, actor.id);
    assert.equal(visibleProfile.visibility, "PUBLIC");
    if (visibleProfile.visibility !== "PUBLIC")
      throw new Error("Expected public profile");
    assert.equal(visibleProfile.player.image?.assetId, second.assetId);

    const objectCountBeforeDbFailure = storage.objects.size;
    const failingDatabase = new Proxy(connection.db, {
      get(target, property, receiver) {
        if (property === "transaction")
          return () =>
            Promise.reject(new Error("simulated activation failure"));
        const value = Reflect.get(target, property, receiver) as unknown;
        if (typeof value !== "function") return value;
        return (...arguments_: unknown[]) =>
          Reflect.apply(value, target, arguments_) as unknown;
      },
    });
    await assert.rejects(
      new PlayerMediaService(failingDatabase, storage).uploadAvatar(actor.id, {
        body: jpeg,
        claimedMimeType: "image/jpeg",
        crop: { cropX: 0.5, cropY: 0.5, zoom: 1 },
      }),
      /simulated activation failure/,
    );
    assert.equal(storage.objects.size, objectCountBeforeDbFailure);
    assert.equal(
      (await media.getPlayerImage(actor.id))?.assetId,
      second.assetId,
    );

    await media.removeAvatar(other.id);
    assert.equal(
      (await media.getPlayerImage(actor.id))?.assetId,
      second.assetId,
    );
    storage.failNextDelete = true;
    await media.removeAvatar(actor.id);
    assert.equal(await media.getPlayerImage(actor.id), null);
    assert.equal(
      (
        await connection.db
          .select({ status: mediaAssets.status })
          .from(mediaAssets)
          .where(eq(mediaAssets.id, second.assetId))
      )[0]?.status,
      "DELETED",
    );
    assert.equal(
      (
        await connection.db
          .select({ avatar: players.avatarMediaAssetId })
          .from(players)
          .where(eq(players.id, actor.id))
      )[0]?.avatar,
      null,
    );
    assert.equal(
      (
        await app.inject({
          url: `/media/${second.assetId}/content`,
          headers: { "x-test-auth-user": actor.authUserId },
        })
      ).statusCode,
      404,
    );

    const profileWithoutImage = await publicProfiles.get(other.id, actor.id);
    assert.equal(profileWithoutImage.visibility, "PUBLIC");
    if (profileWithoutImage.visibility !== "PUBLIC")
      throw new Error("Expected public profile");
    assert.equal(profileWithoutImage.player.image, null);
  },
);

async function raster(format: "jpeg" | "png" | "webp") {
  const pipeline = sharp({
    create: {
      width: 900,
      height: 1200,
      channels: 3,
      background: "#26442d",
    },
  });
  return format === "jpeg"
    ? pipeline.jpeg().toBuffer()
    : format === "png"
      ? pipeline.png().toBuffer()
      : pipeline.webp().toBuffer();
}

function multipartPayload(file: Buffer, mimeType: string) {
  return Buffer.concat([
    Buffer.from(
      [
        "--football-avatar",
        'Content-Disposition: form-data; name="cropX"',
        "",
        "0.5",
        "--football-avatar",
        'Content-Disposition: form-data; name="cropY"',
        "",
        "0.5",
        "--football-avatar",
        'Content-Disposition: form-data; name="zoom"',
        "",
        "1.2",
        "--football-avatar",
        'Content-Disposition: form-data; name="avatar"; filename="avatar.jpg"',
        `Content-Type: ${mimeType}`,
        "",
      ].join("\r\n") + "\r\n",
    ),
    file,
    Buffer.from("\r\n--football-avatar--\r\n"),
  ]);
}

async function rejectsWithCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(
    promise,
    (error: unknown) =>
      error instanceof ApplicationError && error.code === code,
  );
}
