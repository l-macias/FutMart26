import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  bigint,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
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
  "BLOCKED",
]);
export const membershipRole = pgEnum("membership_role", [
  "OWNER",
  "MODERATOR",
  "MEMBER",
]);
export const invitationType = pgEnum("invitation_type", [
  "SINGLE_USE",
  "TIME_LIMITED",
]);
export const footballRole = pgEnum("football_role", [
  "LIBRE",
  "DEFENSIVO",
  "MEDIO",
  "OFENSIVO",
  "PORTERO",
]);
export const footballStrength = pgEnum("football_strength", [
  "VELOCIDAD",
  "PASE",
  "REGATE",
  "REMATE",
  "DEFENSA",
  "FISICO",
]);
export const groupGuestStatus = pgEnum("group_guest_status", [
  "ACTIVE",
  "ARCHIVED",
  "DELETED",
]);
export const venueStatus = pgEnum("venue_status", ["ACTIVE", "ARCHIVED"]);
export const venueProvenance = pgEnum("venue_provenance", ["USER_CREATED"]);
export const mediaAssetPurpose = pgEnum("media_asset_purpose", [
  "PLAYER_AVATAR",
]);
export const mediaAssetStatus = pgEnum("media_asset_status", [
  "PENDING",
  "READY",
  "DELETED",
]);
export const profileVisibility = pgEnum("profile_visibility", [
  "PUBLIC",
  "PRIVATE",
]);
export const playerAccountStatus = pgEnum("player_account_status", [
  "ACTIVE",
  "ANONYMIZED",
]);
export const policyType = pgEnum("policy_type", ["TERMS", "PRIVACY"]);
export const abuseReportTargetType = pgEnum("abuse_report_target_type", [
  "PLAYER",
  "GROUP",
  "MATCH",
]);
export const abuseReportReason = pgEnum("abuse_report_reason", [
  "HARASSMENT",
  "INAPPROPRIATE_CONTENT",
  "IMPERSONATION",
  "SPAM",
  "SAFETY",
  "OTHER",
]);
export const abuseReportStatus = pgEnum("abuse_report_status", [
  "OPEN",
  "RESOLVED",
  "DISMISSED",
]);
export const adminRole = pgEnum("admin_role", ["SUPERADMIN"]);
export const adminAuditAction = pgEnum("admin_audit_action", [
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_REACTIVATED",
  "PLAYER_NAME_MODERATED",
  "PLAYER_AVATAR_REMOVED",
  "GROUP_FORCED_PRIVATE",
  "GROUP_NAME_MODERATED",
  "GROUP_ARCHIVED",
  "REPORT_RESOLVED",
  "REPORT_DISMISSED",
  "BALLOT_VOIDED",
  "INVITATION_REVOKED",
  "MATCH_CANCELLED_BY_ADMIN",
]);
export const adminTargetType = pgEnum("admin_target_type", [
  "ACCOUNT",
  "PLAYER",
  "GROUP",
  "MATCH",
  "REPORT",
  "BALLOT",
  "INVITATION",
]);

