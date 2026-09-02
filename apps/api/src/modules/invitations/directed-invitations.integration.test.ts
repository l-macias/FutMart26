import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { and, eq, inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "@football/database";
import {
  authUser,
  groupConnectionInvitations,
  groupMemberships,
  groups,
  matchParticipants,
  matchPlayerInvitations,
  matches,
  notifications,
  playerConnections,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { InvitationService } from "../groups/invitation-service.js";
import { MatchInvitationService } from "../matches/match-invitation-service.js";
import { MatchService } from "../matches/match-service.js";
import { NotificationService } from "../notifications/notification-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;
const hasCode = (code: string) => (error: unknown) =>
  error instanceof ApplicationError && error.code === code;

void test(
  "directed Group and Match invitations preserve connection, membership and admission authority",
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

    const groupInvitations = new InvitationService(connection.db);
    const matchInvitations = new MatchInvitationService(connection.db);
    const matchService = new MatchService(connection.db);
    const notificationService = new NotificationService(connection.db);

    async function createPlayer(name: string) {
      const authUserId = randomUUID();
      const id = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        name,
        email: `${authUserId}@directed-invitations.test`,
      });
      await connection.db
        .insert(players)
        .values({ id, authUserId, displayName: name });
      return { id, name };
    }

    async function connect(first: string, second: string) {
      const [low, high] = first < second ? [first, second] : [second, first];
      await connection.db.insert(playerConnections).values({
        id: randomUUID(),
        playerLowId: low,
        playerHighId: high,
        requesterPlayerId: first,
        status: "ACCEPTED",
        acceptedAt: new Date(),
      });
    }

    async function addMembership(
      groupId: string,
      playerId: string,
      role: "OWNER" | "MEMBER" = "MEMBER",
      status: "ACTIVE" | "LEFT" | "BLOCKED" = "ACTIVE",
    ) {
      await connection.db.insert(groupMemberships).values({
        id: randomUUID(),
        groupId,
        playerId,
        role,
        status,
      });
    }

    const owner = await createPlayer("Directed owner");
    const rejoining = await createPlayer("Directed rejoining");
    const activeMember = await createPlayer("Directed active");
    const blocked = await createPlayer("Directed blocked");
    const outsider = await createPlayer("Directed outsider");
    const groupId = randomUUID();
    await connection.db.insert(groups).values({
      id: groupId,
      name: "Directed Group",
      createdByPlayerId: owner.id,
    });
    await addMembership(groupId, owner.id, "OWNER");
    await addMembership(groupId, rejoining.id, "MEMBER", "LEFT");
    await addMembership(groupId, activeMember.id);
    await addMembership(groupId, blocked.id, "MEMBER", "BLOCKED");
    await connect(owner.id, rejoining.id);
    await connect(owner.id, activeMember.id);
    await connect(owner.id, blocked.id);

    await assert.rejects(
      () => groupInvitations.createDirected(owner.id, groupId, owner.id),
      hasCode("invalid_invitation"),
    );
    await assert.rejects(
      () => groupInvitations.createDirected(owner.id, groupId, outsider.id),
      hasCode("connection_required"),
    );
    assert.equal(
      (
        await groupInvitations.createDirected(
          owner.id,
          groupId,
          activeMember.id,
        )
      ).outcome,
      "ALREADY_MEMBER",
    );
    await assert.rejects(
      () => groupInvitations.createDirected(owner.id, groupId, blocked.id),
      hasCode("member_blocked"),
    );

    const concurrentGroupInvites = await Promise.all([
      groupInvitations.createDirected(owner.id, groupId, rejoining.id),
      groupInvitations.createDirected(owner.id, groupId, rejoining.id),
    ]);
    assert.equal(concurrentGroupInvites[0].outcome, "INVITED");
    assert.equal(concurrentGroupInvites[1].outcome, "INVITED");
    assert.equal(
      concurrentGroupInvites[0].outcome === "INVITED" &&
        concurrentGroupInvites[1].outcome === "INVITED"
        ? concurrentGroupInvites[0].invitation.id
        : null,
      concurrentGroupInvites[1].outcome === "INVITED"
        ? concurrentGroupInvites[1].invitation.id
        : null,
    );
    const groupInvitationId =
      concurrentGroupInvites[0].outcome === "INVITED"
        ? concurrentGroupInvites[0].invitation.id
        : "";
    const managedGroupInvitations = await groupInvitations.listDirectedForGroup(
      owner.id,
      groupId,
    );
    assert.equal(
      managedGroupInvitations.some(
        (item) =>
          item.id === groupInvitationId &&
          item.invitedPlayer.id === rejoining.id &&
          item.status === "PENDING",
      ),
      true,
    );
    await assert.rejects(
      () => groupInvitations.listDirectedForGroup(activeMember.id, groupId),
      hasCode("forbidden"),
    );
    await assert.rejects(
      () => groupInvitations.acceptDirected(outsider.id, groupInvitationId),
      hasCode("invitation_not_available"),
    );

    // The connection is required to issue the invitation, not to accept it later.
    await connection.db
      .delete(playerConnections)
      .where(
        and(
          eq(
            playerConnections.playerLowId,
            owner.id < rejoining.id ? owner.id : rejoining.id,
          ),
          eq(
            playerConnections.playerHighId,
            owner.id < rejoining.id ? rejoining.id : owner.id,
          ),
        ),
      );
    const acceptedGroup = await Promise.all([
      groupInvitations.acceptDirected(rejoining.id, groupInvitationId),
      groupInvitations.acceptDirected(rejoining.id, groupInvitationId),
    ]);
    assert.deepEqual(
      new Set(acceptedGroup.map((result) => result.outcome)),
      new Set(["JOINED", "ALREADY_MEMBER"]),
    );
    const activeMemberships = await connection.db
      .select({ count: sql<number>`count(*)::int` })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.playerId, rejoining.id),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      );
    assert.equal(activeMemberships[0]!.count, 1);

    const rejectTarget = await createPlayer("Directed reject");
    await connect(owner.id, rejectTarget.id);
    const rejected = await groupInvitations.createDirected(
      owner.id,
      groupId,
      rejectTarget.id,
    );
    assert.equal(rejected.outcome, "INVITED");
    if (rejected.outcome === "INVITED")
      await groupInvitations.rejectDirected(
        rejectTarget.id,
        rejected.invitation.id,
      );

    const matchTargetA = await createPlayer("Directed match A");
    const matchTargetB = await createPlayer("Directed match B");
    const nonMember = await createPlayer("Directed match nonmember");
    for (const player of [matchTargetA, matchTargetB, nonMember])
      await connect(owner.id, player.id);
    await addMembership(groupId, matchTargetA.id);
    await addMembership(groupId, matchTargetB.id);

    const matchId = randomUUID();
    await connection.db.insert(matches).values({
      id: matchId,
      groupId,
      createdByPlayerId: owner.id,
      status: "OPEN",
      discipline: "F5",
      scheduledAt: new Date("2035-01-20T20:00:00.000Z"),
      durationMinutes: 60,
      capacity: 1,
      locationText: "Cancha dirigida",
      publishedAt: new Date(),
    });

    await assert.rejects(
      () => matchInvitations.create(owner.id, matchId, nonMember.id),
      hasCode("membership_required"),
    );
    await assert.rejects(
      () => matchInvitations.create(activeMember.id, matchId, matchTargetA.id),
      hasCode("forbidden"),
    );
    const firstInvite = await matchInvitations.create(
      owner.id,
      matchId,
      matchTargetA.id,
    );
    const repeatedInvite = await matchInvitations.create(
      owner.id,
      matchId,
      matchTargetA.id,
    );
    assert.equal(firstInvite.outcome, "INVITED");
    assert.equal(repeatedInvite.outcome, "INVITED");
    assert.equal(
      firstInvite.outcome === "INVITED" ? firstInvite.invitation.id : null,
      repeatedInvite.outcome === "INVITED"
        ? repeatedInvite.invitation.id
        : null,
    );
    const secondInvite = await matchInvitations.create(
      owner.id,
      matchId,
      matchTargetB.id,
    );
    assert.equal(secondInvite.outcome, "INVITED");
    const beforeAccept = await connection.db
      .select({ count: sql<number>`count(*)::int` })
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchId));
    assert.equal(beforeAccept[0]!.count, 0);

    if (firstInvite.outcome !== "INVITED" || secondInvite.outcome !== "INVITED")
      assert.fail("Expected pending Match invitations");
    await assert.rejects(
      () =>
        matchService.acceptInvitation(outsider.id, firstInvite.invitation.id),
      hasCode("invitation_not_available"),
    );
    const admission = await Promise.all([
      matchService.acceptInvitation(matchTargetA.id, firstInvite.invitation.id),
      matchService.acceptInvitation(
        matchTargetB.id,
        secondInvite.invitation.id,
      ),
    ]);
    assert.deepEqual(admission.map((result) => result.outcome).sort(), [
      "CONFIRMED",
      "WAITLISTED",
    ]);
    assert.deepEqual(admission.map((result) => result.admissionOrder).sort(), [
      "1",
      "2",
    ]);
    assert.deepEqual(
      await matchService.acceptInvitation(
        matchTargetA.id,
        firstInvite.invitation.id,
      ),
      admission[0],
    );

    const startedTarget = await createPlayer("Directed started target");
    await connect(owner.id, startedTarget.id);
    await addMembership(groupId, startedTarget.id);
    const startedMatchId = randomUUID();
    await connection.db.insert(matches).values({
      id: startedMatchId,
      groupId,
      createdByPlayerId: owner.id,
      status: "OPEN",
      discipline: "F5",
      scheduledAt: new Date("2035-01-21T20:00:00.000Z"),
      durationMinutes: 60,
      capacity: 12,
      locationText: "Cancha iniciada",
      publishedAt: new Date(),
    });
    const startedInvite = await matchInvitations.create(
      owner.id,
      startedMatchId,
      startedTarget.id,
    );
    assert.equal(startedInvite.outcome, "INVITED");
    await connection.db
      .update(matches)
      .set({ status: "STARTED", rosterLockedAt: new Date() })
      .where(eq(matches.id, startedMatchId));
    if (startedInvite.outcome === "INVITED")
      await assert.rejects(
        () =>
          matchService.acceptInvitation(
            startedTarget.id,
            startedInvite.invitation.id,
          ),
        hasCode("roster_locked"),
      );

    await notificationService.reconcile(rejoining.id);
    await notificationService.reconcile(rejoining.id);
    await notificationService.reconcile(matchTargetA.id);
    await notificationService.reconcile(matchTargetA.id);
    const receivedNotifications = await connection.db
      .select({
        type: notifications.type,
        recipient: notifications.recipientPlayerId,
      })
      .from(notifications)
      .where(
        and(
          inArray(notifications.type, [
            "GROUP_INVITATION_RECEIVED",
            "MATCH_INVITATION_RECEIVED",
          ]),
          inArray(notifications.recipientPlayerId, [
            rejoining.id,
            matchTargetA.id,
          ]),
        ),
      );
    assert.deepEqual(
      receivedNotifications.map((notification) => notification.type).sort(),
      ["GROUP_INVITATION_RECEIVED", "MATCH_INVITATION_RECEIVED"],
    );

    const invitationCounts = await Promise.all([
      connection.db
        .select({ count: sql<number>`count(*)::int` })
        .from(groupConnectionInvitations)
        .where(
          and(
            eq(groupConnectionInvitations.groupId, groupId),
            eq(groupConnectionInvitations.invitedPlayerId, rejoining.id),
          ),
        ),
      connection.db
        .select({ count: sql<number>`count(*)::int` })
        .from(matchPlayerInvitations)
        .where(
          and(
            eq(matchPlayerInvitations.matchId, matchId),
            eq(matchPlayerInvitations.invitedPlayerId, matchTargetA.id),
          ),
        ),
    ]);
    assert.equal(invitationCounts[0][0]!.count, 1);
    assert.equal(invitationCounts[1][0]!.count, 1);
  },
);
