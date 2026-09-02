import { z } from "zod";

export * from "./geography.js";

export const healthResponseSchema = z.object({ status: z.literal("ok") });
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const readinessResponseSchema = z.object({
  status: z.enum(["ready", "not_ready"]),
  database: z.enum(["ready", "unavailable"]),
  migrations: z.enum(["ready", "mismatch", "unavailable"]),
  mail: z.enum(["configured", "unconfigured"]),
  storage: z.enum(["ready", "configured", "disabled", "unavailable"]),
  version: z.string().nullable(),
  gitSha: z.string().nullable(),
});
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;

export const idSchema = z.uuid();
export const countryCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{2}$/.test(value), "Invalid ISO country code");
export const provinceCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(value),
    "Invalid ISO subdivision code",
  );
export const playerDisplayNameSchema = z
  .string()
  .refine(
    (value) => !/[\p{Cc}\p{Cs}]/u.test(value),
    "Display name contains control characters",
  )
  .transform((value) => value.normalize("NFKC").trim().replace(/ {2,}/g, " "))
  .refine(
    (value) => Array.from(value).length >= 2,
    "Display name must contain at least 2 characters",
  )
  .refine(
    (value) => Array.from(value).length <= 40,
    "Display name must contain at most 40 characters",
  );
export const updatePlayerRequestSchema = z
  .object({ displayName: playerDisplayNameSchema })
  .strict();
