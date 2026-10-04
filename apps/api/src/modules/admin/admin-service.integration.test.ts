import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "@football/database";
import {
  abuseReports,
  accountSuspensions,
  adminAuditEvents,
  adminGrants,
  authSession,
  authUser,
  groupMemberships,
  groups,
  matches,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { PlayerMediaService } from "../media/player-media-service.js";
import { InMemoryStorageProvider } from "../media/storage-provider.js";
import { AdminService } from "./admin-service.js";

const url = process.env.TEST_DATABASE_URL;
const safeUrl =
  url && new URL(url).pathname.slice(1).endsWith("_test") ? url : undefined;

void test(
  "admin authority, suspension, reports and audit are account-scoped",
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
    const suffix = randomUUID();
    const adminId = `admin-${suffix}`;
    const userId = `user-${suffix}`;
    await connection.db.insert(authUser).values([
      {
        id: adminId,
        name: "Operator",
        email: `${adminId}@example.test`,
        emailVerified: true,
      },
      {
        id: userId,
        name: "Target",
        email: `${userId}@example.test`,
        emailVerified: true,
      },
    ]);
    const [target] = await connection.db
      .insert(players)
      .values({ id: randomUUID(), authUserId: userId, displayName: "Target" })
      .returning();
    const [reporter] = await connection.db
      .insert(players)
      .values({ id: randomUUID(), displayName: "Reporter" })
      .returning();
    await connection.db.insert(adminGrants).values({ authUserId: adminId });
    const now = new Date("2026-10-04T18:00:00.000Z");
    const service = new AdminService(
      connection.db,
      new PlayerMediaService(connection.db, new InMemoryStorageProvider()),
      () => now,
    );
    await assert.rejects(
      service.requireAdmin(userId),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "admin_required",
    );
    assert.equal((await service.requireAdmin(adminId)).role, "SUPERADMIN");
    await connection.db.insert(authSession).values({
      id: `session-${suffix}`,
      token: `token-${suffix}`,
      userId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await service.suspend(
      adminId,
      "request-suspend",
      target!.id,
      "Repeated abusive conduct",
    );
    assert.equal(await service.isSuspended(userId), true);
    assert.equal(
      (
        await connection.db
          .select()
          .from(authSession)
          .where(eq(authSession.userId, userId))
      ).length,
      0,
    );
    assert.equal(
      (
        await connection.db
          .select()
          .from(accountSuspensions)
          .where(eq(accountSuspensions.authUserId, userId))
      ).length,
      1,
    );
    await service.reactivate(
      adminId,
      "request-reactivate",
      target!.id,
      "Manual review completed",
    );
    assert.equal(await service.isSuspended(userId), false);
    const [report] = await connection.db
      .insert(abuseReports)
      .values({
        id: randomUUID(),
        reporterPlayerId: reporter!.id,
        targetType: "PLAYER",
        targetId: target!.id,
        reason: "OTHER",
      })
      .returning();
    await service.handleReport(
      adminId,
      "request-report",
      report!.id,
      "RESOLVED",
      {
        reason: "Evidence reviewed",
        resolutionNote: "Closed after operational review",
      },
    );
    assert.equal((await service.report(report!.id)).status, "RESOLVED");
    await service.moderatePlayerName(
      adminId,
      "request-name",
      target!.id,
      "Jugador moderado",
      "Unsafe public identity",
    );
    assert.equal(
      (
        await connection.db
          .select({ name: players.displayName })
          .from(players)
          .where(eq(players.id, target!.id))
      )[0]?.name,
      "Jugador moderado",
    );
    const events = await connection.db
      .select()
      .from(adminAuditEvents)
      .where(eq(adminAuditEvents.actorAuthUserId, adminId));
    assert.deepEqual(
      events.map((event) => event.action).sort(),
      [
        "ACCOUNT_REACTIVATED",
        "ACCOUNT_SUSPENDED",
        "PLAYER_NAME_MODERATED",
        "REPORT_RESOLVED",
      ].sort(),
    );
    assert.ok(
      events.every(
        (event) => event.reason.length >= 5 && event.requestId.length > 0,
      ),
    );
    const playerResults = await service.players({
      q: `${userId}@example.test`,
      limit: 1,
    });
    assert.equal(playerResults.length, 1);
    assert.equal(playerResults[0]?.id, target!.id);
    const overview = await service.overview();
    assert.equal(typeof overview.suspendedAccountCount, "number");
    assert.ok(overview.recentAudit.length <= 6);
    const filteredAudit = await service.auditEvents({
      actor: `${adminId}@example.test`,
      action: "SUSPENDED",
      targetType: "ACCOUNT",
      limit: 10,
    });
    assert.equal(filteredAudit.length, 1);
    assert.equal(filteredAudit[0]?.actorEmail, `${adminId}@example.test`);

    const groupName = `Admin phase ${suffix}`;
    const [group] = await connection.db
      .insert(groups)
      .values({
        id: randomUUID(),
        name: groupName,
        createdByPlayerId: target!.id,
      })
      .returning();
    await connection.db.insert(groupMemberships).values({
      id: randomUUID(),
      groupId: group!.id,
      playerId: target!.id,
      role: "OWNER",
    });
    const matchIds = {
      open: randomUUID(),
      current: randomUUID(),
      boundary: randomUUID(),
      expired: randomUUID(),
      cancelled: randomUUID(),
      finished: randomUUID(),
    };
    await connection.db.insert(matches).values([
      {
        id: matchIds.open,
        groupId: group!.id,
        status: "OPEN",
        scheduledAt: new Date(now.getTime() + 60 * 60_000),
        durationMinutes: 60,
        capacity: 10,
        locationText: "Future pitch",
        createdByPlayerId: target!.id,
      },
      {
        id: matchIds.current,
        groupId: group!.id,
        status: "STARTED",
        scheduledAt: new Date(now.getTime() - 30 * 60_000),
        durationMinutes: 60,
        capacity: 10,
        locationText: "Current pitch",
        createdByPlayerId: target!.id,
      },
      {
        id: matchIds.boundary,
        groupId: group!.id,
        status: "STARTED",
        scheduledAt: new Date(now.getTime() - 60 * 60_000),
        durationMinutes: 60,
        capacity: 10,
        locationText: "Boundary pitch",
        createdByPlayerId: target!.id,
      },
      {
        id: matchIds.expired,
        groupId: group!.id,
        status: "STARTED",
        scheduledAt: new Date(now.getTime() - 120 * 60_000),
        durationMinutes: 60,
        capacity: 10,
        locationText: "Expired pitch",
        createdByPlayerId: target!.id,
      },
      {
        id: matchIds.cancelled,
        groupId: group!.id,
        status: "CANCELLED",
        scheduledAt: new Date(now.getTime() - 120 * 60_000),
        durationMinutes: 60,
        capacity: 10,
        locationText: "Cancelled pitch",
        createdByPlayerId: target!.id,
      },
      {
        id: matchIds.finished,
        groupId: group!.id,
        status: "FINISHED",
        scheduledAt: new Date(now.getTime() - 120 * 60_000),
        durationMinutes: 60,
        capacity: 10,
        locationText: "Finished pitch",
        createdByPlayerId: target!.id,
      },
    ]);

    const adminMatches = await service.matches({ q: groupName, limit: 20 });
    const phaseById = new Map(
      adminMatches.map((match) => [match.id, match.effectivePhase]),
    );
    assert.equal(phaseById.get(matchIds.open), "OPEN");
    assert.equal(phaseById.get(matchIds.current), "IN_PROGRESS");
    assert.equal(phaseById.get(matchIds.boundary), "AWAITING_RESULT");
    assert.equal(phaseById.get(matchIds.expired), "AWAITING_RESULT");
    assert.equal(phaseById.get(matchIds.cancelled), "CANCELLED");
    assert.equal(phaseById.get(matchIds.finished), "FINISHED");

    const awaiting = await service.matches({
      q: groupName,
      effectivePhase: "AWAITING_RESULT",
      limit: 20,
    });
    assert.deepEqual(
      awaiting.map((match) => match.id).sort(),
      [matchIds.boundary, matchIds.expired].sort(),
    );
    assert.equal(
      (await service.match(matchIds.expired)).effectivePhase,
      "AWAITING_RESULT",
    );
    assert.equal(
      (await service.match(matchIds.current)).effectivePhase,
      "IN_PROGRESS",
    );
    assert.equal((await service.group(group!.id)).activeMatches, 2);
  },
);
