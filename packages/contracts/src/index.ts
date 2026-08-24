import { z } from "zod";

export const healthResponseSchema = z.object({ status: z.literal("ok") });
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const idSchema = z.uuid();
export const playerSchema = z.object({ id: idSchema, displayName: z.string() });
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
const matchFieldsSchema = z.object({
  scheduledAt: z.iso.datetime(),
  durationMinutes: z.number().int().positive(),
  capacity: z.number().int().positive(),
  locationText: z.string().trim().min(1).max(200),
});
export const createMatchRequestSchema = matchFieldsSchema
  .extend({ discipline: matchDisciplineSchema.optional().default("F5") })
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
export const matchSchema = z.object({
  id: idSchema,
  groupId: idSchema,
  discipline: matchDisciplineSchema,
  status: matchStatusSchema,
  scheduledAt: z.iso.datetime(),
  durationMinutes: z.number().int(),
  capacity: z.number().int(),
  locationText: z.string(),
  rosterLockedAt: z.iso.datetime().nullable(),
  confirmedCount: z.number().int().nonnegative(),
  waitlistCount: z.number().int().nonnegative(),
  availableSpots: z.number().int().nonnegative(),
});
export const rosterParticipantSchema = z.object({
  id: idSchema,
  kind: matchParticipantKindSchema,
  status: matchParticipantStatusSchema,
  displayName: z.string().nullable(),
  playerId: idSchema.nullable(),
  joinedAt: z.iso.datetime(),
});
export const rosterSchema = z.object({
  capacity: z.number().int().positive(),
  confirmedCount: z.number().int().nonnegative(),
  waitlistCount: z.number().int().nonnegative(),
  availableSpots: z.number().int().nonnegative(),
  confirmed: z.array(rosterParticipantSchema),
  waitlist: z.array(rosterParticipantSchema),
});
export const attendanceSchema = z.enum(["PLAYED", "NO_SHOW"]);
export const finalRosterRequestSchema = z
  .object({
    participants: z.array(
      z.object({ participantId: idSchema, attendance: attendanceSchema }),
    ),
  })
  .strict();
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
export const resultScoreSchema = z
  .object({
    teamAGoals: z.number().int().nonnegative(),
    teamBGoals: z.number().int().nonnegative(),
  })
  .strict();
export const resultDraftRequestSchema = resultScoreSchema.extend({
  participants: z.array(participantStatsSchema).max(20),
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