export const playerSchema = z.object({ id: idSchema, displayName: z.string() });
export const playerImageSchema = z.object({
  assetId: idSchema,
  url: z.string().startsWith("/media/"),
  version: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export const playerWithImageSchema = playerSchema.extend({
  image: playerImageSchema.nullable(),
});
export const profileVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
export const playerAccountStatusSchema = z.enum(["ACTIVE", "ANONYMIZED"]);
export const privatePlayerSchema = playerWithImageSchema.extend({
  dateOfBirth: z.iso.date().nullable(),
  age: z.number().int().nonnegative().nullable(),
  profileVisibility: profileVisibilitySchema,
  accountStatus: playerAccountStatusSchema,
});
export type PlayerImage = z.infer<typeof playerImageSchema>;
export type PlayerWithImage = z.infer<typeof playerWithImageSchema>;
export type PrivatePlayer = z.infer<typeof privatePlayerSchema>;
export const avatarCropSchema = z
  .object({
    cropX: z.coerce.number().min(0).max(1).default(0.5),
    cropY: z.coerce.number().min(0).max(1).default(0.5),
    zoom: z.coerce.number().min(1).max(3).default(1),
  })
  .strict();
export const mediaAssetParamsSchema = z.object({ assetId: idSchema });
export type UpdatePlayerRequest = z.infer<typeof updatePlayerRequestSchema>;
export const groupRoleSchema = z.enum(["OWNER", "MODERATOR", "MEMBER"]);
export const groupCapabilitySchema = z.enum([
  "GROUP_READ",
  "GROUP_MANAGE_MEMBERS",
  "GROUP_MANAGE_MODERATORS",
  "GROUP_TRANSFER_OWNERSHIP",
  "GROUP_ARCHIVE",
  "MATCH_MANAGE",
  "MATCH_MANAGE_GUESTS",
  "MATCH_COMPLETE",
  "MATCH_CONFIRM_ROSTER",
  "MATCH_MANAGE_STATS",
  "MATCH_MANAGE_OBSERVER",
  "MATCH_MANAGE_VOTING",
  "MATCH_MANAGE_TEAMS",
  "GROUP_MANAGE_INVITATIONS",
  "GROUP_MANAGE_GUEST_POLICY",
  "GROUP_MANAGE_GUESTS",
  "MATCH_GUEST_OVERRIDE",
]);
export const groupStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
export const membershipStatusSchema = z.enum([
  "ACTIVE",
  "LEFT",
  "REMOVED",
  "BLOCKED",
]);
export const groupSchema = z.object({
  id: idSchema,
  name: z.string(),
  status: groupStatusSchema,
  visibility: profileVisibilitySchema,
  role: groupRoleSchema,
  capabilities: z.array(groupCapabilitySchema),
});
export const membershipSchema = z.object({
  id: idSchema,
  player: playerSchema,
  role: groupRoleSchema,
  capabilities: z.array(groupCapabilitySchema),
  status: membershipStatusSchema,
  joinedAt: z.iso.datetime(),
});
export const createGroupRequestSchema = z
  .object({ name: z.string().trim().min(1).max(100) })
  .strict();
export const groupNameSchema = z
  .string()
  .refine(
    (value) => !/[\p{Cc}\p{Cs}]/u.test(value),
    "Group name contains control characters",
  )
  .transform((value) => value.normalize("NFKC").trim().replace(/ {2,}/g, " "))
  .refine((value) => Array.from(value).length >= 1, "Group name is required")
  .refine(
    (value) => Array.from(value).length <= 100,
    "Group name must contain at most 100 characters",
  );
export const updateGroupRequestSchema = z
  .object({ name: groupNameSchema })
  .strict();
export const updateGroupPrivacyRequestSchema = z
  .object({ visibility: profileVisibilitySchema })
  .strict();
export const groupMembersQuerySchema = z
  .object({
    includeBlocked: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .strict();
export const ownershipTransferRequestSchema = z
  .object({ targetPlayerId: idSchema })
  .strict();
export const groupIdParamsSchema = z.object({ groupId: idSchema });
export const groupMemberParamsSchema = z.object({
  groupId: idSchema,
  playerId: idSchema,
});
export const invitationTypeSchema = z.enum(["SINGLE_USE", "TIME_LIMITED"]);
export const createInvitationRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SINGLE_USE") }).strict(),
  z
    .object({
      type: z.literal("TIME_LIMITED"),
      expiresAt: z.iso.datetime(),
      maxUses: z.number().int().positive().nullable().optional(),
    })
    .strict(),
]);
export const invitationTokenParamsSchema = z.object({
  token: z.string().min(32).max(200),
});
export const invitationParamsSchema = z.object({
  groupId: idSchema,
  invitationId: idSchema,
});

export const footballRoleSchema = z.enum([
  "LIBRE",
  "DEFENSIVO",
  "MEDIO",
  "OFENSIVO",
  "PORTERO",
]);
export const footballStrengthSchema = z.enum([
  "VELOCIDAD",
  "PASE",
  "REGATE",
  "REMATE",
  "DEFENSA",
  "FISICO",
]);
export const footballPreferencesRequestSchema = z
  .object({
    preferredRoles: z.array(footballRoleSchema).max(2),
    willingToPlayGoalkeeper: z.boolean(),
    strengths: z.array(footballStrengthSchema).max(3),
  })
  .superRefine((value, context) => {
    if (new Set(value.preferredRoles).size !== value.preferredRoles.length)
      context.addIssue({
        code: "custom",
        message: "Duplicate preferred roles",
      });
    if (new Set(value.strengths).size !== value.strengths.length)
      context.addIssue({ code: "custom", message: "Duplicate strengths" });
    if (
      value.preferredRoles.includes("PORTERO") &&
      !value.willingToPlayGoalkeeper
    )
      context.addIssue({
        code: "custom",
        message: "PORTERO requires goalkeeper willingness",
      });
  });
export const footballPreferencesSchema = z.object({
  configured: z.boolean(),
  discipline: z.literal("F5"),
  preferredRoles: z.array(footballRoleSchema).max(2),
  willingToPlayGoalkeeper: z.boolean(),
  strengths: z.array(footballStrengthSchema).max(3),
});

export const playerF5PerformanceSchema = z.object({
  discipline: z.literal("F5"),
  initialized: z.boolean(),
  overall: z.number(),
  ratingProfile: z.enum(["LIBRE", "DEFENSIVO", "MEDIO", "OFENSIVO"]),
  attributes: z.object({
    VELOCIDAD: z.number(),
    PASE: z.number(),
    REGATE: z.number(),
    REMATE: z.number(),
    DEFENSA: z.number(),
    FISICO: z.number(),
  }),
  processedMatchCount: z.number().int().nonnegative(),
  lastProcessedScheduledAt: z.iso.datetime().nullable(),
});

export const progressionDecimalSchema = z.string().regex(/^-?\d+(?:\.\d+)?$/);
export const progressionAttributeValuesSchema = z.object({
  VELOCIDAD: progressionDecimalSchema,
  PASE: progressionDecimalSchema,
  REGATE: progressionDecimalSchema,
  REMATE: progressionDecimalSchema,
  DEFENSA: progressionDecimalSchema,
  FISICO: progressionDecimalSchema,
});
export const progressionStreakSchema = z.object({
  direction: z.enum(["POSITIVE", "NEGATIVE", "NONE"]),
  count: z.number().int().nonnegative(),
});
const progressionRevealContextSchema = z.object({
  matchId: idSchema,
  discipline: z.literal("F5"),
  scheduledAt: z.iso.datetime(),
  group: z.object({ id: idSchema, name: z.string() }),
  result: z.object({
    teamAGoals: z.number().int().nonnegative(),
    teamBGoals: z.number().int().nonnegative(),
    winner: z.enum(["TEAM_A", "TEAM_B", "DRAW"]),
  }),
  player: z.object({ displayName: z.string() }),
});
export const progressionSnapshotSchema = z.object({
  processingOutcome: z.enum(["APPLIED", "NEUTRAL", "NO_EVIDENCE"]),
  processedAt: z.iso.datetime(),
  configVersion: z.string(),
  aggregatedRating: progressionDecimalSchema.nullable(),
  eligibleEvaluationCount: z.number().int().nonnegative(),
  receivedEvaluationCount: z.number().int().nonnegative(),
  participationRatio: progressionDecimalSchema,
  confidenceMultiplier: progressionDecimalSchema,
  overall: z.object({
    before: progressionDecimalSchema,
    after: progressionDecimalSchema,
    delta: progressionDecimalSchema,
  }),
  attributes: z.object({
    before: progressionAttributeValuesSchema,
    after: progressionAttributeValuesSchema,
    delta: progressionAttributeValuesSchema,
  }),
  streak: z.object({
    before: progressionStreakSchema,
    after: progressionStreakSchema,
  }),
});
export const achievementTypeSchema = z.enum([
  "FIRST_MATCH",
  "FIVE_MATCHES",
  "TEN_MATCHES",
  "FIRST_GOAL",
  "HAT_TRICK",
  "FIRST_ASSIST",
  "HIGH_RATING",
]);
export const awardTypeSchema = z.enum([
  "TOP_RATED",
  "TOP_SCORER",
  "TOP_ASSIST",
]);
export const earnedAchievementSchema = z.object({
  type: achievementTypeSchema,
  earnedAt: z.iso.datetime(),
  sourceMatchId: idSchema,
  title: z.string(),
  description: z.string(),
});
export const earnedMatchAwardSchema = z.object({
  type: awardTypeSchema,
  matchId: idSchema,
  awardedAt: z.iso.datetime(),
  title: z.string(),
  description: z.string(),
  context: z.object({
    group: z.object({ id: idSchema, name: z.string() }),
    scheduledAt: z.iso.datetime(),
  }),
});
export const rewardsResponseSchema = z.object({
  achievements: z.array(earnedAchievementSchema),
  recentAwards: z.array(earnedMatchAwardSchema),
});
export type RewardsResponse = z.infer<typeof rewardsResponseSchema>;
export const publicPlayerParamsSchema = z.object({ playerId: idSchema });
export const playerSearchQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(100),
    limit: z.coerce.number().int().min(1).max(20).default(10),
  })
  .strict();
const publicAchievementSchema = earnedAchievementSchema.omit({
  sourceMatchId: true,
});
const publicAwardSchema = z.object({
  type: awardTypeSchema,
  awardedAt: z.iso.datetime(),
  scheduledAt: z.iso.datetime(),
  title: z.string(),
  description: z.string(),
});
const publicPerformanceSchema = playerF5PerformanceSchema.pick({
  discipline: true,
  initialized: true,
  overall: true,
  attributes: true,
  processedMatchCount: true,
});
const visiblePublicPlayerProfileSchema = z.object({
  visibility: z.literal("PUBLIC"),
  player: playerWithImageSchema,
  performance: publicPerformanceSchema,
  footballProfile: footballPreferencesSchema
    .pick({
      preferredRoles: true,
      willingToPlayGoalkeeper: true,
      strengths: true,
    })
    .nullable(),
  rewards: z.object({
    achievements: z.array(publicAchievementSchema),
    recentAwards: z.array(publicAwardSchema).max(5),
  }),
  summary: z.object({
    totalGoals: z.number().int().nonnegative(),
    totalAssists: z.number().int().nonnegative(),
    achievementCount: z.number().int().nonnegative(),
    awardCount: z.number().int().nonnegative(),
  }),
  isCurrentPlayer: z.boolean(),
});
const privatePublicPlayerProfileSchema = z.object({
  visibility: z.literal("PRIVATE"),
  player: playerSchema,
  isCurrentPlayer: z.boolean(),
});
export const publicPlayerProfileSchema = z.discriminatedUnion("visibility", [
  visiblePublicPlayerProfileSchema,
  privatePublicPlayerProfileSchema,
]);
export type PublicPlayerProfile = z.infer<typeof publicPlayerProfileSchema>;
export const playerSearchResponseSchema = z.object({
  items: z.array(
    z.object({
      player: playerSchema,
      performance: z.object({
        overall: z.number().nullable(),
        processedMatchCount: z.number().int().nonnegative(),
      }),
      isCurrentPlayer: z.boolean(),
    }),
  ),
});
export type PlayerSearchResponse = z.infer<typeof playerSearchResponseSchema>;

