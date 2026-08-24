import { sql } from "drizzle-orm";
import {
  boolean,
  bigint,
  check,
  index,
  integer,
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

export const matchDiscipline = pgEnum("match_discipline", ["F5"]);
export const matchStatus = pgEnum("match_status", [
  "DRAFT",
  "OPEN",
  "STARTED",
  "FINISHED",
  "CANCELLED",
]);
export const matchParticipantKind = pgEnum("match_participant_kind", [
  "PLAYER",
  "GUEST",
]);
export const matchParticipantStatus = pgEnum("match_participant_status", [
  "CONFIRMED",
  "WAITLISTED",
  "CANCELLED",
]);

// locationText is display-only in V1. Future Venue/geography IDs will be separate fields.
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    discipline: matchDiscipline("discipline").default("F5").notNull(),
    status: matchStatus("status").default("DRAFT").notNull(),
    scheduledAt: timestamp("scheduled_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    capacity: integer("capacity").notNull(),
    locationText: text("location_text").notNull(),
    createdByPlayerId: uuid("created_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    rosterLockedAt: timestamp("roster_locked_at", {
      mode: "date",
      withTimezone: true,
    }),
    publishedAt: timestamp("published_at", {
      mode: "date",
      withTimezone: true,
    }),
    cancelledAt: timestamp("cancelled_at", {
      mode: "date",
      withTimezone: true,
    }),
    cancelledByPlayerId: uuid("cancelled_by_player_id").references(
      () => players.id,
      { onDelete: "restrict" },
    ),
    nextAdmissionOrder: bigint("next_admission_order", { mode: "bigint" })
      .default(sql`1`)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    check("matches_duration_positive_ck", sql`${table.durationMinutes} > 0`),
    check("matches_capacity_positive_ck", sql`${table.capacity} > 0`),
    index("matches_group_scheduled_idx").on(table.groupId, table.scheduledAt),
    index("matches_group_status_idx").on(table.groupId, table.status),
  ],
);

// One table creates one admission order for Players and Guests and therefore one waitlist.
export const matchParticipants = pgTable(
  "match_participants",
  {
    id: uuid("id").primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "restrict" }),
    kind: matchParticipantKind("kind").notNull(),
    playerId: uuid("player_id").references(() => players.id, {
      onDelete: "restrict",
    }),
    guestDisplayName: text("guest_display_name"),
    guestCreatedByPlayerId: uuid("guest_created_by_player_id").references(
      () => players.id,
      { onDelete: "restrict" },
    ),
    status: matchParticipantStatus("status").notNull(),
    admissionOrder: bigint("admission_order", { mode: "bigint" }).notNull(),
    joinedAt: timestamp("joined_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    confirmedAt: timestamp("confirmed_at", {
      mode: "date",
      withTimezone: true,
    }),
    cancelledAt: timestamp("cancelled_at", {
      mode: "date",
      withTimezone: true,
    }),
    cancelledByPlayerId: uuid("cancelled_by_player_id").references(
      () => players.id,
      { onDelete: "restrict" },
    ),
    promotedAt: timestamp("promoted_at", {
      mode: "date",
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    check(
      "match_participants_identity_ck",
      sql`(${table.kind} = 'PLAYER' and ${table.playerId} is not null and ${table.guestDisplayName} is null and ${table.guestCreatedByPlayerId} is null) or (${table.kind} = 'GUEST' and ${table.playerId} is null and ${table.guestDisplayName} is not null and btrim(${table.guestDisplayName}) <> '' and ${table.guestCreatedByPlayerId} is not null)`,
    ),
    uniqueIndex("match_participants_admission_order_uq").on(
      table.matchId,
      table.admissionOrder,
    ),
    uniqueIndex("match_participants_active_player_uq")
      .on(table.matchId, table.playerId)
      .where(
        sql`${table.kind} = 'PLAYER' and ${table.status} in ('CONFIRMED', 'WAITLISTED')`,
      ),
    index("match_participants_match_status_order_idx").on(
      table.matchId,
      table.status,
      table.admissionOrder,
    ),
    index("match_participants_player_match_idx").on(
      table.playerId,
      table.matchId,
    ),
  ],
);
