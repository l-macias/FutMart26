import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDrizzleAuth, resolveAuthIdentity } from "@football/auth";
import { createDatabase } from "@football/database";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
  groupMemberships,
  groups,
} from "@football/database/schema";
import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
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
        "auth_account",
        "auth_session",
        "auth_user",
        "auth_verification",
        "evaluation_evidence",
        "group_memberships",
        "group_role_changes",
        "groups",
        "match_participant_stats",
        "match_participants",
        "matches",
        "player_evaluations",
        "players",
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
    assert.equal(primaryKeys[0]?.count, "15");
    const foreignKeys = await connection.client.unsafe<
      { conname: string; definition: string }[]
    >(
      "select conname, pg_get_constraintdef(oid) as definition from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace",
    );
    for (const foreignKey of foreignKeys.filter(
      (row) => !row.conname.startsWith("auth_"),
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
      "NO",
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
    const identity = await resolveAuthIdentity(auth, { cookie: sessionCookie });
    assert.ok(identity);
    const authenticatedPlayer = await playerService.provision(
      identity.authUserId,
      identity.displayName,
    );
    assert.equal(authenticatedPlayer.authUserId, identity.authUserId);

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