export const TERMS_VERSION = "v1";
export const PRIVACY_VERSION = "v1";
export const complianceStateSchema = z.enum([
  "MISSING_DATE_OF_BIRTH",
  "UNDERAGE",
  "POLICIES_REQUIRED",
  "FOOTBALL_PROFILE_REQUIRED",
  "READY",
  "ACCOUNT_ANONYMIZED",
]);
export const complianceStatusSchema = z.object({
  state: complianceStateSchema,
  hasDateOfBirth: z.boolean(),
  isAdult: z.boolean().nullable(),
  age: z.number().int().nonnegative().nullable(),
  acceptedTerms: z.boolean(),
  acceptedPrivacy: z.boolean(),
  requiredTermsVersion: z.literal(TERMS_VERSION),
  requiredPrivacyVersion: z.literal(PRIVACY_VERSION),
});
export const completeComplianceRequestSchema = z
  .object({
    dateOfBirth: z.iso.date().optional(),
    acceptTerms: z.literal(true),
    acceptPrivacy: z.literal(true),
  })
  .strict();
export const updatePlayerPrivacyRequestSchema = z
  .object({ profileVisibility: profileVisibilitySchema })
  .strict();
export const abuseReportTargetTypeSchema = z.enum(["PLAYER", "GROUP", "MATCH"]);
export const abuseReportReasonSchema = z.enum([
  "HARASSMENT",
  "INAPPROPRIATE_CONTENT",
  "IMPERSONATION",
  "SPAM",
  "SAFETY",
  "OTHER",
]);
export const createAbuseReportRequestSchema = z
  .object({
    targetType: abuseReportTargetTypeSchema,
    targetId: idSchema,
    reason: abuseReportReasonSchema,
    comment: z.string().trim().min(1).max(1000).nullable().optional(),
  })
  .strict();
export const abuseReportResponseSchema = z.object({
  id: idSchema,
  status: z.literal("OPEN"),
});

export const connectionStateSchema = z.enum([
  "NONE",
  "PENDING_SENT",
  "PENDING_RECEIVED",
  "CONNECTED",
]);
export const connectionTargetParamsSchema = z.object({ playerId: idSchema });
export const connectionRequestSchema = z
  .object({ playerId: idSchema })
  .strict();
export const connectionListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(500).optional(),
  })
  .strict();
export const connectionRequestsQuerySchema = connectionListQuerySchema.extend({
  direction: z.enum(["incoming", "outgoing"]),
});
export const connectionStatusSchema = z.object({
  state: connectionStateSchema,
  requestedAt: z.iso.datetime().optional(),
  connectedAt: z.iso.datetime().optional(),
});
const connectionPlayerSchema = z.object({
  player: playerSchema,
  overall: z.number().nullable(),
  processedMatchCount: z.number().int().nonnegative(),
});
export const connectionListResponseSchema = z.object({
  items: z.array(
    connectionPlayerSchema.extend({ connectedAt: z.iso.datetime() }),
  ),
  nextCursor: z.string().nullable(),
});
export const connectionRequestListResponseSchema = z.object({
  items: z.array(
    connectionPlayerSchema.extend({ requestedAt: z.iso.datetime() }),
  ),
  nextCursor: z.string().nullable(),
});
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type ConnectionListResponse = z.infer<
  typeof connectionListResponseSchema
>;
export type ConnectionRequestListResponse = z.infer<
  typeof connectionRequestListResponseSchema
>;

export const directedInvitationStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "REVOKED",
  "EXPIRED",
]);
export const directedInvitationRequestSchema = z
  .object({ playerId: idSchema })
  .strict();
export const directedInvitationParamsSchema = z.object({
  invitationId: idSchema,
});
export const groupDirectedInvitationParamsSchema = z.object({
  groupId: idSchema,
  invitationId: idSchema,
});
export const matchDirectedInvitationParamsSchema = z.object({
  matchId: idSchema,
  invitationId: idSchema,
});
const directedInviterSchema = z.object({
  id: idSchema,
  displayName: z.string(),
});
export const groupDirectedInvitationSchema = z.object({
  id: idSchema,
  status: directedInvitationStatusSchema,
  group: z.object({ id: idSchema, name: z.string() }),
  invitedBy: directedInviterSchema,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export const managedGroupDirectedInvitationSchema = z.object({
  id: idSchema,
  status: directedInvitationStatusSchema,
  invitedPlayer: playerSchema,
  invitedByPlayerId: idSchema,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export const matchDirectedInvitationSchema = z.object({
  id: idSchema,
  status: directedInvitationStatusSchema,
  match: z.object({
    id: idSchema,
    groupId: idSchema,
    groupName: z.string(),
    scheduledAt: z.iso.datetime(),
    locationText: z.string(),
  }),
  invitedBy: directedInviterSchema,
  createdAt: z.iso.datetime(),
});
export const directedInvitationInboxSchema = z.object({
  groupInvitations: z.array(groupDirectedInvitationSchema),
  matchInvitations: z.array(matchDirectedInvitationSchema),
});
export const groupDirectedInvitationAcceptSchema = z.object({
  outcome: z.enum(["JOINED", "ALREADY_MEMBER"]),
  groupId: idSchema,
});
export const matchDirectedInvitationAcceptSchema = z.object({
  outcome: z.enum(["CONFIRMED", "WAITLISTED"]),
  matchId: idSchema,
  participantId: idSchema,
  admissionOrder: z.string(),
});
export const groupDirectedInvitationCreateResponseSchema = z.discriminatedUnion(
  "outcome",
  [
    z.object({ outcome: z.literal("ALREADY_MEMBER"), groupId: idSchema }),
    z.object({
      outcome: z.literal("INVITED"),
      invitation: z.object({
        id: idSchema,
        status: directedInvitationStatusSchema,
        createdAt: z.iso.datetime(),
        expiresAt: z.iso.datetime(),
      }),
    }),
  ],
);
export const matchDirectedInvitationCreateResponseSchema = z.discriminatedUnion(
  "outcome",
  [
    z.object({
      outcome: z.literal("ALREADY_PARTICIPATING"),
      matchId: idSchema,
    }),
    z.object({
      outcome: z.literal("INVITED"),
      invitation: z.object({
        id: idSchema,
        status: directedInvitationStatusSchema,
        createdAt: z.iso.datetime(),
      }),
    }),
  ],
);
export type DirectedInvitationInbox = z.infer<
  typeof directedInvitationInboxSchema
>;
const matchRewardsSchema = z.object({
  achievements: z.array(earnedAchievementSchema),
  awards: z.array(earnedMatchAwardSchema),
});
export const progressionRevealSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("VOTING_OPEN"),
    votingStartsAt: z.iso.datetime(),
    votingClosesAt: z.iso.datetime(),
  }),
  z.object({
    status: z.literal("PROGRESSION_PENDING"),
    reason: z.enum([
      "VOTING_NOT_STARTED",
      "CLOSURE_INCOMPLETE",
      "EARLIER_MATCH_PENDING",
      "READY_TO_MATERIALIZE",
    ]),
    votingStartsAt: z.iso.datetime().nullable(),
    votingClosesAt: z.iso.datetime().nullable(),
  }),
  z.object({
    status: z.literal("AVAILABLE"),
    context: progressionRevealContextSchema,
    snapshot: progressionSnapshotSchema,
    rewards: matchRewardsSchema,
  }),
]);
export type ProgressionRevealResponse = z.infer<typeof progressionRevealSchema>;

