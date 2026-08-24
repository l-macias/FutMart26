import { sql } from "drizzle-orm";
import {
  boolean,
  bigint,
  check,
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
export const matchAttendanceStatus = pgEnum("match_attendance_status", [
  "PLAYED",
  "NO_SHOW",
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
      sql`(${table.kind} = 'PLAYER' and ${table.playerId} is not null and ${table.guestDisplayName} is null and ${table.guestCreatedByPlayerId} is null) or (${table.kind} = 'GUEST' and ${table.playerId} is null and ${table.guestDisplayName} is not null and btrim(${table.guestDisplayName}) <> '' and ${table.guestCreatedByPlayerId} is not null)`,
    ),
    check(
      "match_participants_attendance_evidence_ck",
      sql`(${table.attendance} is null and ${table.attendanceConfirmedAt} is null and ${table.attendanceConfirmedByPlayerId} is null) or (${table.status} = 'CONFIRMED' and ${table.attendance} is not null and ${table.attendanceConfirmedAt} is not null and ${table.attendanceConfirmedByPlayerId} is not null)`,
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
      sql`(${table.status} = 'VALID' and ${table.voidedAt} is null and ${table.voidedByPlayerId} is null) or (${table.status} = 'VOIDED' and ${table.voidedAt} is not null and ${table.voidedByPlayerId} is not null)`,
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
