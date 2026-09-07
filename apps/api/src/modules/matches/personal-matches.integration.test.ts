import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "@football/database";
import { authUser } from "@football/database/schema";

import { GroupService } from "../groups/group-service.js";
import { PlayerService } from "../identity/player-service.js";
import { MatchService } from "./match-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeTestDatabaseUrl =
  databaseUrl &&
  new URL(databaseUrl).pathname.replace(/^\//, "").endsWith("_test")
    ? databaseUrl
    : undefined;

void test(
  "personal Match read model is bounded and does not require per-Group fan-out",
  { skip: !safeTestDatabaseUrl },
  async () => {
    const connection = createDatabase(safeTestDatabaseUrl!);
    try {
      await migrate(connection.db, {
        migrationsFolder: path.resolve(
          process.cwd(),
          "../../packages/database/drizzle",
        ),
      });
      const authUserId = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        email: `${authUserId}@personal-matches.test`,
        name: "Personal matches",
      });
      const player = await new PlayerService(connection.db).provision(
        authUserId,
        "Personal matches",
      );
      const groups = new GroupService(connection.db);
      const matches = new MatchService(connection.db);
      const first = await groups.create(player.id, `A-${randomUUID()}`);
      const second = await groups.create(player.id, `B-${randomUUID()}`);
      const draft = await matches.create(player.id, first.id, {
        discipline: "F5",
        scheduledAt: new Date(Date.now() + 86_400_000),
        durationMinutes: 60,
        capacity: 12,
        locationText: "Organizer draft",
      });
      const upcoming = await matches.create(player.id, first.id, {
        discipline: "F5",
        scheduledAt: new Date(Date.now() + 172_800_000),
        durationMinutes: 60,
        capacity: 12,
        locationText: "Future pitch",
      });
      await matches.publish(player.id, upcoming.id);
      await matches.join(player.id, upcoming.id);
      const unrelated = await matches.create(player.id, second.id, {
        discipline: "F5",
        scheduledAt: new Date(Date.now() + 259_200_000),
        durationMinutes: 60,
        capacity: 10,
        locationText: "Not my Match",
      });
      await matches.publish(player.id, unrelated.id);
      const cancelled = await matches.create(player.id, second.id, {
        discipline: "F5",
        scheduledAt: new Date(Date.now() - 86_400_000),
        durationMinutes: 50,
        capacity: 9,
        locationText: "Past pitch",
      });
      await matches.publish(player.id, cancelled.id);
      await matches.join(player.id, cancelled.id);
      await matches.cancel(player.id, cancelled.id);

      const read = await matches.listForPlayer(player.id, {
        upcomingLimit: 1,
        historyLimit: 1,
      });
      assert.equal(read.current, null);
      assert.equal(read.upcoming.length, 1);
      assert.equal(read.upcoming[0]?.id, upcoming.id);
      assert.equal(read.upcoming[0]?.group.id, first.id);
      assert.equal(read.upcoming[0]?.capacity, 12);
      assert.equal(read.upcoming[0]?.participation?.status, "CONFIRMED");
      assert.equal(read.history.length, 1);
      assert.equal(read.history[0]?.id, cancelled.id);
      assert.equal(read.history[0]?.group.id, second.id);
      assert.equal(read.history[0]?.status, "CANCELLED");
      assert.notEqual(read.upcoming[0]?.id, draft.id);
      assert.notEqual(read.upcoming[0]?.id, unrelated.id);
    } finally {
      await connection.close();
    }
  },
);