export const progressionHistoryQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(500).optional(),
  })
  .strict();
export const progressionHistoryEntrySchema = z.object({
  context: progressionRevealContextSchema.omit({ player: true }),
  snapshot: progressionSnapshotSchema,
});
export const progressionHistoryResponseSchema = z.object({
  items: z.array(progressionHistoryEntrySchema),
  nextCursor: z.string().nullable(),
});
export type ProgressionHistoryEntry = z.infer<
  typeof progressionHistoryEntrySchema
>;
export type ProgressionHistoryResponse = z.infer<
  typeof progressionHistoryResponseSchema
>;

export const groupRankingQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(500).optional(),
  })
  .strict();
const groupRankingRecentSchema = z.object({
  matchId: idSchema,
  ovrDelta: progressionDecimalSchema,
  processingOutcome: z.enum(["APPLIED", "NEUTRAL", "NO_EVIDENCE"]),
});
export const groupRankingItemSchema = z.object({
  position: z.number().int().positive(),
  player: z.object({ id: idSchema, displayName: z.string() }),
  performance: z.object({
    overall: progressionDecimalSchema,
    processedMatchCount: z.number().int().positive(),
  }),
  recent: groupRankingRecentSchema.nullable(),
  isCurrentPlayer: z.boolean(),
});
export const groupRankingResponseSchema = z.object({
  group: z.object({ id: idSchema, name: z.string() }),
  discipline: z.literal("F5"),
  items: z.array(groupRankingItemSchema),
  me: z.discriminatedUnion("ranked", [
    z.object({ ranked: z.literal(false) }),
    z.object({
      ranked: z.literal(true),
      position: z.number().int().positive(),
      overall: progressionDecimalSchema,
      processedMatchCount: z.number().int().positive(),
    }),
  ]),
  nextCursor: z.string().nullable(),
});
export type GroupRankingResponse = z.infer<typeof groupRankingResponseSchema>;

export const territorialRankingQuerySchema = groupRankingQuerySchema;
export const venueRankingParamsSchema = z.object({ venueId: idSchema });
export const cityRankingParamsSchema = z.object({
  cityKey: z.string().min(1).max(500),
});
export const provinceRankingParamsSchema = z.object({
  provinceKey: z.string().min(1).max(500),
});
export const countryRankingParamsSchema = z.object({
  countryKey: z.string().min(1).max(500),
});
const territorialRankingItemSchema = z.object({
  position: z.number().int().positive(),
  player: z.object({ id: idSchema, displayName: z.string() }),
  performance: z.object({
    overall: progressionDecimalSchema,
    processedMatchCount: z.number().int().positive(),
  }),
  scopeStats: z.object({
    matchesPlayed: z.number().int().positive(),
    lastPlayedAt: z.iso.datetime(),
  }),
  isCurrentPlayer: z.boolean(),
});
const territorialRankingMeSchema = z.discriminatedUnion("ranked", [
  z.object({ ranked: z.literal(false) }),
  z.object({
    ranked: z.literal(true),
    position: z.number().int().positive(),
    overall: progressionDecimalSchema,
    processedMatchCount: z.number().int().positive(),
    scopeStats: z.object({
      matchesPlayed: z.number().int().positive(),
      lastPlayedAt: z.iso.datetime(),
    }),
  }),
]);
export const territorialRankingResponseSchema = z.object({
  scope: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("VENUE"),
      id: idSchema,
      name: z.string(),
      city: z.string(),
      cityKey: z.string(),
      province: z
        .object({
          key: z.string(),
          code: provinceCodeSchema,
          name: z.string(),
        })
        .nullable(),
      country: z
        .object({
          key: z.string(),
          code: countryCodeSchema,
          name: z.string(),
        })
        .nullable(),
    }),
    z.object({
      type: z.literal("CITY"),
      key: z.string(),
      name: z.string(),
      province: z
        .object({
          key: z.string(),
          code: provinceCodeSchema,
          name: z.string(),
        })
        .nullable(),
      country: z
        .object({
          key: z.string(),
          code: countryCodeSchema,
          name: z.string(),
        })
        .nullable(),
    }),
    z.object({
      type: z.literal("PROVINCE"),
      key: z.string(),
      code: provinceCodeSchema,
      name: z.string(),
      country: z.object({
        key: z.string(),
        code: countryCodeSchema,
        name: z.string(),
      }),
    }),
    z.object({
      type: z.literal("COUNTRY"),
      key: z.string(),
      code: countryCodeSchema,
      name: z.string(),
    }),
  ]),
  discipline: z.literal("F5"),
  items: z.array(territorialRankingItemSchema),
  me: territorialRankingMeSchema,
  nextCursor: z.string().nullable(),
});
export type TerritorialRankingResponse = z.infer<
  typeof territorialRankingResponseSchema