export const adminGrants = pgTable("admin_grants", {
  authUserId: text("auth_user_id")
    .primaryKey()
    .references(() => authUser.id, { onDelete: "restrict" }),
  role: adminRole("role").default("SUPERADMIN").notNull(),
  grantedAt: timestamp("granted_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accountSuspensions = pgTable(
  "account_suspensions",
  {
    id: uuid("id").primaryKey(),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    suspendedByAuthUserId: text("suspended_by_auth_user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "restrict" }),
    suspendedAt: timestamp("suspended_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    reactivatedAt: timestamp("reactivated_at", {
      mode: "date",
      withTimezone: true,
    }),
    reactivatedByAuthUserId: text("reactivated_by_auth_user_id").references(
      () => authUser.id,
      { onDelete: "restrict" },
    ),
  },
  (table) => [
    uniqueIndex("account_suspensions_active_user_uq")
      .on(table.authUserId)
      .where(sql`${table.reactivatedAt} is null`),
    index("account_suspensions_user_time_idx").on(
      table.authUserId,
      table.suspendedAt,
    ),
    check(
      "account_suspensions_reactivation_ck",
      sql`(${table.reactivatedAt} is null and ${table.reactivatedByAuthUserId} is null) or (${table.reactivatedAt} is not null and ${table.reactivatedByAuthUserId} is not null)`,
    ),
  ],
);

export const adminAuditEvents = pgTable(
  "admin_audit_events",
  {
    id: uuid("id").primaryKey(),
    actorAuthUserId: text("actor_auth_user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "restrict" }),
    action: adminAuditAction("action").notNull(),
    targetType: adminTargetType("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    metadata:
      jsonb("metadata").$type<
        Record<string, string | number | boolean | null>
      >(),
    requestId: text("request_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("admin_audit_events_created_idx").on(table.createdAt, table.id),
    index("admin_audit_events_target_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
    check(
      "admin_audit_events_reason_length_ck",
      sql`char_length(btrim(${table.reason})) between 5 and 500`,
    ),
  ],
);

export const policyAcceptances = pgTable(
  "policy_acceptances",
  {
    id: uuid("id").primaryKey(),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    type: policyType("type").notNull(),
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("policy_acceptances_user_type_version_uq").on(
      table.authUserId,
      table.type,
      table.version,
    ),
    index("policy_acceptances_user_idx").on(table.authUserId),
  ],
);

export const players = pgTable("players", {
  id: uuid("id").primaryKey(),
  authUserId: text("auth_user_id")
    .unique()
    .references(() => authUser.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  profileVisibility: profileVisibility("profile_visibility")
    .default("PUBLIC")
    .notNull(),
  accountStatus: playerAccountStatus("account_status")
    .default("ACTIVE")
    .notNull(),
  anonymizedAt: timestamp("anonymized_at", {
    mode: "date",
    withTimezone: true,
  }),
  avatarMediaAssetId: uuid("avatar_media_asset_id").references(
    (): AnyPgColumn => mediaAssets.id,
    { onDelete: "restrict" },
  ),
  ...timestamps,
});

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey(),
    ownerPlayerId: uuid("owner_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    purpose: mediaAssetPurpose("purpose").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    status: mediaAssetStatus("status").default("PENDING").notNull(),
    version: integer("version").default(1).notNull(),
    ...timestamps,
  },
  (table) => [
    index("media_assets_owner_status_idx").on(
      table.ownerPlayerId,
      table.status,
    ),
    check("media_assets_byte_size_positive_ck", sql`${table.byteSize} > 0`),
    check(
      "media_assets_dimensions_positive_ck",
      sql`${table.width} > 0 and ${table.height} > 0`,
    ),
    check("media_assets_version_positive_ck", sql`${table.version} > 0`),
  ],
);

// Venues are global references. Creation never grants global edit ownership.
export const venues = pgTable(
  "venues",
  {
    id: uuid("id").primaryKey(),
    displayName: text("display_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    city: text("city").notNull(),
    normalizedCity: text("normalized_city").notNull(),
    countryCode: text("country_code"),
    provinceCode: text("province_code"),
    address: text("address"),
    status: venueStatus("status").default("ACTIVE").notNull(),
    provenance: venueProvenance("provenance").default("USER_CREATED").notNull(),
    createdByPlayerId: uuid("created_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    check(
      "venues_names_nonempty_ck",
      sql`btrim(${table.displayName}) <> '' and btrim(${table.normalizedName}) <> '' and btrim(${table.city}) <> '' and btrim(${table.normalizedCity}) <> ''`,
    ),
    check(
      "venues_country_code_format_ck",
      sql`${table.countryCode} is null or ${table.countryCode} ~ '^[A-Z]{2}$'`,
    ),
    check(
      "venues_province_code_format_ck",
      sql`${table.provinceCode} is null or ${table.provinceCode} ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'`,
    ),
    check(
      "venues_province_country_ck",
      sql`${table.provinceCode} is null or (${table.countryCode} is not null and split_part(${table.provinceCode}, '-', 1) = ${table.countryCode})`,
    ),
    uniqueIndex("venues_active_name_city_uq")
      .on(table.normalizedName, table.normalizedCity)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("venues_search_idx").on(
      table.normalizedCity,
      table.normalizedName,
      table.status,
    ),
  ],
);

export const venueCourts = pgTable(
  "venue_courts",
  {
    id: uuid("id").primaryKey(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    status: venueStatus("status").default("ACTIVE").notNull(),
    createdByPlayerId: uuid("created_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    check(
      "venue_courts_name_nonempty_ck",
      sql`btrim(${table.displayName}) <> '' and btrim(${table.normalizedName}) <> ''`,
    ),
    uniqueIndex("venue_courts_active_name_uq")
      .on(table.venueId, table.normalizedName)
      .where(sql`${table.status} = 'ACTIVE'`),
    uniqueIndex("venue_courts_id_venue_uq").on(table.id, table.venueId),
    index("venue_courts_venue_status_idx").on(table.venueId, table.status),
  ],
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    status: groupStatus("status").default("ACTIVE").notNull(),
    visibility: profileVisibility("visibility").default("PUBLIC").notNull(),
    createdByPlayerId: uuid("created_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    guestsEnabled: boolean("guests_enabled").default(true).notNull(),
    defaultGuestAllowancePerMember: integer(
      "default_guest_allowance_per_member",
    )
      .default(1)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "groups_default_guest_allowance_nonnegative_ck",
      sql`${table.defaultGuestAllowancePerMember} >= 0`,
    ),
    index("groups_created_by_idx").on(table.createdByPlayerId),
  ],
);

export const abuseReports = pgTable(
  "abuse_reports",
  {
    id: uuid("id").primaryKey(),
    reporterPlayerId: uuid("reporter_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    targetType: abuseReportTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: abuseReportReason("reason").notNull(),
    comment: text("comment"),
    status: abuseReportStatus("status").default("OPEN").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { mode: "date", withTimezone: true }),
    handledByAuthUserId: text("handled_by_auth_user_id").references(
      () => authUser.id,
      { onDelete: "restrict" },
    ),
    resolutionNote: text("resolution_note"),
  },
  (table) => [
    check(
      "abuse_reports_comment_length_ck",
      sql`${table.comment} is null or char_length(${table.comment}) <= 1000`,
    ),
    check(
      "abuse_reports_resolution_ck",
      sql`(${table.status} = 'OPEN' and ${table.resolvedAt} is null and ${table.handledByAuthUserId} is null) or (${table.status} <> 'OPEN' and ${table.resolvedAt} is not null)`,
    ),
    check(
      "abuse_reports_resolution_note_length_ck",
      sql`${table.resolutionNote} is null or char_length(${table.resolutionNote}) <= 1000`,
    ),
    index("abuse_reports_reporter_created_idx").on(
      table.reporterPlayerId,
      table.createdAt,
    ),
    index("abuse_reports_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const groupMatchDefaults = pgTable(
  "group_match_defaults",
  {
    groupId: uuid("group_id")
      .primaryKey()
      .references(() => groups.id, { onDelete: "restrict" }),
    discipline: text("discipline").default("F5").notNull(),
    defaultVenueId: uuid("default_venue_id").references(() => venues.id, {
      onDelete: "restrict",
    }),
    defaultCourtId: uuid("default_court_id"),
    defaultLocationText: text("default_location_text"),
    defaultStartTime: text("default_start_time"),
    defaultDurationMinutes: integer("default_duration_minutes")
      .default(60)
      .notNull(),
    defaultCapacity: integer("default_capacity").default(10).notNull(),
    updatedByPlayerId: uuid("updated_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.defaultCourtId, table.defaultVenueId],
      foreignColumns: [venueCourts.id, venueCourts.venueId],
      name: "group_match_defaults_court_venue_fk",
    }).onDelete("restrict"),
    check(
      "group_match_defaults_discipline_ck",
      sql`${table.discipline} = 'F5'`,
    ),
    check(
      "group_match_defaults_duration_ck",
      sql`${table.defaultDurationMinutes} > 0`,
    ),
    check(
      "group_match_defaults_capacity_ck",
      sql`${table.defaultCapacity} > 0`,
    ),
    check(
      "group_match_defaults_court_requires_venue_ck",
      sql`${table.defaultCourtId} is null or ${table.defaultVenueId} is not null`,
    ),
  ],
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
    guestAllowanceOverride: integer("guest_allowance_override"),
    ...timestamps,
  },
  (table) => [
    check(
      "group_memberships_guest_allowance_nonnegative_ck",
      sql`${table.guestAllowanceOverride} is null or ${table.guestAllowanceOverride} >= 0`,
    ),
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

export const groupInvitations = pgTable(
  "group_invitations",
  {
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    type: invitationType("type").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdByPlayerId: uuid("created_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    createdByRole: membershipRole("created_by_role").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    maxUses: integer("max_uses"),
    useCount: integer("use_count").default(0).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    revokedByPlayerId: uuid("revoked_by_player_id").references(
      () => players.id,
      { onDelete: "restrict" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("group_invitations_token_hash_uq").on(table.tokenHash),
    check("group_invitations_use_count_ck", sql`${table.useCount} >= 0`),
    check(
      "group_invitations_max_uses_ck",
      sql`${table.maxUses} is null or (${table.maxUses} > 0 and ${table.useCount} <= ${table.maxUses})`,
    ),
    check(
      "group_invitations_type_ck",
      sql`(${table.type} = 'SINGLE_USE' and ${table.expiresAt} is null and ${table.maxUses} = 1) or (${table.type} = 'TIME_LIMITED' and ${table.expiresAt} is not null)`,
    ),
    index("group_invitations_group_created_idx").on(
      table.groupId,
      table.createdAt,
    ),
  ],
);

export const groupInvitationUsages = pgTable(
  "group_invitation_usages",
  {
    id: uuid("id").primaryKey(),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => groupInvitations.id, { onDelete: "restrict" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => groupMemberships.id, { onDelete: "restrict" }),
    usedAt: timestamp("used_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("group_invitation_usages_invitation_player_uq").on(
      table.invitationId,
      table.playerId,
    ),
    index("group_invitation_usages_invitation_time_idx").on(
      table.invitationId,
      table.usedAt,
    ),
  ],
);

export const playerFootballPreferences = pgTable(
  "player_football_preferences",
  {
    id: uuid("id").primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    discipline: text("discipline").default("F5").notNull(),
    preferredRoles: footballRole("preferred_roles").array().notNull(),
    willingToPlayGoalkeeper: boolean("willing_to_play_goalkeeper")
      .default(false)
      .notNull(),
    strengths: footballStrength("strengths").array().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("player_football_preferences_player_discipline_uq").on(
      table.playerId,
      table.discipline,
    ),
    check(
      "player_football_preferences_discipline_ck",
      sql`${table.discipline} = 'F5'`,
    ),
    check(
      "player_football_preferences_roles_ck",
      sql`cardinality(${table.preferredRoles}) <= 2`,
    ),
    check(
      "player_football_preferences_strengths_ck",
      sql`cardinality(${table.strengths}) <= 3`,
    ),
    check(
      "player_football_preferences_keeper_ck",
      sql`not ('PORTERO' = any(${table.preferredRoles})) or ${table.willingToPlayGoalkeeper}`,
    ),
  ],
);

export const groupGuests = pgTable(
  "group_guests",
  {
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    normalizedDisplayName: text("normalized_display_name").notNull(),
    status: groupGuestStatus("status").default("ACTIVE").notNull(),
    createdByPlayerId: uuid("created_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    archivedByPlayerId: uuid("archived_by_player_id").references(
      () => players.id,
      { onDelete: "restrict" },
    ),
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),
    deletedByPlayerId: uuid("deleted_by_player_id").references(
      () => players.id,
      { onDelete: "restrict" },
    ),
    ...timestamps,
  },
  (table) => [
    check(
      "group_guests_names_nonempty_ck",
      sql`btrim(${table.displayName}) <> '' and btrim(${table.normalizedDisplayName}) <> ''`,
    ),
    uniqueIndex("group_guests_reusable_name_uq")
      .on(table.groupId, table.normalizedDisplayName)
      .where(sql`${table.status} in ('ACTIVE', 'ARCHIVED')`),
    index("group_guests_group_status_name_idx").on(
      table.groupId,
      table.status,
      table.normalizedDisplayName,
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
export const notificationType = pgEnum("notification_type", [
  "VOTING_AVAILABLE",
  "PROGRESSION_AVAILABLE",
  "MATCH_CANCELLED",
  "ACHIEVEMENT_EARNED",
  "AWARD_EARNED",
  "CONNECTION_REQUESTED",
  "CONNECTION_ACCEPTED",
  "GROUP_INVITATION_RECEIVED",
  "MATCH_INVITATION_RECEIVED",
]);
export const playerConnectionStatus = pgEnum("player_connection_status", [
  "PENDING",
  "ACCEPTED",
]);
export const directedInvitationStatus = pgEnum("directed_invitation_status", [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "REVOKED",
  "EXPIRED",
]);
export const achievementType = pgEnum("achievement_type", [
  "FIRST_MATCH",
  "FIVE_MATCHES",
  "TEN_MATCHES",
  "FIRST_GOAL",
  "HAT_TRICK",
  "FIRST_ASSIST",
  "HIGH_RATING",
]);
export const matchAwardType = pgEnum("match_award_type", [
  "TOP_RATED",
  "TOP_SCORER",
  "TOP_ASSIST",
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
export const matchAttendanceStatus = pgEnum("match_attendance_status", [
  "PLAYED",
  "NO_SHOW",
]);
export const matchTeamSide = pgEnum("match_team_side", ["TEAM_A", "TEAM_B"]);
export const matchTeamAssignmentSource = pgEnum(
  "match_team_assignment_source",
  ["MANUAL", "INTELLIGENT"],
);
export const sportingResultStatus = pgEnum("sporting_result_status", [
  "DRAFT",
  "CONFIRMED",
  "NOT_PLAYED",
]);

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
    recruitmentEnabled: boolean("recruitment_enabled").default(false).notNull(),
    // Text is a historical display snapshot even when structured IDs are used.
    locationText: text("location_text").notNull(),
    venueId: uuid("venue_id").references(() => venues.id, {
      onDelete: "restrict",
    }),
    courtId: uuid("court_id"),
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
    observerPlayerId: uuid("observer_player_id").references(() => players.id, {
      onDelete: "restrict",
    }),
    rosterConfirmedAt: timestamp("roster_confirmed_at", {
      mode: "date",
      withTimezone: true,
    }),
    rosterConfirmedByPlayerId: uuid("roster_confirmed_by_player_id").references(
      () => players.id,
      { onDelete: "restrict" },
    ),
    nextAdmissionOrder: bigint("next_admission_order", { mode: "bigint" })
      .default(sql`1`)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.courtId, table.venueId],
      foreignColumns: [venueCourts.id, venueCourts.venueId],
      name: "matches_court_venue_fk",
    }).onDelete("restrict"),
    check("matches_duration_positive_ck", sql`${table.durationMinutes} > 0`),
    check("matches_capacity_positive_ck", sql`${table.capacity} > 0`),
    check(
      "matches_court_requires_venue_ck",
      sql`${table.courtId} is null or ${table.venueId} is not null`,
    ),
    index("matches_group_scheduled_idx").on(table.groupId, table.scheduledAt),
    index("matches_group_status_idx").on(table.groupId, table.status),
    index("matches_recruitment_open_scheduled_idx")
      .on(table.scheduledAt, table.id)
      .where(sql`${table.recruitmentEnabled} and ${table.status} = 'OPEN'`),
  ],
);

export const matchRecruitmentNeeds = pgTable(
  "match_recruitment_needs",
  {
    id: uuid("id").primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "restrict" }),
    role: footballRole("role").notNull(),
    quantity: integer("quantity").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("match_recruitment_needs_match_role_uq").on(
      table.matchId,
      table.role,
    ),
    check(
      "match_recruitment_needs_quantity_positive_ck",
      sql`${table.quantity} > 0`,
    ),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey(),
    recipientPlayerId: uuid("recipient_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    type: notificationType("type").notNull(),
    matchId: uuid("match_id").references(() => matches.id, {
      onDelete: "restrict",
    }),
    relatedPlayerId: uuid("related_player_id").references(() => players.id, {
      onDelete: "restrict",
    }),
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "restrict",
    }),
    deduplicationKey: text("deduplication_key").notNull(),
    readAt: timestamp("read_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("notifications_deduplication_key_uq").on(
      table.deduplicationKey,
    ),
    index("notifications_recipient_created_idx").on(
      table.recipientPlayerId,
      table.createdAt,
      table.id,
    ),
    index("notifications_recipient_unread_idx")
      .on(table.recipientPlayerId, table.createdAt)
      .where(sql`${table.readAt} is null`),
  ],
);

export const playerConnections = pgTable(
  "player_connections",
  {
    id: uuid("id").primaryKey(),
    playerLowId: uuid("player_low_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    playerHighId: uuid("player_high_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    requesterPlayerId: uuid("requester_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    status: playerConnectionStatus("status").default("PENDING").notNull(),
    requestedAt: timestamp("requested_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "player_connections_distinct_players_ck",
      sql`${table.playerLowId} < ${table.playerHighId}`,
    ),
    check(
      "player_connections_requester_in_pair_ck",
      sql`${table.requesterPlayerId} in (${table.playerLowId}, ${table.playerHighId})`,
    ),
    check(
      "player_connections_accepted_at_ck",
      sql`(${table.status} = 'PENDING' and ${table.acceptedAt} is null) or (${table.status} = 'ACCEPTED' and ${table.acceptedAt} is not null)`,
    ),
    uniqueIndex("player_connections_pair_uq").on(
      table.playerLowId,
      table.playerHighId,
    ),
    index("player_connections_low_status_time_idx").on(
      table.playerLowId,
      table.status,
      table.acceptedAt,
    ),
    index("player_connections_high_status_time_idx").on(
      table.playerHighId,
      table.status,
      table.acceptedAt,
    ),
    index("player_connections_requester_status_time_idx").on(
      table.requesterPlayerId,
      table.status,
      table.requestedAt,
    ),
  ],
);

export const groupConnectionInvitations = pgTable(
  "group_connection_invitations",
  {
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "restrict" }),
    invitedPlayerId: uuid("invited_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    invitedByPlayerId: uuid("invited_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    invitedByRole: membershipRole("invited_by_role").notNull(),
    status: directedInvitationStatus("status").default("PENDING").notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    respondedAt: timestamp("responded_at", {
      mode: "date",
      withTimezone: true,
    }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    revokedByPlayerId: uuid("revoked_by_player_id").references(
      () => players.id,
      { onDelete: "restrict" },
    ),
    ...timestamps,
  },
  (table) => [
    check(
      "group_connection_invitations_distinct_players_ck",
      sql`${table.invitedPlayerId} <> ${table.invitedByPlayerId}`,
    ),
    uniqueIndex("group_connection_invitations_pending_uq")
      .on(table.groupId, table.invitedPlayerId)
      .where(sql`${table.status} = 'PENDING'`),
    index("group_connection_invitations_recipient_status_time_idx").on(
      table.invitedPlayerId,
      table.status,
      table.createdAt,
    ),
    index("group_connection_invitations_group_status_time_idx").on(
      table.groupId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const matchPlayerInvitations = pgTable(
  "match_player_invitations",
  {
    id: uuid("id").primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "restrict" }),
    invitedPlayerId: uuid("invited_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    invitedByPlayerId: uuid("invited_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    status: directedInvitationStatus("status").default("PENDING").notNull(),
    respondedAt: timestamp("responded_at", {
      mode: "date",
      withTimezone: true,
    }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    revokedByPlayerId: uuid("revoked_by_player_id").references(
      () => players.id,
      { onDelete: "restrict" },
    ),
    ...timestamps,
  },
  (table) => [
    check(
      "match_player_invitations_distinct_players_ck",
      sql`${table.invitedPlayerId} <> ${table.invitedByPlayerId}`,
    ),
    uniqueIndex("match_player_invitations_pending_uq")
      .on(table.matchId, table.invitedPlayerId)
      .where(sql`${table.status} = 'PENDING'`),
    index("match_player_invitations_recipient_status_time_idx").on(
      table.invitedPlayerId,
      table.status,
      table.createdAt,
    ),
    index("match_player_invitations_match_status_time_idx").on(
      table.matchId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const matchScheduleChanges = pgTable(
  "match_schedule_changes",
  {
    id: uuid("id").primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "restrict" }),
    previousScheduledAt: timestamp("previous_scheduled_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    nextScheduledAt: timestamp("next_scheduled_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    changedByPlayerId: uuid("changed_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    changedAt: timestamp("changed_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("match_schedule_changes_match_time_idx").on(
      table.matchId,
      table.changedAt,
    ),
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
    groupGuestId: uuid("group_guest_id").references(() => groupGuests.id, {
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
    attendance: matchAttendanceStatus("attendance"),
    attendanceConfirmedAt: timestamp("attendance_confirmed_at", {
      mode: "date",
      withTimezone: true,
    }),
    attendanceConfirmedByPlayerId: uuid(
      "attendance_confirmed_by_player_id",
    ).references(() => players.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    check(
      "match_participants_identity_ck",
      sql`(${table.kind} = 'PLAYER' and ${table.playerId} is not null and ${table.groupGuestId} is null and ${table.guestDisplayName} is null and ${table.guestCreatedByPlayerId} is null) or (${table.kind} = 'GUEST' and ${table.playerId} is null and ${table.groupGuestId} is not null and ${table.guestDisplayName} is not null and btrim(${table.guestDisplayName}) <> '' and ${table.guestCreatedByPlayerId} is not null)`,
    ),
    check(
      "match_participants_attendance_evidence_ck",
      sql`(${table.attendance} is null and ${table.attendanceConfirmedAt} is null and ${table.attendanceConfirmedByPlayerId} is null) or (${table.status} = 'CONFIRMED' and ${table.attendance} is not null and ${table.attendanceConfirmedAt} is not null and ${table.attendanceConfirmedByPlayerId} is not null)`,
    ),
    uniqueIndex("match_participants_admission_order_uq").on(
      table.matchId,
      table.admissionOrder,
    ),
    uniqueIndex("match_participants_id_match_uq").on(table.id, table.matchId),
    uniqueIndex("match_participants_active_player_uq")
      .on(table.matchId, table.playerId)
      .where(
        sql`${table.kind} = 'PLAYER' and ${table.status} in ('CONFIRMED', 'WAITLISTED')`,
      ),
    uniqueIndex("match_participants_active_group_guest_uq")
      .on(table.matchId, table.groupGuestId)
      .where(
        sql`${table.kind} = 'GUEST' and ${table.status} in ('CONFIRMED', 'WAITLISTED')`,
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
    index("match_participants_group_guest_match_idx").on(
      table.groupGuestId,
      table.matchId,
    ),
  ],
);

// TEAM_A and TEAM_B are Match-scoped sides, not persistent Group teams.
export const matchTeamAssignments = pgTable(
  "match_team_assignments",
  {
    id: uuid("id").primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "restrict" }),
    participantId: uuid("participant_id").notNull(),
    side: matchTeamSide("side").notNull(),
    source: matchTeamAssignmentSource("source").notNull(),
    algorithmVersion: text("algorithm_version"),
    updatedByPlayerId: uuid("updated_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: "match_team_assignments_participant_match_fk",
      columns: [table.participantId, table.matchId],
      foreignColumns: [matchParticipants.id, matchParticipants.matchId],
    }).onDelete("restrict"),
    uniqueIndex("match_team_assignments_participant_uq").on(
      table.participantId,
    ),
    index("match_team_assignments_match_side_idx").on(
      table.matchId,
      table.side,
    ),
  ],
);

export const matchSportingResults = pgTable(
  "match_sporting_results",
  {
    id: uuid("id").primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "restrict" }),
    status: sportingResultStatus("status").default("DRAFT").notNull(),
    teamAGoals: integer("team_a_goals"),
    teamBGoals: integer("team_b_goals"),
    updatedByPlayerId: uuid("updated_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    confirmedAt: timestamp("confirmed_at", {
      mode: "date",
      withTimezone: true,
    }),
    confirmedByPlayerId: uuid("confirmed_by_player_id").references(
      () => players.id,
      { onDelete: "restrict" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("match_sporting_results_match_uq").on(table.matchId),
    index("match_sporting_results_status_idx").on(table.status),
    check(
      "match_sporting_results_state_ck",
      sql`(${table.status} = 'DRAFT' and ${table.teamAGoals} is not null and ${table.teamBGoals} is not null and ${table.confirmedAt} is null and ${table.confirmedByPlayerId} is null) or (${table.status} = 'CONFIRMED' and ${table.teamAGoals} is not null and ${table.teamBGoals} is not null and ${table.confirmedAt} is not null and ${table.confirmedByPlayerId} is not null) or (${table.status} = 'NOT_PLAYED' and ${table.teamAGoals} is null and ${table.teamBGoals} is null and ${table.confirmedAt} is not null and ${table.confirmedByPlayerId} is not null)`,
    ),
    check(
      "match_sporting_results_scores_ck",
      sql`(${table.teamAGoals} is null or ${table.teamAGoals} >= 0) and (${table.teamBGoals} is null or ${table.teamBGoals} >= 0)`,
    ),
  ],
);

export const matchParticipantStats = pgTable(
  "match_participant_stats",
  {
    id: uuid("id").primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "restrict" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => matchParticipants.id, { onDelete: "restrict" }),
    goals: integer("goals").default(0).notNull(),
    assists: integer("assists").default(0).notNull(),
    updatedByPlayerId: uuid("updated_by_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("match_participant_stats_participant_uq").on(
      table.participantId,
    ),
    check("match_participant_stats_goals_ck", sql`${table.goals} >= 0`),
    check("match_participant_stats_assists_ck", sql`${table.assists} >= 0`),
    index("match_participant_stats_match_idx").on(table.matchId),
  ],
);

export const votingSessionStatus = pgEnum("voting_session_status", [
  "OPEN",
  "CLOSED",
]);
export const votingCloseReason = pgEnum("voting_close_reason", [
  "ALL_ELIGIBLE_VOTED",
  "DEADLINE",
]);
export const ballotMode = pgEnum("ballot_mode", ["QUICK", "FULL"]);
export const ballotStatus = pgEnum("ballot_status", ["VALID", "VOIDED"]);
export const quickSignal = pgEnum("quick_signal", ["POSITIVE", "IMPROVEMENT"]);
export const evidenceType = pgEnum("evaluation_evidence_type", [
  "STRENGTH",
  "IMPROVEMENT",
]);
export const evidenceAttribute = pgEnum("evaluation_evidence_attribute", [
  "PASE",
  "REGATE",
  "REMATE",
  "DEFENSA",
  "VELOCIDAD",
  "FISICO",
]);

export const votingSessions = pgTable(
  "voting_sessions",
  {
    id: uuid("id").primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "restrict" }),
    status: votingSessionStatus("status").default("OPEN").notNull(),
    openedAt: timestamp("opened_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    closesAt: timestamp("closes_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    closedAt: timestamp("closed_at", { mode: "date", withTimezone: true }),
    closeReason: votingCloseReason("close_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("voting_sessions_match_uq").on(table.matchId),
    index("voting_sessions_status_closes_idx").on(table.status, table.closesAt),
    check(
      "voting_sessions_close_evidence_ck",
      sql`(${table.status} = 'OPEN' and ${table.closedAt} is null and ${table.closeReason} is null) or (${table.status} = 'CLOSED' and ${table.closedAt} is not null and ${table.closeReason} is not null)`,
    ),
    check(
      "voting_sessions_window_ck",
      sql`${table.closesAt} > ${table.openedAt}`,
    ),
  ],
);

export const votingBallots = pgTable(
  "voting_ballots",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => votingSessions.id, { onDelete: "restrict" }),
    voterPlayerId: uuid("voter_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    mode: ballotMode("mode").notNull(),
    status: ballotStatus("status").default("VALID").notNull(),
    submittedAt: timestamp("submitted_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    voidedAt: timestamp("voided_at", { mode: "date", withTimezone: true }),
    voidedByPlayerId: uuid("voided_by_player_id").references(() => players.id, {
      onDelete: "restrict",
    }),
    voidedByAuthUserId: text("voided_by_auth_user_id").references(
      () => authUser.id,
      { onDelete: "restrict" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("voting_ballots_session_voter_uq").on(
      table.sessionId,
      table.voterPlayerId,
    ),
    index("voting_ballots_session_status_idx").on(
      table.sessionId,
      table.status,
    ),
    check(
      "voting_ballots_void_evidence_ck",
      sql`(${table.status} = 'VALID' and ${table.voidedAt} is null and ${table.voidedByPlayerId} is null and ${table.voidedByAuthUserId} is null) or (${table.status} = 'VOIDED' and ${table.voidedAt} is not null and ((${table.voidedByPlayerId} is not null)::int + (${table.voidedByAuthUserId} is not null)::int) = 1)`,
    ),
  ],
);

export const playerEvaluations = pgTable(
  "player_evaluations",
  {
    id: uuid("id").primaryKey(),
    ballotId: uuid("ballot_id")
      .notNull()
      .references(() => votingBallots.id, { onDelete: "restrict" }),
    targetParticipantId: uuid("target_participant_id")
      .notNull()
      .references(() => matchParticipants.id, { onDelete: "restrict" }),
    rating: integer("rating").notNull(),
    quickSignal: quickSignal("quick_signal"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("player_evaluations_ballot_target_uq").on(
      table.ballotId,
      table.targetParticipantId,
    ),
    index("player_evaluations_target_idx").on(table.targetParticipantId),
    check(
      "player_evaluations_rating_ck",
      sql`${table.rating} between 1 and 10`,
    ),
    check(
      "player_evaluations_quick_rating_ck",
      sql`${table.quickSignal} is null or (${table.quickSignal} = 'POSITIVE' and ${table.rating} between 7 and 10) or (${table.quickSignal} = 'IMPROVEMENT' and ${table.rating} between 1 and 5)`,
    ),
  ],
);

export const evaluationEvidence = pgTable(
  "evaluation_evidence",
  {
    id: uuid("id").primaryKey(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => playerEvaluations.id, { onDelete: "restrict" }),
    type: evidenceType("type").notNull(),
    attribute: evidenceAttribute("attribute").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("evaluation_evidence_evaluation_type_attribute_uq").on(
      table.evaluationId,
      table.type,
      table.attribute,
    ),
    index("evaluation_evidence_evaluation_idx").on(table.evaluationId),
  ],
);

export const progressionRatingProfile = pgEnum("progression_rating_profile", [
  "LIBRE",
  "DEFENSIVO",
  "MEDIO",
  "OFENSIVO",
]);
export const progressionStreakDirection = pgEnum(
  "progression_streak_direction",
  ["POSITIVE", "NEGATIVE", "NONE"],
);
export const progressionProcessingOutcome = pgEnum(
  "progression_processing_outcome",
  ["APPLIED", "NEUTRAL", "NO_EVIDENCE"],
);

const progressionAttributes = {
  velocidad: numeric("velocidad", { precision: 24, scale: 12 }).notNull(),
  pase: numeric("pase", { precision: 24, scale: 12 }).notNull(),
  regate: numeric("regate", { precision: 24, scale: 12 }).notNull(),
  remate: numeric("remate", { precision: 24, scale: 12 }).notNull(),
  defensa: numeric("defensa", { precision: 24, scale: 12 }).notNull(),
  fisico: numeric("fisico", { precision: 24, scale: 12 }).notNull(),
};

export const progressionConfigVersions = pgTable(
  "progression_config_versions",
  {
    id: uuid("id").primaryKey(),
    version: text("version").notNull(),
    discipline: matchDiscipline("discipline").notNull(),
    document: jsonb("document").$type<Record<string, unknown>>().notNull(),
    activatedAt: timestamp("activated_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("progression_config_versions_discipline_version_uq").on(
      table.discipline,
      table.version,
    ),
    index("progression_config_versions_active_idx").on(
      table.discipline,
      table.activatedAt,
    ),
  ],
);

export const playerPerformances = pgTable(
  "player_performances",
  {
    id: uuid("id").primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    discipline: matchDiscipline("discipline").notNull(),
    ratingProfile: progressionRatingProfile("rating_profile")
      .default("LIBRE")
      .notNull(),
    ...progressionAttributes,
    internalOvr: numeric("internal_ovr", {
      precision: 24,
      scale: 12,
    }).notNull(),
    streakDirection: progressionStreakDirection("streak_direction")
      .default("NONE")
      .notNull(),
    streakCount: integer("streak_count").default(0).notNull(),
    processedMatchCount: integer("processed_match_count").default(0).notNull(),
    lastProcessedMatchId: uuid("last_processed_match_id").references(
      () => matches.id,
      { onDelete: "restrict" },
    ),
    lastProcessedScheduledAt: timestamp("last_processed_scheduled_at", {
      mode: "date",
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("player_performances_player_discipline_uq").on(
      table.playerId,
      table.discipline,
    ),
    check(
      "player_performances_attributes_range_ck",
      sql`${table.velocidad} between 1 and 99 and ${table.pase} between 1 and 99 and ${table.regate} between 1 and 99 and ${table.remate} between 1 and 99 and ${table.defensa} between 1 and 99 and ${table.fisico} between 1 and 99`,
    ),
    check(
      "player_performances_streak_ck",
      sql`(${table.streakDirection} = 'NONE' and ${table.streakCount} = 0) or (${table.streakDirection} <> 'NONE' and ${table.streakCount} > 0)`,
    ),
    check(
      "player_performances_count_ck",
      sql`${table.processedMatchCount} >= 0`,
    ),
  ],
);

export const progressionSnapshots = pgTable(
  "progression_snapshots",
  {
    id: uuid("id").primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "restrict" }),
    discipline: matchDiscipline("discipline").notNull(),
    beforeAttributes: jsonb("before_attributes")
      .$type<Record<string, string>>()
      .notNull(),
    afterAttributes: jsonb("after_attributes")
      .$type<Record<string, string>>()
      .notNull(),
    attributeDeltas: jsonb("attribute_deltas")
      .$type<Record<string, string>>()
      .notNull(),
    beforeOvr: numeric("before_ovr", { precision: 24, scale: 12 }).notNull(),
    afterOvr: numeric("after_ovr", { precision: 24, scale: 12 }).notNull(),
    ovrDelta: numeric("ovr_delta", { precision: 24, scale: 12 }).notNull(),
    evaluationsReceived: integer("evaluations_received").notNull(),
    eligibleEvaluatorsForTarget: integer(
      "eligible_evaluators_for_target",
    ).notNull(),
    aggregatedRating: numeric("aggregated_rating", {
      precision: 24,
      scale: 12,
    }),
    participationRatio: numeric("participation_ratio", {
      precision: 24,
      scale: 12,
    }).notNull(),
    confidenceMultiplier: numeric("confidence_multiplier", {
      precision: 24,
      scale: 12,
    }).notNull(),
    rawPerformanceSignal: numeric("raw_performance_signal", {
      precision: 24,
      scale: 12,
    }),
    effectivePerformanceSignal: numeric("effective_performance_signal", {
      precision: 24,
      scale: 12,
    }),
    streakBefore: jsonb("streak_before")
      .$type<{ direction: string; count: number }>()
      .notNull(),
    streakAfter: jsonb("streak_after")
      .$type<{ direction: string; count: number }>()
      .notNull(),
    streakMultiplier: numeric("streak_multiplier", {
      precision: 24,
      scale: 12,
    }).notNull(),
    progressionBudget: numeric("progression_budget", {
      precision: 24,
      scale: 12,
    }).notNull(),
    baseDistribution: jsonb("base_distribution")
      .$type<Record<string, string>>()
      .notNull(),
    tagCoverage: numeric("tag_coverage", {
      precision: 24,
      scale: 12,
    }).notNull(),
    tagDistribution: jsonb("tag_distribution")
      .$type<Record<string, string>>()
      .notNull(),
    finalDistribution: jsonb("final_distribution")
      .$type<Record<string, string>>()
      .notNull(),
    configVersionId: uuid("config_version_id")
      .notNull()
      .references(() => progressionConfigVersions.id, {
        onDelete: "restrict",
      }),
    processingOutcome:
      progressionProcessingOutcome("processing_outcome").notNull(),
    processedAt: timestamp("processed_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("progression_snapshots_player_match_discipline_uq").on(
      table.playerId,
      table.matchId,
      table.discipline,
    ),
    index("progression_snapshots_player_processed_idx").on(
      table.playerId,
      table.processedAt,
    ),
    index("progression_snapshots_match_idx").on(table.matchId),
    check(
      "progression_snapshots_counts_ck",
      sql`${table.evaluationsReceived} >= 0 and ${table.eligibleEvaluatorsForTarget} >= ${table.evaluationsReceived}`,
    ),
  ],
);

export const playerAchievements = pgTable(
  "player_achievements",
  {
    id: uuid("id").primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    type: achievementType("type").notNull(),
    sourceMatchId: uuid("source_match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "restrict" }),
    earnedAt: timestamp("earned_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("player_achievements_player_type_uq").on(
      table.playerId,
      table.type,
    ),
    index("player_achievements_player_earned_idx").on(
      table.playerId,
      table.earnedAt,
      table.id,
    ),
    index("player_achievements_source_match_idx").on(table.sourceMatchId),
  ],
);

export const matchAwards = pgTable(
  "match_awards",
  {
    id: uuid("id").primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "restrict" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    type: matchAwardType("type").notNull(),
    awardedAt: timestamp("awarded_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("match_awards_match_player_type_uq").on(
      table.matchId,
      table.playerId,
      table.type,
    ),
    index("match_awards_player_awarded_idx").on(
      table.playerId,
      table.awardedAt,
      table.id,
    ),
    index("match_awards_match_idx").on(table.matchId),
  ],
);
