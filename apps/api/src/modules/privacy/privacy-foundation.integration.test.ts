import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import type { FootballAuth } from "@football/auth";
import { createDatabase } from "@football/database";
import {
  abuseReports,
  authUser,
  groups,
  playerConnections,
  playerFootballPreferences,
  players,
  policyAcceptances,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { GroupService } from "../groups/group-service.js";
import { FootballPreferencesService } from "../identity/football-preferences-service.js";
import { PlayerService } from "../identity/player-service.js";
import { PublicPlayerProfileService } from "../identity/public-player-profile-service.js";
import { PlayerMediaService } from "../media/player-media-service.js";
import { InMemoryStorageProvider } from "../media/storage-provider.js";
import { AbuseReportService } from "./abuse-report-service.js";
import { AccountDeletionService } from "./account-deletion-service.js";
import { ageOn, ComplianceService } from "./compliance-service.js";
import { buildApp } from "../../app.js";
import { loadConfig } from "../../config.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;

void test("age calculation uses calendar boundaries", () => {
  const now = new Date("2026-09-01T12:00:00.000Z");
  assert.equal(ageOn("2008-09-01", now), 18);
  assert.equal(ageOn("2008-09-02", now), 17);
  assert.equal(ageOn("2008-08-31", now), 18);
});

void test(
  "privacy compliance, visibility, reports and anonymization preserve safe boundaries",
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
    const reporterAuthId = `privacy-reporter-${suffix}`;
    const targetAuthId = `privacy-target-${suffix}`;
    await connection.db.insert(authUser).values([
      {
        id: reporterAuthId,
        name: "Reporter",
        email: `${reporterAuthId}@example.test`,
        emailVerified: true,
      },
      {
        id: targetAuthId,
        name: "Target",
        email: `${targetAuthId}@example.test`,
        emailVerified: true,
      },
    ]);
    const playerService = new PlayerService(connection.db);
    const reporter = await playerService.provisionForCompliance(
      reporterAuthId,
      "Reporter",
    );
    const target = await playerService.provisionForCompliance(
      targetAuthId,
      "Target",
    );
    const now = new Date("2026-09-01T12:00:00.000Z");
    const compliance = new ComplianceService(connection.db, () => now);
    assert.equal(
      (await compliance.status(reporterAuthId, reporter.id)).state,
      "MISSING_DATE_OF_BIRTH",
    );
    const gatedApp = buildApp(
      loadConfig({
        DATABASE_URL: safeUrl!,
        WEB_URL: "http://localhost:3000",
        ADMIN_URL: "http://localhost:3001",
        BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
        BETTER_AUTH_URL: "http://localhost:4000",
        SUPPORT_EMAIL: "support@example.test",
        API_HOST: "127.0.0.1",
        API_PORT: "4000",
        LOG_LEVEL: "silent",
        NODE_ENV: "test",
        OBJECT_STORAGE_ENABLED: "false",
        OBJECT_STORAGE_REGION: "us-east-1",
        OBJECT_STORAGE_FORCE_PATH_STYLE: "true",
      }),
      {
        database: connection.db,
        storage: new InMemoryStorageProvider(),
        auth: {
          api: {
            getSession: () =>
              Promise.resolve({
                user: { id: reporterAuthId, name: "Reporter" },
              }),
          },
          handler: () => Promise.resolve(new Response(null, { status: 404 })),
        } as unknown as FootballAuth,
      },
    );
    assert.equal((await gatedApp.inject("/groups")).statusCode, 403);
    assert.equal((await gatedApp.inject("/me/compliance")).statusCode, 200);
    await gatedApp.close();
    await assert.rejects(
      compliance.complete(reporterAuthId, reporter.id, {
        dateOfBirth: "2008-09-02",
        acceptTerms: true,
        acceptPrivacy: true,
      }),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "underage",
    );
    const accepted = await compliance.complete(reporterAuthId, reporter.id, {
      dateOfBirth: "2008-09-01",
      acceptTerms: true,
      acceptPrivacy: true,
    });
    assert.equal(accepted.state, "FOOTBALL_PROFILE_REQUIRED");
    assert.equal(accepted.age, 18);
    assert.equal(
      (
        await connection.db
          .select()
          .from(policyAcceptances)
          .where(eq(policyAcceptances.authUserId, reporterAuthId))
      ).length,
      2,
    );
    await assert.rejects(
      compliance.complete(reporterAuthId, reporter.id, {
        dateOfBirth: "1990-01-01",
        acceptTerms: true,
        acceptPrivacy: true,
      }),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "date_of_birth_locked",
    );
    await new FootballPreferencesService(connection.db).put(reporter.id, {
      preferredRoles: ["MEDIO"],
      willingToPlayGoalkeeper: false,
      strengths: ["PASE"],
    });
    assert.equal(
      (await compliance.status(reporterAuthId, reporter.id)).state,
      "READY",
    );
    await compliance.setPlayerVisibility(reporter.id, "PRIVATE");
    assert.equal(
      (await compliance.privateIdentity(reporter.id)).profileVisibility,
      "PRIVATE",
    );

    const groupService = new GroupService(connection.db);
    const group = await groupService.create(
      reporter.id,
      `Privacy group ${suffix}`,
    );
    await groupService.setVisibility(reporter.id, group.id, "PRIVATE");
    assert.equal(
      (
        await connection.db
          .select({ visibility: groups.visibility })
          .from(groups)
          .where(eq(groups.id, group.id))
      )[0]?.visibility,
      "PRIVATE",
    );

    const report = await new AbuseReportService(connection.db).create(
      reporter.id,
      {
        targetType: "PLAYER",
        targetId: target.id,
        reason: "HARASSMENT",
        comment: "Conducta reportada",
      },
    );
    assert.equal(report.status, "OPEN");
    assert.equal(
      (
        await connection.db
          .select()
          .from(abuseReports)
          .where(eq(abuseReports.id, report.id))
      ).length,
      1,
    );
    await assert.rejects(
      new AbuseReportService(connection.db).create(reporter.id, {
        targetType: "PLAYER",
        targetId: reporter.id,
        reason: "OTHER",
      }),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "invalid_report_target",
    );

    const [low, high] = [reporter.id, target.id].sort();
    await connection.db.insert(playerConnections).values({
      id: randomUUID(),
      playerLowId: low!,
      playerHighId: high!,
      requesterPlayerId: reporter.id,
      status: "ACCEPTED",
      acceptedAt: now,
    });
    const deletion = new AccountDeletionService(
      connection.db,
      groupService,
      new PlayerMediaService(connection.db, new InMemoryStorageProvider()),
    );
    await deletion.anonymizeBeforeAuthDeletion(reporterAuthId);
    const [anonymized] = await connection.db
      .select()
      .from(players)
      .where(eq(players.id, reporter.id));
    assert.equal(anonymized?.displayName, "Jugador eliminado");
    assert.equal(anonymized?.accountStatus, "ANONYMIZED");
    assert.equal(anonymized?.profileVisibility, "PRIVATE");
    assert.equal(anonymized?.dateOfBirth, null);
    await assert.rejects(
      new PublicPlayerProfileService(
        connection.db,
        {} as never,
        {} as never,
        {} as never,
      ).get(target.id, reporter.id),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "player_not_found",
    );
    assert.equal(
      (
        await connection.db
          .select()
          .from(playerConnections)
          .where(eq(playerConnections.playerLowId, low!))
      ).length,
      0,
    );
    assert.equal(
      (
        await connection.db
          .select()
          .from(playerFootballPreferences)
          .where(eq(playerFootballPreferences.playerId, reporter.id))
      ).length,
      0,
    );
    await connection.db.delete(authUser).where(eq(authUser.id, reporterAuthId));
    const [detached] = await connection.db
      .select()
      .from(players)
      .where(eq(players.id, reporter.id));
    assert.equal(detached?.authUserId, null);
    assert.equal(
      (
        await connection.db
          .select()
          .from(policyAcceptances)
          .where(eq(policyAcceptances.authUserId, reporterAuthId))
      ).length,
      0,
    );
  },
);
