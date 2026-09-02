import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import Fastify from "fastify";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import type { FootballAuth } from "@football/auth";
import {
  playerSearchQuerySchema,
  publicPlayerProfileSchema,
} from "@football/contracts";
import { createDatabase } from "@football/database";
import {
  authUser,
  groupGuests,
  groupMemberships,
  groups,
  matchAwards,
  matches,
  matchParticipants,
  matchParticipantStats,
  matchSportingResults,
  playerAchievements,
  playerFootballPreferences,
  playerPerformances,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { PlayerPerformanceReadService } from "../progression/player-performance-read-service.js";
import { RewardService } from "../rewards/reward-service.js";
import { FootballPreferencesService } from "./football-preferences-service.js";
import { PlayerService } from "./player-service.js";
import { createPublicPlayerRoutes } from "./public-player-routes.js";
import { PublicPlayerProfileService } from "./public-player-profile-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;

void test("Player discovery and public profile require authentication", async () => {
  const app = Fastify();
  const auth = {
    api: { getSession: () => Promise.resolve(null) },
  } as unknown as FootballAuth;
  await app.register(
    createPublicPlayerRoutes(
      auth,
      {} as PlayerService,
      {} as PublicPlayerProfileService,
    ),
  );
  assert.equal((await app.inject("/players/search?q=lu")).statusCode, 401);
  assert.equal(
    (await app.inject(`/players/${randomUUID()}/public-profile`)).statusCode,
    401,
  );
  await app.close();
});

void test(
  "Authenticated public Player projection and search expose only bounded sports data",
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
    const rewards = new RewardService(connection.db);
    const service = new PublicPlayerProfileService(
      connection.db,
      new PlayerPerformanceReadService(connection.db),
      new FootballPreferencesService(connection.db),
      rewards,
    );

    async function player(displayName: string) {
      const authUserId = randomUUID();
      const id = randomUUID();
      const email = `${authUserId}@public-profile.test`;
      await connection.db.insert(authUser).values({
        id: authUserId,
        email,
        name: displayName,
      });
      await connection.db
        .insert(players)
        .values({ id, authUserId, displayName });
      return { id, authUserId, email };
    }

    const actor = await player(`Viewer ${randomUUID()}`);
    const targetName = `LUCAS PUBLIC ${randomUUID()}`;
    const target = await player(targetName);
    const second = await player(`${targetName} B`);
    const newcomer = await player(`New ${randomUUID()}`);
    await connection.db.insert(playerPerformances).values({
      id: randomUUID(),
      playerId: target.id,
      discipline: "F5",
      velocidad: "71",
      pase: "72",
      regate: "73",
      remate: "74",
      defensa: "75",
      fisico: "76",
      internalOvr: "74.500000000000",
      processedMatchCount: 4,
    });
    await connection.db.insert(playerFootballPreferences).values({
      id: randomUUID(),
      playerId: target.id,
      discipline: "F5",
      preferredRoles: ["MEDIO", "DEFENSIVO"],
      willingToPlayGoalkeeper: true,
      strengths: ["PASE", "DEFENSA"],
    });
    const privateGroupId = randomUUID();
    await connection.db.insert(groups).values({
      id: privateGroupId,
      name: "Private Group Name",
      createdByPlayerId: target.id,
    });
    await connection.db.insert(groupMemberships).values({
      id: randomUUID(),
      groupId: privateGroupId,
      playerId: target.id,
      role: "OWNER",
    });
    const guestId = randomUUID();
    await connection.db.insert(groupGuests).values({
      id: guestId,
      groupId: privateGroupId,
      displayName: "Guest only",
      normalizedDisplayName: "guest only",
      createdByPlayerId: target.id,
    });

    async function matchAt(scheduledAt: Date) {
      const matchId = randomUUID();
      await connection.db.insert(matches).values({
        id: matchId,
        groupId: privateGroupId,
        discipline: "F5",
        status: "FINISHED",
        scheduledAt,
        durationMinutes: 60,
        capacity: 10,
        locationText: "Private venue",
        createdByPlayerId: target.id,
        rosterConfirmedAt: scheduledAt,
        rosterConfirmedByPlayerId: target.id,
      });
      return matchId;
    }

    const playedAt = new Date("2026-01-01T20:00:00.000Z");
    const playedMatchId = await matchAt(playedAt);
    const participantId = randomUUID();
    await connection.db.insert(matchParticipants).values({
      id: participantId,
      matchId: playedMatchId,
      kind: "PLAYER",
      playerId: target.id,
      status: "CONFIRMED",
      admissionOrder: 1n,
      confirmedAt: playedAt,
      attendance: "PLAYED",
      attendanceConfirmedAt: playedAt,
      attendanceConfirmedByPlayerId: target.id,
    });
    await connection.db.insert(matchSportingResults).values({
      id: randomUUID(),
      matchId: playedMatchId,
      status: "CONFIRMED",
      teamAGoals: 3,
      teamBGoals: 0,
      updatedByPlayerId: target.id,
      confirmedAt: playedAt,
      confirmedByPlayerId: target.id,
    });
    await connection.db.insert(matchParticipantStats).values({
      id: randomUUID(),
      matchId: playedMatchId,
      participantId,
      goals: 3,
      assists: 2,
      updatedByPlayerId: target.id,
    });
    await connection.db.insert(playerAchievements).values({
      id: randomUUID(),
      playerId: target.id,
      type: "FIRST_GOAL",
      sourceMatchId: playedMatchId,
      earnedAt: playedAt,
    });

    for (let index = 0; index < 6; index += 1) {
      const awardedAt = new Date(Date.UTC(2026, 1, index + 1, 20));
      const matchId = await matchAt(awardedAt);
      await connection.db.insert(matchAwards).values({
        id: randomUUID(),
        matchId,
        playerId: target.id,
        type: ["TOP_RATED", "TOP_SCORER", "TOP_ASSIST"][index % 3] as
          "TOP_RATED" | "TOP_SCORER" | "TOP_ASSIST",
        awardedAt,
      });
    }

    const profile = publicPlayerProfileSchema.parse(
      await service.get(actor.id, target.id),
    );
    assert.equal(profile.visibility, "PUBLIC");
    if (profile.visibility !== "PUBLIC")
      throw new Error("Expected public profile");
    assert.equal(profile.player.displayName, targetName);
    assert.equal(profile.performance.overall, 74.5);
    assert.equal(profile.performance.processedMatchCount, 4);
    assert.deepEqual(profile.footballProfile?.preferredRoles, [
      "MEDIO",
      "DEFENSIVO",
    ]);
    assert.equal(profile.summary.totalGoals, 3);
    assert.equal(profile.summary.totalAssists, 2);
    assert.equal(profile.summary.achievementCount, 1);
    assert.equal(profile.summary.awardCount, 6);
    assert.equal(profile.rewards.recentAwards.length, 5);
    assert.equal(profile.isCurrentPlayer, false);
    const serialized = JSON.stringify(profile);
    for (const secret of [
      target.authUserId,
      target.email,
      privateGroupId,
      "Private Group Name",
      playedMatchId,
    ])
      assert.equal(serialized.includes(secret), false);
    assert.deepEqual(Object.keys(profile.player).sort(), [
      "displayName",
      "id",
      "image",
    ]);
    assert.equal(profile.player.image, null);
    assert.equal(
      Object.hasOwn(profile.rewards.achievements[0]!, "sourceMatchId"),
      false,
    );
    assert.equal(
      Object.hasOwn(profile.rewards.recentAwards[0]!, "matchId"),
      false,
    );

    const newProfile = await service.get(actor.id, newcomer.id);
    if (newProfile.visibility !== "PUBLIC")
      throw new Error("Expected public profile");
    assert.equal(newProfile.performance.initialized, false);
    assert.equal(newProfile.performance.overall, 60);
    assert.equal(newProfile.performance.processedMatchCount, 0);
    assert.equal(newProfile.footballProfile, null);
    await assert.rejects(
      service.get(actor.id, guestId),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "player_not_found",
    );

    const search = await service.search(actor.id, {
      q: targetName.toLocaleLowerCase("es-AR"),
      limit: 10,
    });
    assert.deepEqual(
      search.items.map((item) => item.player.id),
      [target.id, second.id].sort((left, right) => {
        const names = new Map([
          [target.id, targetName.toLocaleLowerCase("es-AR")],
          [second.id, `${targetName} b`.toLocaleLowerCase("es-AR")],
        ]);
        return (
          names.get(left)!.localeCompare(names.get(right)!) ||
          left.localeCompare(right)
        );
      }),
    );
    assert.equal(search.items[0]?.performance.overall !== undefined, true);
    assert.equal(JSON.stringify(search).includes(target.email), false);
    assert.throws(() => playerSearchQuerySchema.parse({ q: "x" }));
    assert.throws(() =>
      playerSearchQuerySchema.parse({ q: "valid", limit: 21 }),
    );

    await connection.db
      .update(players)
      .set({ profileVisibility: "PRIVATE" })
      .where(eq(players.id, target.id));
    assert.deepEqual(await service.get(actor.id, target.id), {
      visibility: "PRIVATE",
      player: { id: target.id, displayName: targetName },
      isCurrentPlayer: false,
    });
    const hiddenSearch = await service.search(actor.id, {
      q: targetName,
      limit: 10,
    });
    assert.equal(
      hiddenSearch.items.some((item) => item.player.id === target.id),
      false,
    );
  },
);