>;

export const globalRankingQuerySchema = groupRankingQuerySchema;
export const globalRankingResponseSchema = z.object({
  scope: z.object({ type: z.literal("GLOBAL"), label: z.literal("Global") }),
  discipline: z.literal("F5"),
  items: z.array(
    z.object({
      position: z.number().int().positive(),
      player: z.object({ id: idSchema, displayName: z.string() }),
      performance: z.object({
        overall: progressionDecimalSchema,
        processedMatchCount: z.number().int().positive(),
      }),
      isCurrentPlayer: z.boolean(),
    }),
  ),
  me: z.discriminatedUnion("ranked", [
    z.object({ ranked: z.literal(false) }),
    z.object({
      ranked: z.literal(true),
      position: z.number().int().positive(),
      overall: progressionDecimalSchema,
      processedMatchCount: z.number().int().positive(),
    }),
  ]),
  nextCursor: z.string().nullable(),
});
export type GlobalRankingResponse = z.infer<typeof globalRankingResponseSchema>;

export const discoveryPeriodSchema = z.enum(["7d", "30d"]);
export const discoveryQuerySchema = z
  .object({
    period: discoveryPeriodSchema.default("30d"),
    limit: z.coerce.number().int().min(1).max(10).default(5),
  })
  .strict();
export type DiscoveryPeriod = z.infer<typeof discoveryPeriodSchema>;

const discoveryPlayerSchema = z.object({
  player: z.object({ id: idSchema, displayName: z.string() }),
  overall: progressionDecimalSchema,
});
const featuredPlayer = <T extends string>(type: T) =>
  discoveryPlayerSchema.extend({
    metric: z.object({
      type: z.literal(type),
      value: z.number().nonnegative(),
    }),
  });
export const featuredPlayersResponseSchema = z.object({
  period: discoveryPeriodSchema,
  currentTopOvr: z.array(featuredPlayer("TOP_OVR")),
  topScorers: z.array(featuredPlayer("TOP_SCORERS")),
  topAssists: z.array(featuredPlayer("TOP_ASSISTS")),
  mostAwarded: z.array(featuredPlayer("MOST_AWARDED")),
});
export type FeaturedPlayersResponse = z.infer<
  typeof featuredPlayersResponseSchema
>;

export const risingPlayersResponseSchema = z.object({
  period: discoveryPeriodSchema,
  items: z.array(
    z.object({
      player: z.object({ id: idSchema, displayName: z.string() }),
      currentOverall: progressionDecimalSchema,
      startOverall: progressionDecimalSchema,
      netOvrGain: progressionDecimalSchema,
      matchesProcessedInPeriod: z.number().int().min(2),
    }),
  ),
});
export type RisingPlayersResponse = z.infer<typeof risingPlayersResponseSchema>;

const featuredGroup = <T extends string>(type: T) =>
  z.object({
    group: z.object({ id: idSchema, name: z.string() }),
    metric: z.object({
      type: z.literal(type),
      value: z.number().nonnegative(),
    }),
  });
export const featuredGroupsResponseSchema = z.object({
  period: discoveryPeriodSchema,
  mostActive: z.array(featuredGroup("MOST_ACTIVE")),
  mostActivePlayers: z.array(featuredGroup("MOST_ACTIVE_PLAYERS")),
  mostGoals: z.array(featuredGroup("MOST_GOALS")),
});
export type FeaturedGroupsResponse = z.infer<
  typeof featuredGroupsResponseSchema
>;

export const globalSearchQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(100),
    limit: z.coerce.number().int().min(1).max(10).default(5),
  })
  .strict();
export const globalSearchResponseSchema = z.object({
  players: playerSearchResponseSchema.shape.items,
  groups: z.array(z.object({ id: idSchema, name: z.string() })),
});
export type GlobalSearchResponse = z.infer<typeof globalSearchResponseSchema>;

export const groupActivityQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(500).optional(),
  })
  .strict();
const groupActivityBaseSchema = z.object({
  stableId: z.string(),
  occurredAt: z.iso.datetime(),
  matchId: idSchema,
  title: z.string(),
  body: z.string(),
  target: z.object({ href: z.string().startsWith("/") }),
});
export const groupActivityEventSchema = z.discriminatedUnion("eventType", [
  groupActivityBaseSchema.extend({
    eventType: z.literal("MATCH_FINISHED"),
    result: z.object({
      teamAGoals: z.number().int().nonnegative(),
      teamBGoals: z.number().int().nonnegative(),
    }),
  }),
  groupActivityBaseSchema.extend({
    eventType: z.literal("MATCH_CANCELLED"),
  }),
  groupActivityBaseSchema.extend({
    eventType: z.literal("ACHIEVEMENT_EARNED"),
    player: z.object({ id: idSchema, displayName: z.string() }),
    achievementType: achievementTypeSchema,
  }),
  groupActivityBaseSchema.extend({
    eventType: z.literal("AWARD_EARNED"),
    player: z.object({ id: idSchema, displayName: z.string() }),
    awardType: awardTypeSchema,
  }),
  groupActivityBaseSchema.extend({
    eventType: z.literal("PROGRESSION_APPLIED"),
    player: z.object({ id: idSchema, displayName: z.string() }),
    ovrDelta: progressionDecimalSchema,
  }),
]);
export const groupActivityResponseSchema = z.object({
  items: z.array(groupActivityEventSchema),
  nextCursor: z.string().nullable(),
});
export type GroupActivityResponse = z.infer<typeof groupActivityResponseSchema>;

export const groupStatsSchema = z.object({
  matches: z.object({
    totalFinished: z.number().int().nonnegative(),
    totalCancelled: z.number().int().nonnegative(),
    lastPlayedAt: z.iso.datetime().nullable(),
  }),
  goals: z.object({
    total: z.number().int().nonnegative(),
    averagePerPlayedMatch: progressionDecimalSchema.nullable(),
  }),
  participation: z.object({
    activePlayerCount: z.number().int().nonnegative(),
    rankedPlayerCount: z.number().int().nonnegative(),
    averageProcessedMatchesPerRankedPlayer: progressionDecimalSchema.nullable(),
  }),
  performance: z.object({
    averageOvr: progressionDecimalSchema.nullable(),
    highestOvr: progressionDecimalSchema.nullable(),
    lowestOvr: progressionDecimalSchema.nullable(),
  }),
  rewards: z.object({
    totalAwardsEarned: z.number().int().nonnegative(),
    totalAchievementsEarnedFromGroupMatches: z.number().int().nonnegative(),
  }),
});
export type GroupStatsResponse = z.infer<typeof groupStatsSchema>;

