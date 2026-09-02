import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "@football/database";
import {
  authUser,
  groupGuests,
  groupMemberships,
  matchParticipants,
  matches as matchesTable,
  playerFootballPreferences,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { GroupService } from "../groups/group-service.js";
import { PlayerService } from "../identity/player-service.js";
import { MatchRecruitmentService } from "./match-recruitment-service.js";
import { MatchService } from "./match-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl &&
  new URL(databaseUrl).pathname.replace(/^\//, "").endsWith("_test")
    ? databaseUrl
    : undefined;

void test(
  "Match recruitment derives open spots and exposes private Group opportunities",
  { skip: !safeUrl },
  async () => {
    const connection = createDatabase(safeUrl!);
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });
    const players = new PlayerService(connection.db);
    const groups = new GroupService(connection.db);
    const recruitment = new MatchRecruitmentService(connection.db);
    const matches = new MatchService(connection.db, recruitment);

    async function player(name: string) {
      const authUserId = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        email: `${authUserId}@recruitment.test`,
        name,
      });
      return players.provision(authUserId, name);
    }

    async function member(groupId: string, playerId: string) {
      await connection.db.insert(groupMemberships).values({
        id: randomUUID(),
        groupId,
        playerId,
        role: "MEMBER",
      });
    }

    async function openMatch(
      ownerId: string,
      groupId: string,
      scheduledAt: Date,
      capacity = 12,
    ) {
      const match = await matches.create(ownerId, groupId, {
        discipline: "F5",
        scheduledAt,
        durationMinutes: 60,
        capacity,
        locationText: "Cancha recruitment",
      });
      await matches.publish(ownerId, match.id);
      return match;
    }

    const owner = await player("Recruitment owner");
    const candidate = await player("Recruitment keeper");
    const ordinary = await player("Recruitment field player");
    const outsider = await player("Recruitment outsider");
    const group = await groups.create(owner.id, `Recruitment ${randomUUID()}`);
    await member(group.id, candidate.id);
    await member(group.id, ordinary.id);
    await connection.db.insert(playerFootballPreferences).values({
      id: randomUUID(),
      playerId: candidate.id,
      discipline: "F5",
      preferredRoles: ["PORTERO"],
      willingToPlayGoalkeeper: true,
      strengths: [],
    });

    const match = await openMatch(
      owner.id,
      group.id,
      new Date("2028-01-10T23:00:00.000Z"),
      3,
    );
    await recruitment.replace(owner.id, match.id, {
      enabled: true,
      needs: [{ role: "PORTERO", quantity: 1 }],
    });
    const initial = await matches.get(candidate.id, match.id);
    assert.equal(initial.recruitment.effectiveStatus, "OPEN");
    assert.equal(initial.recruitment.openSpots, 3);

    await assert.rejects(
      recruitment.replace(candidate.id, match.id, { enabled: true, needs: [] }),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "forbidden",
    );
    await assert.rejects(
      recruitment.replace(owner.id, match.id, {
        enabled: true,
        needs: [
          { role: "MEDIO", quantity: 1 },
          { role: "MEDIO", quantity: 1 },
        ],
      }),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "invalid_recruitment",
    );
    await assert.rejects(
      recruitment.replace(owner.id, match.id, {
        enabled: true,
        needs: [{ role: "LIBRE", quantity: 0 }],
      }),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "invalid_recruitment",
    );
    await assert.rejects(
      recruitment.replace(owner.id, match.id, {
        enabled: true,
        needs: [{ role: "DEFENSIVO", quantity: 4 }],
      }),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "invalid_recruitment",
    );

    const confirmedPlayer = await player("Confirmed recruitment player");
    await member(group.id, confirmedPlayer.id);
    await matches.join(confirmedPlayer.id, match.id);
    const guestId = randomUUID();
    await connection.db.insert(groupGuests).values({
      id: guestId,
      groupId: group.id,
      displayName: "Recruitment Guest",
      normalizedDisplayName: `recruitment guest ${guestId}`,
      createdByPlayerId: owner.id,
    });
    const guest = await matches.addGuest(owner.id, match.id, guestId);
    assert.equal(guest.status, "CONFIRMED");
    assert.equal(
      (await matches.get(candidate.id, match.id)).recruitment.openSpots,
      1,
    );

    const waiting = await player("Waiting recruitment player");
    await member(group.id, waiting.id);
    const waitingParticipantId = randomUUID();
    await connection.db.insert(matchParticipants).values({
      id: waitingParticipantId,
      matchId: match.id,
      kind: "PLAYER",
      playerId: waiting.id,
      status: "WAITLISTED",
      admissionOrder: 99n,
    });
    assert.equal(
      (await matches.get(candidate.id, match.id)).recruitment.openSpots,
      1,
    );

    const opportunity = await recruitment.opportunities(candidate.id, {
      limit: 20,
    });
    assert.equal(
      opportunity.items.find((item) => item.matchId === match.id)
        ?.matchesMyProfile,
      true,
    );
    assert.equal(
      (await recruitment.opportunities(outsider.id, { limit: 20 })).items.some(
        (item) => item.matchId === match.id,
      ),
      false,
    );

    const joined = await matches.join(candidate.id, match.id);
    assert.equal(joined.status, "CONFIRMED");
    assert.equal(
      (await matches.get(candidate.id, match.id)).recruitment.effectiveStatus,
      "FULL",
    );
    assert.equal(
      (await recruitment.opportunities(ordinary.id, { limit: 20 })).items.some(
        (item) => item.matchId === match.id,
      ),
      false,
    );
    await connection.db
      .update(matchParticipants)
      .set({ status: "CANCELLED", cancelledAt: new Date() })
      .where(eq(matchParticipants.id, waitingParticipantId));
    await matches.leave(candidate.id, match.id);
    assert.equal(
      (await matches.get(ordinary.id, match.id)).recruitment.effectiveStatus,
      "OPEN",
    );

    await recruitment.replace(owner.id, match.id, {
      enabled: false,
      needs: [],
    });
    assert.equal(
      (await matches.get(ordinary.id, match.id)).recruitment.effectiveStatus,
      "CLOSED",
    );

    const first = await openMatch(
      owner.id,
      group.id,
      new Date("2028-02-01T20:00:00.000Z"),
    );
    const second = await openMatch(
      owner.id,
      group.id,
      new Date("2028-02-02T20:00:00.000Z"),
    );
    await recruitment.replace(owner.id, first.id, { enabled: true, needs: [] });
    await recruitment.replace(owner.id, second.id, {
      enabled: true,
      needs: [],
    });
    const firstPage = await recruitment.opportunities(ordinary.id, {
      limit: 1,
    });
    assert.equal(firstPage.items.length, 1);
    assert.ok(firstPage.nextCursor);
    const secondPage = await recruitment.opportunities(ordinary.id, {
      limit: 1,
      cursor: firstPage.nextCursor,
    });
    assert.equal(secondPage.items.length, 1);
    assert.notEqual(secondPage.items[0]?.matchId, firstPage.items[0]?.matchId);
    await assert.rejects(
      recruitment.opportunities(ordinary.id, { limit: 20, cursor: "invalid" }),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "invalid_cursor",
    );

    const race = await openMatch(
      owner.id,
      group.id,
      new Date("2028-03-01T20:00:00.000Z"),
      1,
    );
    await recruitment.replace(owner.id, race.id, { enabled: true, needs: [] });
    const racerA = await player("Recruitment racer A");
    const racerB = await player("Recruitment racer B");
    await member(group.id, racerA.id);
    await member(group.id, racerB.id);
    const raceResults = await Promise.all([
      matches.join(racerA.id, race.id),
      matches.join(racerB.id, race.id),
    ]);
    assert.equal(
      raceResults.filter((result) => result.status === "CONFIRMED").length,
      1,
    );
    assert.equal(
      raceResults.filter((result) => result.status === "WAITLISTED").length,
      1,
    );
    assert.equal(
      (await matches.get(owner.id, race.id)).recruitment.effectiveStatus,
      "FULL",
    );

    await connection.db
      .update(matchesTable)
      .set({ status: "STARTED" })
      .where(eq(matchesTable.id, second.id));
    await assert.rejects(
      recruitment.replace(owner.id, second.id, { enabled: false, needs: [] }),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "match_not_open",
    );

    await connection.client.end();
  },
);
