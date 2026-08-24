import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
};

// Better Auth owns these authentication records. Product modules only reference user.id.
export const authUser = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...timestamps,
});
export const authSession = pgTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("auth_session_user_idx").on(table.userId)],
);
export const authAccount = pgTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    issuer: text("issuer"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auth_account_provider_account_uq").on(
      table.providerId,
      table.accountId,
    ),
    index("auth_account_user_idx").on(table.userId),
  ],
);
export const authVerification = pgTable(
  "auth_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    ...timestamps,
  },
  (table) => [index("auth_verification_identifier_idx").on(table.identifier)],
);

export const groupStatus = pgEnum("group_status", ["ACTIVE", "ARCHIVED"]);
export const membershipStatus = pgEnum("membership_status", [
  "ACTIVE",
  "LEFT",
  "REMOVED",
]);
export const membershipRole = pgEnum("membership_role", [
  "OWNER",
  "MODERATOR",
  "MEMBER",
]);

export const players = pgTable("players", {
  id: uuid("id").primaryKey(),
  authUserId: text("auth_user_id")
    .notNull()
    .unique()
    .references(() => authUser.id, { onDelete: "restrict" }),
  displayName: text("display_name").notNull(),
  ...timestamps,
});

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    status: groupStatus("status").default("ACTIVE").notNull(),
    createdByPlayerId: uuid("created_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [index("groups_created_by_idx").on(table.createdByPlayerId)],
);

export const groupMemberships = pgTable(
  "group_memberships",
  {
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    status: membershipStatus("status").default("ACTIVE").notNull(),
    role: membershipRole("role").default("MEMBER").notNull(),
    capabilities: text("capabilities")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    joinedAt: timestamp("joined_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    roleGrantedAt: timestamp("role_granted_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("group_memberships_active_player_uq")
      .on(table.groupId, table.playerId)
      .where(sql`${table.status} = 'ACTIVE'`),
    uniqueIndex("group_memberships_active_owner_uq")
      .on(table.groupId)
      .where(sql`${table.status} = 'ACTIVE' and ${table.role} = 'OWNER'`),
    index("group_memberships_player_status_idx").on(
      table.playerId,
      table.status,
    ),
    index("group_memberships_group_status_joined_idx").on(
      table.groupId,
      table.status,
      table.joinedAt,
    ),
  ],
);

export const groupRoleChanges = pgTable(
  "group_role_changes",
  {
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => groupMemberships.id, { onDelete: "restrict" }),
    changedByPlayerId: uuid("changed_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    previousRole: membershipRole("previous_role").notNull(),
    nextRole: membershipRole("next_role").notNull(),
    changedAt: timestamp("changed_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("group_role_changes_group_time_idx").on(
      table.groupId,
      table.changedAt,
    ),
  ],
);
