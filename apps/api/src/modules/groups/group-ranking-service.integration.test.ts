import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "@football/database";
import {
  authUser,
  groupMemberships,
  groups,
  playerPerformances,
  players,
} from "@football/database/schema";
import { ApplicationError } from "../errors.js";
import { GroupRankingService } from "./group-ranking-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;
const hasCode = (code: string) => (error: unknown) =>
  error instanceof ApplicationError && error.code === code;

void test(
  "Group F5 ranking is private, stable and keyset paginated",
  { skip: !safeUrl },
  async () => {
    const connection = createDatabase(safeUrl!);
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });
    const rankings = new GroupRankingService(connection.db);
    async function player(displayName: string) {
      const authUserId = randomUUID();
      const id = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        email: `${authUserId}@ranking.test`,
        name: displayName,
      });
      await connection.db
        .insert(players)
        .values({ id, authUserId, displayName });
      return id;
    }
    async function performance(
      playerId: string,
      overall: string,
      count: number,
    ) {
      await connection.db.insert(playerPerformances).values({
        id: randomUUID(),
        playerId,
        discipline: "F5",
        velocidad: "60",
        pase: "60",
        regate: "60",
        remate: "60",
        defensa: "60",
        fisico: "60",
        internalOvr: overall,
        processedMatchCount: count,
      });
    }
    const actor = await player("Actor");
    const high = await player("High");
    const tieMore = await player("Tie more");
    const tieFewer = await player("Tie fewer");
    const zero = await player("Zero");
    const left = await player("Left");
    const outsider = await player("Outsider");
    const groupId = randomUUID();
    await connection.db
      .insert(groups)
      .values({ id: groupId, name: "Ranking Test", createdByPlayerId: actor });
    await connection.db.insert(groupMemberships).values([
      { id: randomUUID(), groupId, playerId: actor, role: "OWNER" },
      { id: randomUUID(), groupId, playerId: high },
      { id: randomUUID(), groupId, playerId: tieMore },
      { id: randomUUID(), groupId, playerId: tieFewer },
      { id: randomUUID(), groupId, playerId: zero },
      {
        id: randomUUID(),
        groupId,
        playerId: left,
        status: "LEFT",
        endedAt: new Date(),
      },
    ]);
    await performance(actor, "75.000000000000", 2);
    await performance(high, "90.000000000000", 1);
    await performance(tieMore, "80.000000000000", 5);
    await performance(tieFewer, "80.000000000000", 3);
    await performance(zero, "99.000000000000", 0);
    await performance(left, "98.000000000000", 20);

    const first = await rankings.list(actor, groupId, { limit: 2 });
    assert.deepEqual(
      first.items.map((item) => [item.position, item.player.id]),
      [
        [1, high],
        [2, tieMore],
      ],
    );
    assert.deepEqual(first.me, {
      ranked: true,
      position: 4,
      overall: "75.000000000000",
      processedMatchCount: 2,
    });
    assert.ok(first.nextCursor);
    const second = await rankings.list(actor, groupId, {
      limit: 2,
      cursor: first.nextCursor,
    });
    assert.deepEqual(
      second.items.map((item) => [item.position, item.player.id]),
      [
        [3, tieFewer],
        [4, actor],
      ],
    );
    assert.equal(second.nextCursor, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((item) => item.player.id))
        .size,
      4,
    );
    await assert.rejects(
      rankings.list(actor, groupId, { limit: 20, cursor: "invalid" }),
      hasCode("invalid_cursor"),
    );
    await assert.rejects(
      rankings.list(outsider, groupId, { limit: 20 }),
      hasCode("forbidden"),
    );

    const otherGroup = randomUUID();
    await connection.db
      .insert(groups)
      .values({ id: otherGroup, name: "Other", createdByPlayerId: actor });
    await connection.db.insert(groupMemberships).values([
      { id: randomUUID(), groupId: otherGroup, playerId: actor, role: "OWNER" },
      { id: randomUUID(), groupId: otherGroup, playerId: high },
      { id: randomUUID(), groupId: otherGroup, playerId: zero },
    ]);
    const shared = await rankings.list(actor, otherGroup, { limit: 20 });
    assert.equal(
      shared.items.find((item) => item.player.id === high)?.performance.overall,
      "90.000000000000",
    );
    assert.equal(
      shared.items.some((item) => item.player.id === zero),
      false,
    );

    await connection.db
      .update(playerPerformances)
      .set({ internalOvr: "77.000000000000", processedMatchCount: 4 })
      .where(eq(playerPerformances.playerId, actor));
    await connection.db
      .update(playerPerformances)
      .set({ internalOvr: "77.000000000000", processedMatchCount: 4 })
      .where(eq(playerPerformances.playerId, high));
    const stableTie = await rankings.list(actor, otherGroup, { limit: 20 });
    assert.deepEqual(
      stableTie.items.map((item) => item.player.id),
      [actor, high].sort(),
    );

    await connection.db
      .update(playerPerformances)
      .set({ internalOvr: "95.000000000000" })
      .where(eq(playerPerformances.playerId, actor));
    assert.equal(
      (await rankings.list(actor, groupId, { limit: 20 })).items[0]?.player.id,
      actor,
    );

    const emptyGroup = randomUUID();
    await connection.db
      .insert(groups)
      .values({ id: emptyGroup, name: "Empty", createdByPlayerId: zero });
    await connection.db.insert(groupMemberships).values({
      id: randomUUID(),
      groupId: emptyGroup,
      playerId: zero,
      role: "OWNER",
    });
    assert.deepEqual(
      (await rankings.list(zero, emptyGroup, { limit: 20 })).me,
      { ranked: false },
    );
    await connection.client.end();
  },
);
