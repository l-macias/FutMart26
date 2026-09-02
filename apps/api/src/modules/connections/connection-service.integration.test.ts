import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { and, eq, inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "@football/database";
import {
  authUser,
  groupMemberships,
  groups,
  notifications,
  playerConnections,
  playerPerformances,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { NotificationService } from "../notifications/notification-service.js";
import { ConnectionService } from "./connection-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;
const hasCode = (code: string) => (error: unknown) =>
  error instanceof ApplicationError && error.code === code;

void test(
  "bilateral connections enforce pair uniqueness, authority, pagination and notifications",
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
    const clock = () => new Date("2032-05-01T12:00:00.000Z");
    const notificationService = new NotificationService(connection.db, clock);
    const service = new ConnectionService(
      connection.db,
      notificationService,
      clock,
    );

    async function createPlayer(name: string) {
      const authUserId = randomUUID();
      const id = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        name,
        email: `${authUserId}@connections.test`,
      });
      await connection.db
        .insert(players)
        .values({ id, authUserId, displayName: name });
      return { id, name };
    }

    const a = await createPlayer("Connection A");
    const b = await createPlayer("Connection B");
    const c = await createPlayer("Connection C");
    const d = await createPlayer("Connection D");
    await connection.db.insert(playerPerformances).values({
      id: randomUUID(),
      playerId: b.id,
      discipline: "F5",
      internalOvr: "72.500000000000",
      processedMatchCount: 3,
      velocidad: "70",
      pase: "70",
      regate: "70",
      remate: "70",
      defensa: "70",
      fisico: "70",
    });

    await assert.rejects(
      () => service.request(a.id, a.id),
      hasCode("invalid_connection"),
    );
    await assert.rejects(
      () => service.request(a.id, randomUUID()),
      hasCode("player_not_found"),
    );
    assert.equal((await service.request(a.id, b.id)).state, "PENDING_SENT");
    assert.equal((await service.request(a.id, b.id)).state, "PENDING_SENT");
    assert.equal((await service.request(b.id, a.id)).state, "PENDING_RECEIVED");
    assert.equal((await service.status(b.id, a.id)).state, "PENDING_RECEIVED");
    await assert.rejects(
      () => service.accept(a.id, b.id),
      hasCode("connection_not_found"),
    );
    assert.equal((await service.accept(b.id, a.id)).state, "CONNECTED");
    assert.equal((await service.accept(b.id, a.id)).state, "CONNECTED");
    assert.equal((await service.status(a.id, b.id)).state, "CONNECTED");

    const pairCountRows = await connection.db
      .select({ count: sql<number>`count(*)::int` })
      .from(playerConnections)
      .where(orPair(a.id, b.id));
    assert.equal(pairCountRows[0]!.count, 1);
    const connectionNotifications = await connection.db
      .select({
        type: notifications.type,
        recipient: notifications.recipientPlayerId,
      })
      .from(notifications)
      .where(
        and(
          inArray(notifications.type, [
            "CONNECTION_REQUESTED",
            "CONNECTION_ACCEPTED",
          ]),
          inArray(notifications.recipientPlayerId, [a.id, b.id, c.id, d.id]),
        ),
      );
    assert.deepEqual(connectionNotifications.map((row) => row.type).sort(), [
      "CONNECTION_ACCEPTED",
      "CONNECTION_REQUESTED",
    ]);
    assert.equal(
      connectionNotifications.find((row) => row.type === "CONNECTION_REQUESTED")
        ?.recipient,
      b.id,
    );
    assert.equal(
      connectionNotifications.find((row) => row.type === "CONNECTION_ACCEPTED")
        ?.recipient,
      a.id,
    );

    assert.equal((await service.request(a.id, c.id)).state, "PENDING_SENT");
    assert.equal((await service.cancel(b.id, c.id)).state, "NONE");
    assert.equal((await service.reject(c.id, a.id)).state, "NONE");
    assert.equal((await service.status(a.id, c.id)).state, "NONE");
    assert.equal((await service.request(a.id, c.id)).state, "PENDING_SENT");
    assert.equal((await service.cancel(a.id, c.id)).state, "NONE");
    assert.equal((await service.cancel(a.id, c.id)).state, "NONE");
    await service.request(a.id, c.id);
    await service.accept(c.id, a.id);

    const crossed = await Promise.all([
      service.request(c.id, d.id),
      service.request(d.id, c.id),
    ]);
    assert.deepEqual(
      new Set(crossed.map((item) => item.state)),
      new Set(["PENDING_SENT", "PENDING_RECEIVED"]),
    );
    const accepted = await Promise.all([
      service.accept(
        crossed[0].state === "PENDING_RECEIVED" ? c.id : d.id,
        crossed[0].state === "PENDING_RECEIVED" ? d.id : c.id,
      ),
      service.accept(
        crossed[0].state === "PENDING_RECEIVED" ? c.id : d.id,
        crossed[0].state === "PENDING_RECEIVED" ? d.id : c.id,
      ),
    ]);
    assert.ok(accepted.every((item) => item.state === "CONNECTED"));

    const firstPage = await service.list(a.id, { limit: 1 });
    assert.equal(firstPage.items.length, 1);
    assert.ok(firstPage.nextCursor);
    const secondPage = await service.list(a.id, {
      limit: 1,
      cursor: firstPage.nextCursor,
    });
    assert.equal(secondPage.items.length, 1);
    const firstItem = firstPage.items[0];
    const secondItem = secondPage.items[0];
    assert.ok(firstItem);
    assert.ok(secondItem);
    assert.notEqual(secondItem.player.id, firstItem.player.id);
    const bItem = [...firstPage.items, ...secondPage.items].find(
      (item) => item.player.id === b.id,
    )!;
    assert.equal(bItem.overall, 72.5);
    assert.equal(bItem.processedMatchCount, 3);
    await assert.rejects(
      () => service.list(a.id, { limit: 1, cursor: "bad" }),
      hasCode("invalid_cursor"),
    );

    const groupId = randomUUID();
    await connection.db.insert(groups).values({
      id: groupId,
      name: "Connection Group",
      createdByPlayerId: a.id,
    });
    await connection.db.insert(groupMemberships).values([
      { id: randomUUID(), groupId, playerId: a.id, role: "OWNER" },
      { id: randomUUID(), groupId, playerId: b.id, role: "MEMBER" },
    ]);
    assert.equal((await service.remove(b.id, a.id)).state, "NONE");
    assert.equal((await service.remove(b.id, a.id)).state, "NONE");
    const memberships = await connection.db
      .select()
      .from(groupMemberships)
      .where(eq(groupMemberships.groupId, groupId));
    assert.equal(memberships.length, 2);

    await notificationService.reconcile(a.id);
    await notificationService.reconcile(a.id);
    const dedupedRows = await connection.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          inArray(notifications.type, [
            "CONNECTION_REQUESTED",
            "CONNECTION_ACCEPTED",
          ]),
          inArray(notifications.recipientPlayerId, [a.id, b.id, c.id, d.id]),
        ),
      );
    assert.equal(dedupedRows[0]!.count, 8);
  },
);

function orPair(first: string, second: string) {
  const low = first < second ? first : second;
  const high = first < second ? second : first;
  return and(
    eq(playerConnections.playerLowId, low),
    eq(playerConnections.playerHighId, high),
  );
}
