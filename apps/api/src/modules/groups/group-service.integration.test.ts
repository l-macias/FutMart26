import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDrizzleAuth, resolveAuthIdentity } from "@football/auth";
import { updateGroupRequestSchema } from "@football/contracts";
import { createDatabase } from "@football/database";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
  groupMemberships,
  groups,
  matchSportingResults,
  matches,
} from "@football/database/schema";
import { ApplicationError } from "../errors.js";
import { DiscoveryService } from "../discovery/discovery-service.js";
import { FootballPreferencesService } from "../identity/football-preferences-service.js";
import { PlayerService } from "../identity/player-service.js";
import { PublicPlayerProfileService } from "../identity/public-player-profile-service.js";
import { PlayerPerformanceReadService } from "../progression/player-performance-read-service.js";
import { RewardService } from "../rewards/reward-service.js";
import { GroupService } from "./group-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeTestDatabaseUrl =
  databaseUrl &&
  new URL(databaseUrl).pathname.replace(/^\//, "").endsWith("_test")
    ? databaseUrl
    : undefined;

function isUniqueConstraint(error: unknown, constraint: string) {
  if (typeof error !== "object" || error === null || !("cause" in error))
    return false;
  const cause = error.cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    "constraint_name" in cause &&
    cause.constraint_name === constraint
  );
}