export const notificationTypeSchema = z.enum([
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
export const notificationListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(500).optional(),
  })
  .strict();
export const notificationParamsSchema = z.object({
  notificationId: idSchema,
});
export const notificationSchema = z.object({
  id: idSchema,
  type: notificationTypeSchema,
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
  title: z.string(),
  body: z.string(),
  target: z.object({ href: z.string().startsWith("/") }),
});
export const notificationListResponseSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
});
export const notificationUnreadCountSchema = z.object({
  count: z.number().int().nonnegative(),
});
export type NotificationListResponse = z.infer<
  typeof notificationListResponseSchema
>;

export const invitationEffectiveStatusSchema = z.enum([
  "ACTIVE",
  "USED",
  "EXPIRED",
  "REVOKED",
  "EXHAUSTED",
]);
export const invitationSchema = z.object({
  id: idSchema,
  groupId: idSchema,
  type: invitationTypeSchema,
  status: invitationEffectiveStatusSchema,
  expiresAt: z.iso.datetime().nullable(),
  maxUses: z.number().int().positive().nullable(),
  useCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable(),
});
export const createdInvitationSchema = invitationSchema.extend({
  token: z.string().min(32),
});
export const listedInvitationSchema = invitationSchema.extend({
  createdByDisplayName: z.string(),
});
export const invitationPreviewSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false) }),
  z.object({ available: z.literal(true), groupName: z.string() }),
]);
export const invitationJoinSchema = z.object({
  outcome: z.enum(["JOINED", "ALREADY_MEMBER"]),
  groupId: idSchema,
});

export const groupGuestStatusSchema = z.enum(["ACTIVE", "ARCHIVED", "DELETED"]);
export const createGroupGuestRequestSchema = z
  .object({ displayName: z.string().trim().min(1).max(100) })
  .strict();
export const updateGroupGuestRequestSchema = createGroupGuestRequestSchema;
export const groupGuestParamsSchema = z.object({
  groupId: idSchema,
  guestId: idSchema,
});
export const groupGuestListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
export const groupGuestSchema = z.object({
  id: idSchema,
  displayName: z.string(),
  status: groupGuestStatusSchema,
  createdAt: z.coerce.date(),
  matchesPlayed: z.number().int().nonnegative(),
  lastParticipationAt: z.coerce.date().nullable(),
});
export const guestPolicySchema = z.object({
  guestsEnabled: z.boolean(),
  defaultGuestAllowancePerMember: z.number().int().nonnegative(),
  effectiveAllowance: z.number().int().nonnegative().nullable(),
  canOverride: z.boolean(),
});
export const guestPolicyRequestSchema = z
  .object({
    guestsEnabled: z.boolean().optional(),
    defaultGuestAllowancePerMember: z.number().int().nonnegative().optional(),
  })
  .strict();
export const guestAllowanceRequestSchema = z
  .object({ guestAllowanceOverride: z.number().int().nonnegative().nullable() })
  .strict();
export const moderatorCapabilitiesRequestSchema = z
  .object({ capabilities: z.array(groupCapabilitySchema).max(20) })
  .superRefine((value, context) => {
    if (new Set(value.capabilities).size !== value.capabilities.length)
      context.addIssue({ code: "custom", message: "Duplicate capabilities" });
  });
export type PlayerResponse = z.infer<typeof playerSchema>;
export type GroupResponse = z.infer<typeof groupSchema>;
export type MembershipResponse = z.infer<typeof membershipSchema>;

export const matchDisciplineSchema = z.literal("F5");
export const matchStatusSchema = z.enum([
  "DRAFT",
  "OPEN",
  "STARTED",
  "FINISHED",
  "CANCELLED",
]);
export const matchParticipantStatusSchema = z.enum([
  "CONFIRMED",
  "WAITLISTED",
  "CANCELLED",
]);
export const matchParticipantKindSchema = z.enum(["PLAYER", "GUEST"]);
export const venueSchema = z.object({
  id: idSchema,
  displayName: z.string(),
  city: z.string(),
  cityKey: z.string().min(1).max(500),
  countryCode: countryCodeSchema.nullable(),
  provinceCode: provinceCodeSchema.nullable(),
  countryName: z.string().nullable(),
  provinceName: z.string().nullable(),
  countryKey: z.string().nullable(),
  provinceKey: z.string().nullable(),
  address: z.string().nullable(),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
});
export const courtSchema = z.object({
  id: idSchema,
  venueId: idSchema,
  displayName: z.string(),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
});
export const venueSearchQuerySchema = z.object({
  query: z.string().trim().min(2).max(100),
  city: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
export const createVenueRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    city: z.string().trim().min(1).max(100),
    address: z.string().trim().max(200).nullable().optional(),
    countryCode: countryCodeSchema.nullable().optional(),
    provinceCode: provinceCodeSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.provinceCode && !value.countryCode)
      context.addIssue({
        code: "custom",
        path: ["countryCode"],
        message: "Country is required when province is provided",
      });
    if (
      value.countryCode &&
      value.provinceCode &&
      !value.provinceCode.startsWith(`${value.countryCode}-`)
    )
      context.addIssue({
        code: "custom",
        path: ["provinceCode"],
        message: "Province must belong to country",
      });
  });
export const createCourtRequestSchema = z
  .object({ displayName: z.string().trim().min(1).max(100) })
  .strict();
export const venueIdParamsSchema = z.object({ venueId: idSchema });
export const groupMatchDefaultsSchema = z.object({
  discipline: matchDisciplineSchema,
  defaultVenueId: idSchema.nullable(),
  defaultCourtId: idSchema.nullable(),
  defaultLocationText: z.string().nullable(),
  defaultStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  defaultDurationMinutes: z.number().int().positive(),
  defaultCapacity: z.number().int().positive(),
  defaultVenue: venueSchema.nullable(),
  defaultCourt: courtSchema.nullable(),
});
export const updateGroupMatchDefaultsRequestSchema = groupMatchDefaultsSchema
  .omit({ discipline: true })
  .partial()
  .extend({ discipline: matchDisciplineSchema.optional() })
  .strict();
const matchFieldsSchema = z.object({
  scheduledAt: z.iso.datetime(),
  durationMinutes: z.number().int().positive(),
  capacity: z.number().int().positive(),
  locationText: z.string().trim().min(1).max(200),
  venueId: idSchema.nullable().optional(),
  courtId: idSchema.nullable().optional(),
});
export const createMatchRequestSchema = matchFieldsSchema
  .extend({
    discipline: matchDisciplineSchema.optional().default("F5"),
    saveAsDefaults: z.boolean().optional().default(false),
    defaultStartTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
  })
  .strict();
