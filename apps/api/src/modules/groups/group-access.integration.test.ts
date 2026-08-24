import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { and, eq, inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "@football/database";
import {
  authUser,
  groupInvitationUsages,
  groupInvitations,
  groupMemberships,
  matchParticipants,
  playerFootballPreferences,
  playerPerformances,
} from "@football/database/schema";

import { GroupGuestService } from "./group-guest-service.js";
import { GroupService } from "./group-service.js";
import { InvitationService } from "./invitation-service.js";
import { FootballPreferencesService } from "../identity/football-preferences-service.js";
import { PlayerService } from "../identity/player-service.js";
import { MatchService } from "../matches/match-service.js";
import { MatchTeamService } from "../matches/match-team-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeTestDatabaseUrl = databaseUrl?.includes("_test")
  ? databaseUrl
  : undefined;

function code(expected: string) {
  return (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === expected;
}

void test(
  "Group invitations, F5 bootstrap and persistent Guest policy against PostgreSQL",
  { skip: !safeTestDatabaseUrl },
  async () => {
    const connection = createDatabase(safeTestDatabaseUrl!);
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });
    const players = new PlayerService(connection.db);
    const groups = new GroupService(connection.db);
    const invitations = new InvitationService(connection.db);
    const guests = new GroupGuestService(connection.db);
    const preferences = new FootballPreferencesService(connection.db);
    const matches = new MatchService(connection.db);
    const teams = new MatchTeamService(connection.db);

    async function player(label: string) {
      const authUserId = `slice7-${label}-${randomUUID()}`;
      await connection.db.insert(authUser).values({
        id: authUserId,
        name: label,
        email: `${authUserId}@example.test`,
      });
      return players.provision(authUserId, label);
    }

    const owner = await player("Owner");
    const candidateA = await player("Candidate A");
    const candidateB = await player("Candidate B");
    const candidateC = await player("Candidate C");
    const candidateD = await player("Candidate D");
    const group = await groups.create(owner.id, `Slice 7 ${randomUUID()}`);

    const single = await invitations.create(owner.id, group.id, {
      type: "SINGLE_USE",
    });
    assert.equal((await invitations.preview(single.token)).available, true);
    const singleRace = await Promise.allSettled([
      invitations.join(candidateA.id, single.token),
      invitations.join(candidateB.id, single.token),
    ]);
    assert.equal(
      singleRace.filter((item) => item.status === "fulfilled").length,
      1,
    );
    assert.equal(
      singleRace.filter((item) => item.status === "rejected").length,
      1,
    );
    assert.equal((await invitations.preview(single.token)).available, false);

    const timed = await invitations.create(owner.id, group.id, {
      type: "TIME_LIMITED",
      expiresAt: new Date(Date.now() + 60_000),
      maxUses: 1,
    });
    const timedRace = await Promise.allSettled([
      invitations.join(candidateC.id, timed.token),
      invitations.join(candidateD.id, timed.token),
    ]);
    assert.equal(
      timedRace.filter((item) => item.status === "fulfilled").length,
      1,
    );
    const [timedRow] = await connection.db
      .select()
      .from(groupInvitations)
      .where(eq(groupInvitations.id, timed.id));
    assert.equal(timedRow?.useCount, 1);
    assert.equal(
      await connection.db
        .select({ count: sql<number>`count(*)::int` })
        .from(groupInvitationUsages)
        .where(
          inArray(groupInvitationUsages.invitationId, [single.id, timed.id]),
        )
        .then((rows) => rows[0]?.count),
      2,
    );

    const activeMember = singleRace.find(
      (item) => item.status === "fulfilled",
    )!;
    const activePlayer =
      activeMember.status === "fulfilled" && activeMember.value.groupId
        ? singleRace[0]?.status === "fulfilled"
          ? candidateA
          : candidateB
        : candidateA;
    const reusable = await invitations.create(owner.id, group.id, {
      type: "TIME_LIMITED",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const beforeAlready = (
      await connection.db
        .select()
        .from(groupInvitations)
        .where(eq(groupInvitations.id, reusable.id))
    )[0]!;
    assert.equal(
      (await invitations.join(activePlayer.id, reusable.token)).outcome,
      "ALREADY_MEMBER",
    );
    const afterAlready = (
      await connection.db
        .select()
        .from(groupInvitations)
        .where(eq(groupInvitations.id, reusable.id))
    )[0]!;
    assert.equal(afterAlready.useCount, beforeAlready.useCount);

    await groups.block(owner.id, group.id, activePlayer.id);
    await assert.rejects(
      () => invitations.join(activePlayer.id, reusable.token),
      code("member_blocked"),
    );
    await groups.unblock(owner.id, group.id, activePlayer.id);
    assert.equal(
      (await invitations.join(activePlayer.id, reusable.token)).outcome,
      "JOINED",
    );

    const ownerInvite = await invitations.create(owner.id, group.id, {
      type: "SINGLE_USE",
    });
    const [moderatorMembership] = await connection.db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, group.id),
          eq(groupMemberships.playerId, activePlayer.id),
        ),
      );
    await connection.db
      .update(groupMemberships)
      .set({ role: "MODERATOR", capabilities: ["GROUP_MANAGE_INVITATIONS"] })
      .where(eq(groupMemberships.id, moderatorMembership!.id));
    await assert.rejects(
      () => invitations.revoke(activePlayer.id, group.id, ownerInvite.id),
      code("forbidden"),
    );
    await invitations.revoke(owner.id, group.id, ownerInvite.id);
    assert.equal(
      (await invitations.preview(ownerInvite.token)).available,
      false,
    );

    await preferences.put(owner.id, {
      preferredRoles: ["PORTERO", "MEDIO"],
      willingToPlayGoalkeeper: true,
      strengths: ["PASE", "DEFENSA", "FISICO"],
    });
    assert.deepEqual((await preferences.get(owner.id)).preferredRoles, [
      "PORTERO",
      "MEDIO",
    ]);
    assert.equal(
      await connection.db
        .select({ count: sql<number>`count(*)::int` })
        .from(playerPerformances)
        .where(eq(playerPerformances.playerId, owner.id))
        .then((rows) => rows[0]?.count),
      0,
    );
    await assert.rejects(
      () =>
        connection.db.insert(playerFootballPreferences).values({
          id: randomUUID(),
          playerId: candidateC.id,
          discipline: "F5",
          preferredRoles: ["PORTERO"],
          willingToPlayGoalkeeper: false,
          strengths: [],
        }),
      (error: unknown) => typeof error === "object" && error !== null,
    );

    const diego = await guests.create(owner.id, group.id, "  Diego   ");
    await assert.rejects(
      () => guests.create(owner.id, group.id, "diego"),
      code("guest_name_conflict"),
    );
    const diegoM = await guests.create(owner.id, group.id, "Diego M.");
    assert.notEqual(diego.id, diegoM.id);
    await guests.archive(owner.id, group.id, diego.id);
    await guests.restore(owner.id, group.id, diego.id);
    await guests.remove(owner.id, group.id, diegoM.id);
    await assert.rejects(
      () => guests.restore(owner.id, group.id, diegoM.id),
      code("guest_not_reusable"),
    );

    const match = await matches.create(owner.id, group.id, {
      discipline: "F5",
      scheduledAt: new Date(Date.now() + 3_600_000),
      durationMinutes: 60,
      capacity: 12,
      locationText: "Rosario",
    });
    await matches.publish(owner.id, match.id);
    const ownerAdmission = await matches.join(owner.id, match.id);
    const guestAdmission = await matches.addGuest(owner.id, match.id, diego.id);
    assert.equal(guestAdmission.status, "CONFIRMED");
    const historicalGuestId = guestAdmission.groupGuestId;
    await guests.archive(owner.id, group.id, diego.id);
    const [historical] = await connection.db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.id, guestAdmission.id));
    assert.equal(historical?.groupGuestId, historicalGuestId);
    assert.equal(historical?.guestDisplayName, "Diego");

    const admissions = [ownerAdmission, guestAdmission];
    for (let index = 0; index < 10; index += 1) {
      const teammate = await player(`Capacity ${index}`);
      await connection.db.insert(groupMemberships).values({
        id: randomUUID(),
        groupId: group.id,
        playerId: teammate.id,
        role: "MEMBER",
      });
      admissions.push(await matches.join(teammate.id, match.id));
    }
    assert.equal((await matches.roster(owner.id, match.id)).confirmedCount, 12);
    await teams.replace(
      owner.id,
      match.id,
      admissions.map((item, index) => ({
        participantId: item.id,
        side: index < 6 ? ("TEAM_A" as const) : ("TEAM_B" as const),
      })),
    );
    await matches.start(owner.id, match.id);
    const readTeams = await teams.get(owner.id, match.id);
    assert.equal(readTeams.TEAM_A.participants.length, 6);
    assert.equal(readTeams.TEAM_B.participants.length, 6);

    const otherGroup = await groups.create(
      candidateC.id,
      `Other ${randomUUID()}`,
    );
    const foreignGuest = await guests.create(
      candidateC.id,
      otherGroup.id,
      "Foreign",
    );
    const foreignMatch = await matches.create(owner.id, group.id, {
      discipline: "F5",
      scheduledAt: new Date(Date.now() + 7_200_000),
      durationMinutes: 60,
      capacity: 2,
      locationText: "Rosario",
    });
    await matches.publish(owner.id, foreignMatch.id);
    await assert.rejects(
      () => matches.addGuest(owner.id, foreignMatch.id, foreignGuest.id),
      code("guest_not_reusable"),
    );

    const memberForAllowance = await player("Allowance member");
    await connection.db.insert(groupMemberships).values({
      id: randomUUID(),
      groupId: group.id,
      playerId: memberForAllowance.id,
      role: "MEMBER",
    });
    const allowanceMatch = await matches.create(owner.id, group.id, {
      discipline: "F5",
      scheduledAt: new Date(Date.now() + 10_800_000),
      durationMinutes: 60,
      capacity: 1,
      locationText: "Rosario",
    });
    await matches.publish(owner.id, allowanceMatch.id);
    const ownGuestA = await guests.create(
      memberForAllowance.id,
      group.id,
      "Own A",
    );
    const ownGuestB = await guests.create(
      memberForAllowance.id,
      group.id,
      "Own B",
    );
    const allowanceRace = await Promise.allSettled([
      matches.addGuest(memberForAllowance.id, allowanceMatch.id, ownGuestA.id),
      matches.addGuest(memberForAllowance.id, allowanceMatch.id, ownGuestB.id),
    ]);
    assert.equal(
      allowanceRace.filter((item) => item.status === "fulfilled").length,
      1,
    );
    assert.equal(
      allowanceRace.filter((item) => item.status === "rejected").length,
      1,
    );
    const ownAdmission = allowanceRace.find(
      (
        item,
      ): item is PromiseFulfilledResult<
        Awaited<ReturnType<MatchService["addGuest"]>>
      > => item.status === "fulfilled",
    )!.value;
    await assert.rejects(
      () =>
        matches.cancelGuest(
          activePlayer.id,
          allowanceMatch.id,
          ownAdmission.id,
        ),
      code("forbidden"),
    );
    await matches.cancelGuest(
      memberForAllowance.id,
      allowanceMatch.id,
      ownAdmission.id,
    );
    await guests.updateAllowance(owner.id, group.id, memberForAllowance.id, 0);
    await assert.rejects(
      () =>
        matches.addGuest(
          memberForAllowance.id,
          allowanceMatch.id,
          ownGuestB.id,
        ),
      code("guest_allowance_exceeded"),
    );
    await guests.updateAllowance(owner.id, group.id, memberForAllowance.id, 2);
    const rejectedGuest =
      allowanceRace[0]?.status === "rejected" ? ownGuestA : ownGuestB;
    assert.equal(
      (
        await matches.addGuest(
          memberForAllowance.id,
          allowanceMatch.id,
          rejectedGuest.id,
        )
      ).status,
      "CONFIRMED",
    );
    await guests.updatePolicy(owner.id, group.id, { guestsEnabled: false });
    const disabledGuest = await guests.create(
      owner.id,
      group.id,
      "Disabled policy",
    );
    await assert.rejects(
      () => matches.addGuest(owner.id, allowanceMatch.id, disabledGuest.id),
      code("guest_policy_disabled"),
    );
    await guests.updatePolicy(owner.id, group.id, { guestsEnabled: true });

    await connection.client.end();
  },
);
