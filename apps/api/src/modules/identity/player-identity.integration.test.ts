import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import Fastify from "fastify";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { ZodError } from "zod";

import type { FootballAuth } from "@football/auth";
import {
  footballPreferencesRequestSchema,
  playerDisplayNameSchema,
  playerSchema,
  updatePlayerRequestSchema,
} from "@football/contracts";
import { createDatabase } from "@football/database";
import {
  authUser,
  groupMemberships,
  groups,
  playerPerformances,
  players,
  progressionSnapshots,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { GroupRankingService } from "../groups/group-ranking-service.js";
import { PlayerPerformanceReadService } from "../progression/player-performance-read-service.js";
import { RewardService } from "../rewards/reward-service.js";
import { FootballPreferencesService } from "./football-preferences-service.js";
import { createPlayerRoutes } from "./player-routes.js";
import { PlayerService } from "./player-service.js";
import { PublicPlayerProfileService } from "./public-player-profile-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;

void test("Player display name policy is narrow, Unicode-safe and strict", () => {
  assert.equal(playerDisplayNameSchema.parse("  Lucía   10  "), "Lucía 10");
  assert.equal(playerDisplayNameSchema.parse("李 雷"), "李 雷");
  assert.throws(() => playerDisplayNameSchema.parse(" "));
  assert.throws(() => playerDisplayNameSchema.parse("A"));
  assert.throws(() => playerDisplayNameSchema.parse("A".repeat(41)));
  assert.throws(() => playerDisplayNameSchema.parse("Lucas\nAdmin"));
  assert.throws(() =>
    updatePlayerRequestSchema.parse({ displayName: "Lucas", internalOvr: 99 }),
  );
  assert.throws(() =>
    updatePlayerRequestSchema.parse({
      displayName: "Lucas",
      authUserId: randomUUID(),
    }),
  );
});

void test(
  "Player identity stays actor-owned and projects the current name without rewriting performance",
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

    const actorAuthId = randomUUID();
    const otherAuthId = randomUUID();
    await connection.db.insert(authUser).values([
      {
        id: actorAuthId,
        email: `${actorAuthId}@identity.test`,
        name: "Auth original",
      },
      {
        id: otherAuthId,
        email: `${otherAuthId}@identity.test`,
        name: "Other auth",
      },
    ]);
    const playersService = new PlayerService(connection.db);
    const actor = await playersService.provision(actorAuthId, "Auth original");
    const other = await playersService.provision(otherAuthId, "Other auth");

    const auth = {
      api: {
        getSession: ({ headers }: { headers: Headers }) => {
          const authUserId = headers.get("x-test-auth-user");
          return Promise.resolve(
            authUserId
              ? {
                  user: {
                    id: authUserId,
                    name:
                      authUserId === actorAuthId
                        ? "Auth original"
                        : "Other auth",
                  },
                }
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
      return reply.status(status).send({ error: "request_failed" });
    });
    await app.register(createPlayerRoutes(auth, playersService));
    context.after(() => app.close());

    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: "/me/player",
          payload: { displayName: "Intruso", playerId: other.id },
          headers: { "x-test-auth-user": actorAuthId },
        })
      ).statusCode,
      400,
    );
    const response = await app.inject({
      method: "PATCH",
      url: "/me/player",
      payload: { displayName: "  Lucía   del 10  " },
      headers: { "x-test-auth-user": actorAuthId },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(
      playerSchema.parse(response.json()).displayName,
      "Lucía del 10",
    );
    assert.equal(
      (
        await connection.db
          .select({ displayName: players.displayName })
          .from(players)
          .where(eq(players.id, other.id))
      )[0]?.displayName,
      "Other auth",
    );
    assert.equal(
      (
        await connection.db
          .select({ name: authUser.name })
          .from(authUser)
          .where(eq(authUser.id, actorAuthId))
      )[0]?.name,
      "Auth original",
    );

    await connection.db.insert(playerPerformances).values({
      id: randomUUID(),
      playerId: actor.id,
      discipline: "F5",
      velocidad: "72",
      pase: "73",
      regate: "74",
      remate: "75",
      defensa: "76",
      fisico: "77",
      internalOvr: "75.500000000000",
      processedMatchCount: 3,
    });
    const groupId = randomUUID();
    await connection.db.insert(groups).values({
      id: groupId,
      name: "Identity group",
      createdByPlayerId: actor.id,
    });
    await connection.db.insert(groupMemberships).values({
      id: randomUUID(),
      groupId,
      playerId: actor.id,
      role: "OWNER",
    });

    const preferences = new FootballPreferencesService(connection.db);
    const performanceBefore = await connection.db
      .select()
      .from(playerPerformances)
      .where(eq(playerPerformances.playerId, actor.id));
    const snapshotsBefore = await connection.db
      .select({ count: sql<number>`count(*)::int` })
      .from(progressionSnapshots)
      .where(eq(progressionSnapshots.playerId, actor.id));
    const updatedPreferences = await preferences.put(actor.id, {
      preferredRoles: ["MEDIO", "PORTERO"],
      willingToPlayGoalkeeper: true,
      strengths: ["PASE", "REGATE", "REMATE"],
    });
    assert.deepEqual(updatedPreferences.preferredRoles, ["MEDIO", "PORTERO"]);
    assert.equal(updatedPreferences.willingToPlayGoalkeeper, true);
    assert.throws(() =>
      footballPreferencesRequestSchema.parse({
        preferredRoles: ["MEDIO"],
        willingToPlayGoalkeeper: false,
        strengths: ["PASE", "REGATE", "REMATE", "FISICO"],
      }),
    );
    assert.deepEqual(
      await connection.db
        .select()
        .from(playerPerformances)
        .where(eq(playerPerformances.playerId, actor.id)),
      performanceBefore,
    );
    assert.deepEqual(
      await connection.db
        .select({ count: sql<number>`count(*)::int` })
        .from(progressionSnapshots)
        .where(eq(progressionSnapshots.playerId, actor.id)),
      snapshotsBefore,
    );

    const publicProfiles = new PublicPlayerProfileService(
      connection.db,
      new PlayerPerformanceReadService(connection.db),
      preferences,
      new RewardService(connection.db),
    );
    assert.equal(
      (await publicProfiles.get(actor.id, actor.id)).player.displayName,
      "Lucía del 10",
    );
    assert.equal(
      (await publicProfiles.search(actor.id, { q: "lucía", limit: 10 }))
        .items[0]?.player.displayName,
      "Lucía del 10",
    );
    assert.equal(
      (
        await new GroupRankingService(connection.db).list(actor.id, groupId, {
          limit: 20,
        })
      ).items[0]?.player.displayName,
      "Lucía del 10",
    );

    const reprovisioned = await playersService.provision(
      actorAuthId,
      "Auth name changed later",
    );
    assert.equal(reprovisioned.displayName, "Lucía del 10");
    assert.equal(reprovisioned.id, actor.id);
  },
);