export const updateMatchRequestSchema = matchFieldsSchema.partial().strict();
export const matchIdParamsSchema = z.object({ matchId: idSchema });
export const matchGuestParamsSchema = z.object({
  matchId: idSchema,
  guestId: idSchema,
});
export const createGuestRequestSchema = z
  .object({ groupGuestId: idSchema })
  .strict();
export const administrativeCancelParticipantRequestSchema = z
  .object({ participantId: idSchema })
  .strict();
export const swapWaitlistParticipantRequestSchema = z
  .object({
    promoteParticipantId: idSchema,
    demoteParticipantId: idSchema,
  })
  .strict();
export const recruitmentEffectiveStatusSchema = z.enum([
  "CLOSED",
  "OPEN",
  "FULL",
]);
export const recruitmentNeedSchema = z.object({
  role: footballRoleSchema,
  quantity: z.number().int().positive(),
});
export const matchRecruitmentSchema = z.object({
  enabled: z.boolean(),
  effectiveStatus: recruitmentEffectiveStatusSchema,
  openSpots: z.number().int().nonnegative(),
  needs: z.array(recruitmentNeedSchema),
});
export const replaceMatchRecruitmentRequestSchema = z
  .object({
    enabled: z.boolean(),
    needs: z.array(recruitmentNeedSchema).max(5),
  })
  .superRefine((value, context) => {
    const roles = new Set<string>();
    for (const need of value.needs) {
      if (roles.has(need.role))
        context.addIssue({
          code: "custom",
          path: ["needs"],
          message: "Recruitment roles must be unique",
        });
      roles.add(need.role);
    }
  });