void test(
  "Player and Group invariants against PostgreSQL",
  { skip: !safeTestDatabaseUrl },
  async () => {
    const connection = createDatabase(safeTestDatabaseUrl!);
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });

    const catalogTables = await connection.client.unsafe<
      { tablename: string }[]
    >(
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    );
    assert.deepEqual(
      catalogTables.map((row) => row.tablename),
      [
        "abuse_reports",
        "account_suspensions",
        "admin_audit_events",
        "admin_grants",
        "auth_account",
        "auth_session",
        "auth_user",
        "auth_verification",
        "evaluation_evidence",
        "group_connection_invitations",
        "group_guests",
        "group_invitation_usages",
        "group_invitations",
        "group_match_defaults",
        "group_memberships",
        "group_role_changes",
        "groups",
        "match_awards",
        "match_participant_stats",
        "match_participants",
        "match_player_invitations",
        "match_recruitment_needs",
        "match_schedule_changes",
        "match_sporting_results",
        "match_team_assignments",
        "matches",
        "media_assets",
        "notifications",
        "player_achievements",
        "player_connections",
        "player_evaluations",
        "player_football_preferences",
        "player_performances",
        "players",
        "policy_acceptances",
        "progression_config_versions",
        "progression_snapshots",
        "venue_courts",
        "venues",
        "voting_ballots",
        "voting_sessions",
      ],
    );
    const catalogIndexes = await connection.client.unsafe<
      { indexname: string; indexdef: string }[]
    >("select indexname, indexdef from pg_indexes where schemaname = 'public'");
    const indexDefinition = (name: string) =>
      catalogIndexes.find((index) => index.indexname === name)?.indexdef ?? "";
    assert.match(
      indexDefinition("group_memberships_active_owner_uq"),
      /UNIQUE INDEX.+\(group_id\).+WHERE.+status.+ACTIVE.+role.+OWNER/i,
    );
    assert.match(
      indexDefinition("group_memberships_active_player_uq"),
      /UNIQUE INDEX.+\(group_id, player_id\).+WHERE.+status.+ACTIVE/i,
    );
    for (const index of [
      "players_auth_user_id_unique",
      "group_memberships_player_status_idx",
      "group_memberships_group_status_joined_idx",
      "group_role_changes_group_time_idx",
      "groups_created_by_idx",
    ]) {
      assert.ok(indexDefinition(index), `Missing index ${index}`);
    }
    const primaryKeys = await connection.client.unsafe<{ count: string }[]>(
      "select count(*)::text as count from pg_constraint where contype = 'p' and connamespace = 'public'::regnamespace",
    );
    assert.equal(primaryKeys[0]?.count, "41");
    const foreignKeys = await connection.client.unsafe<
      { conname: string; definition: string }[]
    >(
      "select conname, pg_get_constraintdef(oid) as definition from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace",
    );
    for (const foreignKey of foreignKeys.filter(
      (row) =>
        !row.conname.startsWith("auth_") &&
        row.conname !== "policy_acceptances_auth_user_id_auth_user_id_fk" &&
        row.conname !== "players_auth_user_id_auth_user_id_fk",
    )) {
      assert.match(foreignKey.definition, /ON DELETE RESTRICT/);
    }
    const criticalColumns = await connection.client.unsafe<
      { table_name: string; column_name: string; is_nullable: string }[]
    >(
      "select table_name, column_name, is_nullable from information_schema.columns where table_schema = 'public' and ((table_name = 'players' and column_name = 'auth_user_id') or (table_name = 'auth_account' and column_name = 'issuer') or (table_name = 'group_memberships' and column_name in ('status', 'role', 'joined_at', 'role_granted_at'))) order by table_name, column_name",
    );
    assert.equal(criticalColumns.length, 6);
    assert.equal(
      criticalColumns.find((column) => column.column_name === "auth_user_id")
        ?.is_nullable,
      "YES",
    );
    assert.equal(
      criticalColumns.find((column) => column.column_name === "issuer")
        ?.is_nullable,
      "YES",
    );
    const enumValues = await connection.client.unsafe<
      { enum_name: string; enum_value: string }[]
    >(
      "select t.typname as enum_name, e.enumlabel as enum_value from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typname in ('group_status', 'membership_role', 'membership_status') order by t.typname, e.enumsortorder",
    );
    assert.deepEqual(Array.from(enumValues), [
      { enum_name: "group_status", enum_value: "ACTIVE" },
      { enum_name: "group_status", enum_value: "ARCHIVED" },
      { enum_name: "membership_role", enum_value: "OWNER" },
      { enum_name: "membership_role", enum_value: "MODERATOR" },
      { enum_name: "membership_role", enum_value: "MEMBER" },
      { enum_name: "membership_status", enum_value: "ACTIVE" },
      { enum_name: "membership_status", enum_value: "LEFT" },
      { enum_name: "membership_status", enum_value: "REMOVED" },
      { enum_name: "membership_status", enum_value: "BLOCKED" },
    ]);

    async function seedPlayer(name: string) {
      const authUserId = randomUUID();
      await connection.db
        .insert(authUser)
        .values({ id: authUserId, email: `${authUserId}@test.local`, name });
      return new PlayerService(connection.db).provision(authUserId, name);
    }
    async function addMember(
      groupId: string,
      playerId: string,
      role: "OWNER" | "MODERATOR" | "MEMBER" = "MEMBER",
      roleGrantedAt = new Date(),
      joinedAt = new Date(),
    ) {
      await connection.db.insert(groupMemberships).values({
        id: randomUUID(),
        groupId,
        playerId,
        role,
        roleGrantedAt,
        joinedAt,
        capabilities: role === "MODERATOR" ? ["GROUP_MANAGE_MEMBERS"] : [],
      });
    }

    const authId = randomUUID();
    await connection.db
      .insert(authUser)
      .values({ id: authId, email: `${authId}@test.local`, name: "Owner" });
    const playerService = new PlayerService(connection.db);
    const concurrent = await Promise.all(
      Array.from({ length: 8 }, () => playerService.provision(authId, "Owner")),
    );
    assert.equal(new Set(concurrent.map((player) => player.id)).size, 1);
    const persistedPlayers = await connection.db.query.players.findMany({
      where: (table, operators) => operators.eq(table.authUserId, authId),
    });
    assert.equal(persistedPlayers.length, 1);

    const auth = createDrizzleAuth(
      connection.db,
      {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
      },
      {
        BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
        BETTER_AUTH_URL: "http://localhost:4000",
        WEB_URL: "http://localhost:3000",
        ADMIN_URL: "http://localhost:3001",
      },
    );
    const authEmail = `${randomUUID()}@test.local`;
    const signUpResponse = await auth.handler(
      new Request("http://localhost:4000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: authEmail,
          name: "Authenticated player",
          password: "test-password-123",
        }),
      }),
    );
    assert.equal(signUpResponse.status, 200);
    const sessionCookie = signUpResponse.headers
      .get("set-cookie")
      ?.split(";")[0];
    assert.ok(sessionCookie);
    const freshSessionResponse = await auth.handler(
      new Request("http://localhost:4000/api/auth/get-session", {
        headers: { cookie: sessionCookie },
      }),
    );
    assert.equal(freshSessionResponse.status, 200);
    const freshSession = (await freshSessionResponse.json()) as {
      user?: { id?: string };
    };
    assert.ok(freshSession.user?.id);
    const identity = await resolveAuthIdentity(auth, { cookie: sessionCookie });
    assert.ok(identity);
    const authenticatedPlayer = await playerService.provision(
      identity.authUserId,
      identity.displayName,
    );
    assert.equal(authenticatedPlayer.authUserId, identity.authUserId);

    const signOutResponse = await auth.handler(
      new Request("http://localhost:4000/api/auth/sign-out", {
        method: "POST",
        headers: {
          cookie: sessionCookie,
          origin: "http://localhost:3000",
        },
      }),
    );
    assert.equal(signOutResponse.status, 200);
    const signInResponse = await auth.handler(
      new Request("http://localhost:4000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          email: authEmail,
          password: "test-password-123",
        }),
      }),
    );
    assert.equal(signInResponse.status, 200);
    const signedInCookie = signInResponse.headers
      .get("set-cookie")
      ?.split(";")[0];
    assert.ok(signedInCookie);
    const signedInIdentity = await resolveAuthIdentity(auth, {
      cookie: signedInCookie,
    });
    assert.equal(signedInIdentity?.authUserId, identity.authUserId);
    const reprovisionedPlayer = await playerService.provision(
      signedInIdentity.authUserId,
      signedInIdentity.displayName,
    );
    assert.equal(reprovisionedPlayer.id, authenticatedPlayer.id);

    const owner = concurrent[0]!;
    const member = await seedPlayer("Member");
    const moderatorOld = await seedPlayer("Moderator old");
    const moderatorNew = await seedPlayer("Moderator new");
    const outsider = await seedPlayer("Outsider");
    const service = new GroupService(connection.db);
    const group = await service.create(owner.id, "Los tests");
    await addMember(group.id, member.id);
    await addMember(
      group.id,
      moderatorOld.id,
      "MODERATOR",
      new Date("2025-01-01"),
    );
    await addMember(
      group.id,
      moderatorNew.id,
      "MODERATOR",
      new Date("2025-02-01"),
    );

    const renamedGroupName = `Peña Ñandú ${randomUUID().slice(0, 8)}`;
    const renameInput = updateGroupRequestSchema.parse({
      name: `  ${renamedGroupName}  `,
    });
    const renamed = await service.rename(owner.id, group.id, renameInput.name);
    assert.equal(renamed.name, renamedGroupName);
    assert.equal(
      updateGroupRequestSchema.safeParse({ name: "   " }).success,
      false,
    );
    assert.equal(
      updateGroupRequestSchema.safeParse({
        name: `Grupo${String.fromCharCode(0)}`,
      }).success,
      false,
    );
    assert.equal(
      updateGroupRequestSchema.safeParse({ name: "x".repeat(101) }).success,
      false,
    );
    await assert.rejects(
      () => service.rename(member.id, group.id, "Sin permiso"),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "forbidden",
    );
    await assert.rejects(
      () => service.archive(member.id, group.id),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "forbidden",
    );
    await service.setModeratorCapabilities(
      owner.id,
      group.id,
      moderatorOld.id,
      ["GROUP_MANAGE_MEMBERS", "GROUP_MANAGE_INVITATIONS"],
    );
    const moderatorView = await service.members(owner.id, group.id);
    assert.deepEqual(
      moderatorView.find((item) => item.playerId === moderatorOld.id)
        ?.capabilities,
      ["GROUP_READ", "GROUP_MANAGE_MEMBERS", "GROUP_MANAGE_INVITATIONS"],
    );

    const archiveOwner = await seedPlayer("Archive owner");
    const archiveMember = await seedPlayer("Archive member");
    const archiveGroup = await service.create(archiveOwner.id, "Archive test");
    await addMember(archiveGroup.id, archiveMember.id);
    const activeMatchId = randomUUID();
    await connection.db.insert(matches).values({
      id: activeMatchId,
      groupId: archiveGroup.id,
      scheduledAt: new Date("2026-01-10T20:00:00Z"),
      durationMinutes: 60,
      capacity: 10,
      locationText: "Cancha test",
      createdByPlayerId: archiveOwner.id,
    });
    await assert.rejects(
      () => service.archive(archiveOwner.id, archiveGroup.id),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "active_matches_prevent_archive",
    );
    await connection.db
      .update(matches)
      .set({ status: "CANCELLED", cancelledAt: new Date() })
      .where(eq(matches.id, activeMatchId));
    const historicalMatchId = randomUUID();
    const historicalAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await connection.db.insert(matches).values({
      id: historicalMatchId,
      groupId: archiveGroup.id,
      status: "FINISHED",
      scheduledAt: historicalAt,
      durationMinutes: 60,
      capacity: 10,
      locationText: "Cancha histórica",
      createdByPlayerId: archiveOwner.id,
      rosterLockedAt: historicalAt,
      rosterConfirmedAt: historicalAt,
      rosterConfirmedByPlayerId: archiveOwner.id,
    });
    await connection.db.insert(matchSportingResults).values({
      id: randomUUID(),
      matchId: historicalMatchId,
      status: "CONFIRMED",
      teamAGoals: 3,
      teamBGoals: 2,
      updatedByPlayerId: archiveOwner.id,
      confirmedAt: historicalAt,
      confirmedByPlayerId: archiveOwner.id,
    });
    await service.archive(archiveOwner.id, archiveGroup.id);
    const [archivedOperationalGroup] = await connection.db
      .select()
      .from(groups)
      .where(eq(groups.id, archiveGroup.id));
    assert.equal(archivedOperationalGroup?.status, "ARCHIVED");
    const archivedMemberships = await connection.db
      .select()
      .from(groupMemberships)
      .where(eq(groupMemberships.groupId, archiveGroup.id));
    assert.equal(archivedMemberships.length, 2);
    assert.equal(
      archivedMemberships.every((membership) => membership.status === "ACTIVE"),
      true,
    );
    const [preservedMatch] = await connection.db
      .select()
      .from(matches)
      .where(eq(matches.id, activeMatchId));
    assert.equal(preservedMatch?.status, "CANCELLED");
    const [preservedHistoricalMatch] = await connection.db
      .select()
      .from(matches)
      .where(eq(matches.id, historicalMatchId));
    assert.equal(preservedHistoricalMatch?.status, "FINISHED");
    const discovery = new DiscoveryService(
      connection.db,
      new PublicPlayerProfileService(
        connection.db,
        new PlayerPerformanceReadService(connection.db),
        new FootballPreferencesService(connection.db),
        new RewardService(connection.db),
      ),
    );
    const renamedSearch = await discovery.search(owner.id, {
      q: renamedGroupName,
      limit: 10,
    });
    assert.equal(
      renamedSearch.groups.some(
        (item) => item.id === group.id && item.name === renamedGroupName,
      ),
      true,
    );
    const archivedSearch = await discovery.search(archiveOwner.id, {
      q: "Archive test",
      limit: 10,
    });
    assert.equal(
      archivedSearch.groups.some((item) => item.id === archiveGroup.id),
      false,
    );
    const archivedFeatured = await discovery.featuredGroups("30d", 10);
    assert.equal(
      [
        ...archivedFeatured.mostActive,
        ...archivedFeatured.mostActivePlayers,
        ...archivedFeatured.mostGoals,
      ].some((item) => item.group.id === archiveGroup.id),
      false,
    );
    await assert.rejects(
      () => service.rename(archiveOwner.id, archiveGroup.id, "Too late"),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "group_not_found",
    );

    const owners = await connection.db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, group.id),
          eq(groupMemberships.role, "OWNER"),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      );
    assert.equal(owners.length, 1);
    await assert.rejects(
      () => addMember(group.id, outsider.id, "OWNER", new Date("2025-01-01")),
      (error: unknown) =>
        isUniqueConstraint(error, "group_memberships_active_owner_uq"),
    );
    await assert.rejects(
      () => addMember(group.id, member.id),
      (error) =>
        isUniqueConstraint(error, "group_memberships_active_player_uq"),
    );
    await assert.rejects(
      () => service.get(outsider.id, group.id),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "membership_not_found",
    );
    await assert.rejects(
      () => service.transferOwnership(moderatorOld.id, group.id, member.id),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "forbidden",
    );
    await assert.rejects(
      () => service.transferOwnership(owner.id, group.id, outsider.id),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "membership_not_found",
    );
    await assert.rejects(
      () => service.remove(moderatorOld.id, group.id, owner.id),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "ownership_invariant_violation",
    );

    await service.changeModerator(owner.id, group.id, member.id, "MODERATOR");
    await service.changeModerator(owner.id, group.id, member.id, "MEMBER");
    await service.transferOwnership(owner.id, group.id, member.id);
    const afterTransfer = await connection.db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, group.id),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      );
    assert.equal(
      afterTransfer.filter((item) => item.role === "OWNER").length,
      1,
    );
    assert.equal(
      afterTransfer.find((item) => item.playerId === owner.id)?.role,
      "MEMBER",
    );

    await service.leave(member.id, group.id);
    const successor = await connection.db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, group.id),
          eq(groupMemberships.role, "OWNER"),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      )
      .limit(1);
    assert.equal(successor[0]?.playerId, moderatorOld.id);

    const ordinaryOwner = await seedPlayer("Ordinary owner");
    const ordinaryMember = await seedPlayer("Ordinary member");
    const ordinaryGroup = await service.create(
      ordinaryOwner.id,
      "Ordinary leave",
    );
    await addMember(ordinaryGroup.id, ordinaryMember.id);
    await service.leave(ordinaryMember.id, ordinaryGroup.id);
    const [leftMembership] = await connection.db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, ordinaryGroup.id),
          eq(groupMemberships.playerId, ordinaryMember.id),
        ),
      );
    assert.equal(leftMembership?.status, "LEFT");

    const oldestOwner = await seedPlayer("Oldest owner");
    const oldestMember = await seedPlayer("Oldest member");
    const newerMember = await seedPlayer("Newer member");
    const oldestGroup = await service.create(oldestOwner.id, "Oldest member");
    await addMember(
      oldestGroup.id,
      oldestMember.id,
      "MEMBER",
      new Date("2025-03-01"),
      new Date("2025-03-01"),
    );
    await addMember(
      oldestGroup.id,
      newerMember.id,
      "MEMBER",
      new Date("2025-04-01"),
      new Date("2025-04-01"),
    );
    await service.leave(oldestOwner.id, oldestGroup.id);
    const [oldestSuccessor] = await connection.db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, oldestGroup.id),
          eq(groupMemberships.role, "OWNER"),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      );
    assert.equal(oldestSuccessor?.playerId, oldestMember.id);

    const removeOwner = await seedPlayer("Remove owner");
    const removedMember = await seedPlayer("Removed member");
    const removeGroup = await service.create(removeOwner.id, "Remove member");
    await addMember(removeGroup.id, removedMember.id);
    await service.remove(removeOwner.id, removeGroup.id, removedMember.id);
    const [removedMembership] = await connection.db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, removeGroup.id),
          eq(groupMemberships.playerId, removedMember.id),
        ),
      );
    assert.equal(removedMembership?.status, "REMOVED");

    const blockedPlayer = await seedPlayer("Blocked member");
    await addMember(removeGroup.id, blockedPlayer.id);
    await service.block(removeOwner.id, removeGroup.id, blockedPlayer.id);
    assert.equal(
      (await service.members(removeOwner.id, removeGroup.id)).some(
        (item) => item.playerId === blockedPlayer.id,
      ),
      false,
    );
    assert.equal(
      (await service.members(removeOwner.id, removeGroup.id, true)).find(
        (item) => item.playerId === blockedPlayer.id,
      )?.status,
      "BLOCKED",
    );
    await service.unblock(removeOwner.id, removeGroup.id, blockedPlayer.id);
    const [unblockedMembership] = await connection.db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, removeGroup.id),
          eq(groupMemberships.playerId, blockedPlayer.id),
        ),
      );
    assert.equal(unblockedMembership?.status, "REMOVED");

    const solo = await seedPlayer("Solo");
    const soloGroup = await service.create(solo.id, "Solo group");
    await service.leave(solo.id, soloGroup.id);
    const [archived] = await connection.db
      .select()
      .from(groups)
      .where(eq(groups.id, soloGroup.id));
    assert.equal(archived?.status, "ARCHIVED");

    const first = await seedPlayer("First");
    const second = await seedPlayer("Second");
    const raceGroup = await service.create(first.id, "Race");
    await addMember(raceGroup.id, second.id);
    const race = await Promise.allSettled([
      service.transferOwnership(first.id, raceGroup.id, second.id),
      service.leave(first.id, raceGroup.id),
    ]);
    console.log(
      `ownership concurrency outcome: transfer=${race[0]?.status}, leave=${race[1]?.status}`,
    );
    assert.equal(
      race.filter((result) => result.status === "fulfilled").length >= 1,
      true,
    );
    const raceOwners = await connection.db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, raceGroup.id),
          eq(groupMemberships.role, "OWNER"),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      );
    assert.equal(raceOwners.length, 1);
    await connection.close();
  },
);