export const recruitmentOpportunitiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(500).optional(),
});
export const recruitmentOpportunitySchema = z.object({
  matchId: idSchema,
  group: z.object({ id: idSchema, name: z.string() }),
  scheduledAt: z.iso.datetime(),
  locationText: z.string(),
  venue: venueSchema.nullable(),
  openSpots: z.number().int().positive(),
  needs: z.array(recruitmentNeedSchema),
  matchesMyProfile: z.boolean(),
});
export const recruitmentOpportunitiesResponseSchema = z.object({
  items: z.array(recruitmentOpportunitySchema),
  nextCursor: z.string().nullable(),
});
export const matchSchema = z.object({
  id: idSchema,
  groupId: idSchema,
  discipline: matchDisciplineSchema,
  status: matchStatusSchema,
  scheduledAt: z.iso.datetime(),
  durationMinutes: z.number().int(),
  capacity: z.number().int(),
  locationText: z.string(),
  venueId: idSchema.nullable(),
  courtId: idSchema.nullable(),
  venue: venueSchema.nullable(),
  court: courtSchema.nullable(),
  rosterLockedAt: z.iso.datetime().nullable(),
  confirmedCount: z.number().int().nonnegative(),
  waitlistCount: z.number().int().nonnegative(),
  availableSpots: z.number().int().nonnegative(),
  recruitment: matchRecruitmentSchema,
  canManage: z.boolean(),
  canManageGuests: z.boolean(),
  canComplete: z.boolean(),
  canClose: z.boolean(),
  scheduleChange: z
    .object({
      previousScheduledAt: z.iso.datetime(),
      changedAt: z.iso.datetime(),
    })
    .nullable(),
});
export const personalMatchSchema = z.object({
  id: idSchema,
  group: z.object({ id: idSchema, name: z.string() }),
  discipline: matchDisciplineSchema,
  status: matchStatusSchema,
  scheduledAt: z.iso.datetime(),
  durationMinutes: z.number().int().positive(),
  capacity: z.number().int().positive(),
  locationText: z.string(),
  venue: venueSchema.nullable(),
  court: courtSchema.nullable(),
  confirmedCount: z.number().int().nonnegative(),
  waitlistCount: z.number().int().nonnegative(),
  participation: z
    .object({
      status: z.enum(["CONFIRMED", "WAITLISTED"]),
      waitlistPosition: z.number().int().positive().nullable(),
    })
    .nullable(),
});
export const personalMatchesQuerySchema = z.object({
  upcomingLimit: z.coerce.number().int().min(1).max(20).default(5),
  recentLimit: z.coerce.number().int().min(1).max(20).default(5),
});
export const personalMatchesResponseSchema = z.object({
  upcoming: z.array(personalMatchSchema),
  recent: z.array(personalMatchSchema),
});
export const rosterParticipantSchema = z.object({
  id: idSchema,
  kind: matchParticipantKindSchema,
  status: matchParticipantStatusSchema,
  displayName: z.string().nullable(),
  playerId: idSchema.nullable(),
  groupGuestId: idSchema.nullable(),
  joinedAt: z.iso.datetime(),
  position: z.number().int().positive(),
  isCurrentActor: z.boolean(),
  addedByCurrentActor: z.boolean(),
});
export const rosterSchema = z.object({
  capacity: z.number().int().positive(),
  confirmedCount: z.number().int().nonnegative(),
  waitlistCount: z.number().int().nonnegative(),
  availableSpots: z.number().int().nonnegative(),
  confirmed: z.array(rosterParticipantSchema),
  waitlist: z.array(rosterParticipantSchema),
  currentParticipation: z
    .object({
      participantId: idSchema,
      status: matchParticipantStatusSchema,
      admissionNumber: z.number().int().positive(),
      waitlistPosition: z.number().int().positive().nullable(),
      promotedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
});
export const attendanceSchema = z.enum(["PLAYED", "NO_SHOW"]);
export const finalRosterRequestSchema = z
  .object({
    participants: z.array(
      z.object({ participantId: idSchema, attendance: attendanceSchema }),
    ),
  })
  .strict();
export const finalRosterSchema = z.object({
  confirmedAt: z.iso.datetime().nullable(),
  closureEditable: z.boolean(),
  votingStartsAt: z.iso.datetime().nullable(),
  votingStarted: z.boolean(),
  participants: z.array(
    z.object({
      participantId: idSchema,
      kind: matchParticipantKindSchema,
      playerId: idSchema.nullable(),
      displayName: z.string(),
      attendance: attendanceSchema.nullable(),
    }),
  ),
});
export const participantStatsSchema = z.object({
  participantId: idSchema,
  goals: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
});
export const updateStatsRequestSchema = z
  .object({ participants: z.array(participantStatsSchema) })
  .strict();
export const assignObserverRequestSchema = z
  .object({ playerId: idSchema })
  .strict();

export const matchTeamSideSchema = z.enum(["TEAM_A", "TEAM_B"]);
export const replaceMatchTeamsRequestSchema = z
  .object({
    assignments: z
      .array(
        z
          .object({
            participantId: idSchema,
            side: matchTeamSideSchema,
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export const matchTeamParticipantSchema = z.object({
  participantId: idSchema,
  kind: matchParticipantKindSchema,
  playerId: idSchema.nullable(),
  displayName: z.string(),
  internalOvr: z.string().nullable(),
  preferredRoles: z.array(footballRoleSchema).max(2),
  willingToPlayGoalkeeper: z.boolean(),
});
const matchTeamSideReadSchema = z.object({
  participants: z.array(matchTeamParticipantSchema),
  averageOvr: z.string().nullable(),
});
export const matchTeamsSchema = z.object({
  TEAM_A: matchTeamSideReadSchema,
  TEAM_B: matchTeamSideReadSchema,
  source: z.enum(["MANUAL", "INTELLIGENT"]).nullable(),
  algorithmVersion: z.string().nullable(),
  locked: z.boolean(),
  canManage: z.boolean(),
  confirmedCount: z.number().int().nonnegative(),
  assignedCount: z.number().int().nonnegative(),
  readyToStart: z.boolean(),
  rosterChanged: z.boolean(),
  averageOvrDifference: z.string().nullable(),
  diagnostics: z.array(
    z.enum(["BALANCED", "INCOMPLETE_KEEPER_COVERAGE", "NO_KEEPER_COVERAGE"]),
  ),
});
export const resultScoreSchema = z
  .object({
    teamAGoals: z.number().int().nonnegative(),
    teamBGoals: z.number().int().nonnegative(),
  })
  .strict();
export const resultDraftRequestSchema = resultScoreSchema.extend({
  participants: z.array(participantStatsSchema).max(20),
});
export const sportingResultSchema = z.object({
  status: z.enum(["DRAFT", "CONFIRMED", "NOT_PLAYED"]).nullable(),
  teamAGoals: z.number().int().nonnegative().nullable(),
  teamBGoals: z.number().int().nonnegative().nullable(),
  winner: z.enum(["TEAM_A", "TEAM_B", "DRAW"]).nullable(),
  participants: z.array(participantStatsSchema),
});

export const votingAttributeSchema = z.enum([
  "PASE",
  "REGATE",
  "REMATE",
  "DEFENSA",
  "VELOCIDAD",
  "FISICO",
]);
const fullEvaluationSchema = z
  .object({
    targetParticipantId: idSchema,
    rating: z.number().int().min(1).max(10),
    strengths: z.array(votingAttributeSchema).max(3),
    improvements: z.array(votingAttributeSchema).max(3),
  })
  .strict();
const quickEvaluationSchema = z
  .object({
    targetParticipantId: idSchema,
    rating: z.number().int().min(1).max(10),
    quickSignal: z.enum(["POSITIVE", "IMPROVEMENT"]),
  })
  .strict();
export const submitBallotRequestSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("QUICK"),
      evaluations: z.array(quickEvaluationSchema).min(1).max(6),
    })
    .strict(),
  z
    .object({
      mode: z.literal("FULL"),
      evaluations: z.array(fullEvaluationSchema).min(1).max(200),
    })
    .strict(),
]);

// Administrative contracts are deliberately separate from public Player read models.
export const adminReasonSchema = z.string().trim().min(5).max(500);
export const adminSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(20),
});
export const adminSearchResponseSchema = z.object({
  players: z.array(
    z.object({
      id: idSchema,
      displayName: z.string(),
      email: z.email().nullable(),
      accountStatus: z.enum(["ACTIVE", "ANONYMIZED"]),
      suspended: z.boolean(),
    }),
  ),
  groups: z.array(
    z.object({ id: idSchema, name: z.string(), status: z.string() }),
  ),
  matches: z.array(
    z.object({
      id: idSchema,
      groupId: idSchema,
      groupName: z.string(),
      status: z.string(),
      scheduledAt: z.iso.datetime(),
    }),
  ),
});
export const adminReportSchema = z.object({
  id: idSchema,
  status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]),
  targetType: z.enum(["PLAYER", "GROUP", "MATCH"]),
  targetId: idSchema,
  reason: z.string(),
  comment: z.string().nullable(),
  reporter: z.object({ id: idSchema, displayName: z.string() }),
  createdAt: z.iso.datetime(),
  handledAt: z.iso.datetime().nullable(),
  resolutionNote: z.string().nullable(),
});
export const adminAuditEventSchema = z.object({
  id: idSchema,
  actorAuthUserId: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  reason: z.string(),
  requestId: z.string(),
  createdAt: z.iso.datetime(),
});
export const adminSystemStatusSchema = z.object({
  environment: z.string(),
  api: z.enum(["READY", "NOT_READY"]),
  database: z.enum(["READY", "UNAVAILABLE"]),
  migration: z.object({
    id: z.number().nullable(),
    appliedAt: z.string().nullable(),
  }),
  storageConfigured: z.boolean(),
  storageStatus: readinessResponseSchema.shape.storage,
  mailConfigured: z.boolean(),
  emailVerificationRequired: z.boolean(),
  appVersion: z.string().nullable(),
  gitSha: z.string().nullable(),
});
export const adminMutationSchema = z.object({ reason: adminReasonSchema });
export const adminModerateNameSchema = z.object({
  displayName: z.string().normalize().trim().min(2).max(40),
  reason: adminReasonSchema,
});
export const adminModerateGroupNameSchema = z.object({
  name: z.string().normalize().trim().min(2).max(80),
  reason: adminReasonSchema,
});
export const adminHandleReportSchema = z.object({
  reason: adminReasonSchema,
  resolutionNote: z.string().trim().max(1000).optional(),
});
export const adminRevokeInvitationSchema = z.object({
  kind: z.enum(["GROUP_TOKEN", "GROUP_DIRECTED", "MATCH_DIRECTED"]),
  reason: adminReasonSchema,
});

export type AdminSearchResponse = z.infer<typeof adminSearchResponseSchema>;
export type AdminReport = z.infer<typeof adminReportSchema>;
export type AdminAuditEvent = z.infer<typeof adminAuditEventSchema>;
export type AdminSystemStatus = z.infer<typeof adminSystemStatusSchema>;
