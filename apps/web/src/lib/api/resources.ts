import { z } from "zod";
import {
  createdInvitationSchema,
  footballPreferencesSchema,
  groupSchema,
  invitationJoinSchema,
  invitationPreviewSchema,
  listedInvitationSchema,
  membershipSchema,
  privatePlayerSchema,
  playerImageSchema,
  updatePlayerRequestSchema,
  playerF5PerformanceSchema,
  createInvitationRequestSchema,
  footballPreferencesRequestSchema,
  createMatchRequestSchema,
  updateMatchRequestSchema,
  matchSchema,
  personalMatchesResponseSchema,
  matchTeamsSchema,
  finalRosterRequestSchema,
  finalRosterSchema,
  resultDraftRequestSchema,
  sportingResultSchema,
  replaceMatchTeamsRequestSchema,
  rosterSchema,
  groupMatchDefaultsSchema,
  venueSchema,
  courtSchema,
  createVenueRequestSchema,
  groupGuestSchema,
  guestPolicySchema,
  submitBallotRequestSchema,
  progressionRevealSchema,
  progressionHistoryResponseSchema,
  notificationListResponseSchema,
  notificationUnreadCountSchema,
  rewardsResponseSchema,
  groupRankingResponseSchema,
  groupActivityResponseSchema,
  groupStatsSchema,
  territorialRankingResponseSchema,
  publicPlayerProfileSchema,
  playerSearchResponseSchema,
  directedInvitationInboxSchema,
  groupDirectedInvitationAcceptSchema,
  groupDirectedInvitationCreateResponseSchema,
  matchDirectedInvitationAcceptSchema,
  matchDirectedInvitationCreateResponseSchema,
  connectionStatusSchema,
  connectionListResponseSchema,
  connectionRequestListResponseSchema,
  replaceMatchRecruitmentRequestSchema,
  matchRecruitmentSchema,
  recruitmentOpportunitiesResponseSchema,
  globalRankingResponseSchema,
  featuredPlayersResponseSchema,
  risingPlayersResponseSchema,
  featuredGroupsResponseSchema,
  globalSearchResponseSchema,
  managedGroupDirectedInvitationSchema,
  moderatorCapabilitiesRequestSchema,
  updateGroupRequestSchema,
  complianceStatusSchema,
  completeComplianceRequestSchema,
  updatePlayerPrivacyRequestSchema,
  updateGroupPrivacyRequestSchema,
  createAbuseReportRequestSchema,
  abuseReportResponseSchema,
} from "@football/contracts";

import { apiRequest } from "./client";

export const api = {
  me: () => apiRequest("/me/player", { schema: privatePlayerSchema }),
  updatePlayer: (input: z.infer<typeof updatePlayerRequestSchema>) =>
    apiRequest("/me/player", {
      method: "PATCH",
      body: JSON.stringify(input),
      schema: privatePlayerSchema,
    }),
  compliance: () =>
    apiRequest("/me/compliance", { schema: complianceStatusSchema }),
  completeCompliance: (
    input: z.infer<typeof completeComplianceRequestSchema>,
  ) =>
    apiRequest("/me/compliance", {
      method: "PUT",
      body: JSON.stringify(input),
      schema: complianceStatusSchema,
    }),
  updatePlayerPrivacy: (
    input: z.infer<typeof updatePlayerPrivacyRequestSchema>,
  ) =>
    apiRequest("/me/player/privacy", {
      method: "PATCH",
      body: JSON.stringify(input),
      schema: updatePlayerPrivacyRequestSchema,
    }),
  createReport: (input: z.infer<typeof createAbuseReportRequestSchema>) =>
    apiRequest("/reports", {
      method: "POST",
      body: JSON.stringify(input),
      schema: abuseReportResponseSchema,
    }),
  uploadAvatar: (form: FormData) =>
    apiRequest("/me/player/avatar", {
      method: "POST",
      body: form,
      schema: playerImageSchema,
    }),
  removeAvatar: () =>
    apiRequest<void>("/me/player/avatar", { method: "DELETE" }),
  publicPlayerProfile: (playerId: string) =>
    apiRequest(`/players/${playerId}/public-profile`, {
      schema: publicPlayerProfileSchema,
    }),
  searchPlayers: (q: string, limit = 10, signal?: AbortSignal) => {
    const params = new URLSearchParams({ q, limit: String(limit) });
    return apiRequest(`/players/search?${params}`, {
      schema: playerSearchResponseSchema,
      signal,
    });
  },
  globalSearch: (q: string, limit = 5, signal?: AbortSignal) => {
    const params = new URLSearchParams({ q, limit: String(limit) });
    return apiRequest(`/search?${params}`, {
      schema: globalSearchResponseSchema,
      signal,
    });
  },
  globalRanking: (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(`/rankings/global/F5?${params}`, {
      schema: globalRankingResponseSchema,
    });
  },
  featuredPlayers: (period: "7d" | "30d" = "30d", limit = 5) => {
    const params = new URLSearchParams({ period, limit: String(limit) });
    return apiRequest(`/discovery/players/featured?${params}`, {
      schema: featuredPlayersResponseSchema,
    });
  },
  risingPlayers: (period: "7d" | "30d" = "30d", limit = 5) => {
    const params = new URLSearchParams({ period, limit: String(limit) });
    return apiRequest(`/discovery/players/rising?${params}`, {
      schema: risingPlayersResponseSchema,
    });
  },
  featuredGroups: (period: "7d" | "30d" = "30d", limit = 5) => {
    const params = new URLSearchParams({ period, limit: String(limit) });
    return apiRequest(`/discovery/groups/featured?${params}`, {
      schema: featuredGroupsResponseSchema,
    });
  },
  connectionStatus: (playerId: string) =>
    apiRequest(`/me/connections/${playerId}/status`, {
      schema: connectionStatusSchema,
    }),
  requestConnection: (playerId: string) =>
    apiRequest("/me/connections/requests", {
      method: "POST",
      body: JSON.stringify({ playerId }),
      schema: connectionStatusSchema,
    }),
  acceptConnection: (playerId: string) =>
    apiRequest(`/me/connections/${playerId}/accept`, {
      method: "POST",
      schema: connectionStatusSchema,
    }),
  rejectConnection: (playerId: string) =>
    apiRequest(`/me/connections/${playerId}/reject`, {
      method: "POST",
      schema: connectionStatusSchema,
    }),
  cancelConnection: (playerId: string) =>
    apiRequest(`/me/connections/${playerId}/request`, {
      method: "DELETE",
      schema: connectionStatusSchema,
    }),
  removeConnection: (playerId: string) =>
    apiRequest(`/me/connections/${playerId}`, {
      method: "DELETE",
      schema: connectionStatusSchema,
    }),
  connections: (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(`/me/connections?${params}`, {
      schema: connectionListResponseSchema,
    });
  },
  connectionRequests: (
    direction: "incoming" | "outgoing",
    cursor?: string,
    limit = 20,
  ) => {
    const params = new URLSearchParams({ direction, limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(`/me/connections/requests?${params}`, {
      schema: connectionRequestListResponseSchema,
    });
  },
  directedInvitations: () =>
    apiRequest("/me/directed-invitations", {
      schema: directedInvitationInboxSchema,
    }),
  inviteConnectionToGroup: (groupId: string, playerId: string) =>
    apiRequest(`/groups/${groupId}/connection-invitations`, {
      method: "POST",
      body: JSON.stringify({ playerId }),
      schema: groupDirectedInvitationCreateResponseSchema,
    }),
  inviteConnectionToMatch: (matchId: string, playerId: string) =>
    apiRequest(`/matches/${matchId}/invitations`, {
      method: "POST",
      body: JSON.stringify({ playerId }),
      schema: matchDirectedInvitationCreateResponseSchema,
    }),
  acceptGroupInvitation: (invitationId: string) =>
    apiRequest(`/me/group-invitations/${invitationId}/accept`, {
      method: "POST",
      schema: groupDirectedInvitationAcceptSchema,
    }),
  rejectGroupInvitation: (invitationId: string) =>
    apiRequest<void>(`/me/group-invitations/${invitationId}/reject`, {
      method: "POST",
    }),
  acceptMatchInvitation: (invitationId: string) =>
    apiRequest(`/me/match-invitations/${invitationId}/accept`, {
      method: "POST",
      schema: matchDirectedInvitationAcceptSchema,
    }),
  rejectMatchInvitation: (invitationId: string) =>
    apiRequest<void>(`/me/match-invitations/${invitationId}/reject`, {
      method: "POST",
    }),
  performance: () =>
    apiRequest("/me/performance/F5", { schema: playerF5PerformanceSchema }),
  preferences: () =>
    apiRequest("/me/football-preferences/F5", {
      schema: footballPreferencesSchema,
    }),
  savePreferences: (input: z.infer<typeof footballPreferencesRequestSchema>) =>
    apiRequest("/me/football-preferences/F5", {
      method: "PUT",
      body: JSON.stringify(input),
      schema: footballPreferencesSchema,
    }),
  groups: () => apiRequest("/groups", { schema: z.array(groupSchema) }),
  group: (groupId: string) =>
    apiRequest(`/groups/${groupId}`, { schema: groupSchema }),
  groupRanking: (groupId: string, cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(`/groups/${groupId}/rankings/F5?${params}`, {
      schema: groupRankingResponseSchema,
    });
  },
  venueRanking: (venueId: string, cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(`/rankings/venues/${venueId}/F5?${params}`, {
      schema: territorialRankingResponseSchema,
    });
  },
  cityRanking: (cityKey: string, cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(
      `/rankings/cities/${encodeURIComponent(cityKey)}/F5?${params}`,
      { schema: territorialRankingResponseSchema },
    );
  },
  provinceRanking: (provinceKey: string, cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(
      `/rankings/provinces/${encodeURIComponent(provinceKey)}/F5?${params}`,
      { schema: territorialRankingResponseSchema },
    );
  },
  countryRanking: (countryKey: string, cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(
      `/rankings/countries/${encodeURIComponent(countryKey)}/F5?${params}`,
      { schema: territorialRankingResponseSchema },
    );
  },
  groupActivity: (groupId: string, cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(`/groups/${groupId}/activity?${params}`, {
      schema: groupActivityResponseSchema,
    });
  },
  groupStats: (groupId: string) =>
    apiRequest(`/groups/${groupId}/stats`, { schema: groupStatsSchema }),
  members: (groupId: string, includeBlocked = false) =>
    apiRequest(`/groups/${groupId}/members?includeBlocked=${includeBlocked}`, {
      schema: z.array(membershipSchema),
    }),
  updateGroup: (
    groupId: string,
    input: z.infer<typeof updateGroupRequestSchema>,
  ) =>
    apiRequest(`/groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
      schema: updateGroupPrivacyRequestSchema,
    }),
  updateGroupPrivacy: (
    groupId: string,
    input: z.infer<typeof updateGroupPrivacyRequestSchema>,
  ) =>
    apiRequest(`/groups/${groupId}/privacy`, {
      method: "PATCH",
      body: JSON.stringify(input),
      schema: groupSchema,
    }),
  archiveGroup: (groupId: string) =>
    apiRequest<void>(`/groups/${groupId}/archive`, { method: "POST" }),
  promoteGroupMember: (groupId: string, playerId: string) =>
    apiRequest<void>(`/groups/${groupId}/members/${playerId}/promote`, {
      method: "POST",
    }),
  demoteGroupMember: (groupId: string, playerId: string) =>
    apiRequest<void>(`/groups/${groupId}/members/${playerId}/demote`, {
      method: "POST",
    }),
  updateModeratorCapabilities: (
    groupId: string,
    playerId: string,
    input: z.infer<typeof moderatorCapabilitiesRequestSchema>,
  ) =>
    apiRequest<void>(`/groups/${groupId}/members/${playerId}/capabilities`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  transferGroupOwnership: (groupId: string, targetPlayerId: string) =>
    apiRequest<void>(`/groups/${groupId}/ownership-transfer`, {
      method: "POST",
      body: JSON.stringify({ targetPlayerId }),
    }),
  removeGroupMember: (groupId: string, playerId: string) =>
    apiRequest<void>(`/groups/${groupId}/members/${playerId}`, {
      method: "DELETE",
    }),
  blockGroupMember: (groupId: string, playerId: string) =>
    apiRequest<void>(`/groups/${groupId}/members/${playerId}/block`, {
      method: "POST",
    }),
  unblockGroupMember: (groupId: string, playerId: string) =>
    apiRequest<void>(`/groups/${groupId}/members/${playerId}/unblock`, {
      method: "POST",
    }),
  leaveGroup: (groupId: string) =>
    apiRequest<void>(`/groups/${groupId}/leave`, { method: "POST" }),
  createGroup: (name: string) =>
    apiRequest("/groups", {
      method: "POST",
      body: JSON.stringify({ name }),
      schema: groupSchema,
    }),
  invitations: (groupId: string) =>
    apiRequest(`/groups/${groupId}/invitations`, {
      schema: z.array(listedInvitationSchema),
    }),
  createInvitation: (
    groupId: string,
    input: z.infer<typeof createInvitationRequestSchema>,
  ) =>
    apiRequest(`/groups/${groupId}/invitations`, {
      method: "POST",
      body: JSON.stringify(input),
      schema: createdInvitationSchema,
    }),
  revokeInvitation: (groupId: string, invitationId: string) =>
    apiRequest<void>(`/groups/${groupId}/invitations/${invitationId}`, {
      method: "DELETE",
    }),
  managedDirectedGroupInvitations: (groupId: string) =>
    apiRequest(`/groups/${groupId}/connection-invitations`, {
      schema: z.array(managedGroupDirectedInvitationSchema),
    }),
  revokeDirectedGroupInvitation: (groupId: string, invitationId: string) =>
    apiRequest<void>(
      `/groups/${groupId}/connection-invitations/${invitationId}`,
      { method: "DELETE" },
    ),
  invitationPreview: (token: string) =>
    apiRequest(`/invitations/${encodeURIComponent(token)}`, {
      schema: invitationPreviewSchema,
    }),
  joinInvitation: (token: string) =>
    apiRequest(`/invitations/${encodeURIComponent(token)}/join`, {
      method: "POST",
      schema: invitationJoinSchema,
    }),
  matches: (groupId: string) =>
    apiRequest(`/groups/${groupId}/matches`, { schema: z.array(matchSchema) }),
  personalMatches: (upcomingLimit = 5, recentLimit = 5) => {
    const params = new URLSearchParams({
      upcomingLimit: String(upcomingLimit),
      recentLimit: String(recentLimit),
    });
    return apiRequest(`/me/matches?${params}`, {
      schema: personalMatchesResponseSchema,
    });
  },
  matchDefaults: (groupId: string) =>
    apiRequest(`/groups/${groupId}/match-defaults`, {
      schema: groupMatchDefaultsSchema,
    }),
  createMatch: (
    groupId: string,
    input: z.infer<typeof createMatchRequestSchema>,
  ) =>
    apiRequest(`/groups/${groupId}/matches`, {
      method: "POST",
      body: JSON.stringify(input),
      schema: matchSchema,
    }),
  match: (matchId: string) =>
    apiRequest(`/matches/${matchId}`, { schema: matchSchema }),
  saveRecruitment: (
    matchId: string,
    input: z.infer<typeof replaceMatchRecruitmentRequestSchema>,
  ) =>
    apiRequest(`/matches/${matchId}/recruitment`, {
      method: "PUT",
      body: JSON.stringify(input),
      schema: matchRecruitmentSchema,
    }),
  recruitmentOpportunities: (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(`/me/recruitment/opportunities?${params}`, {
      schema: recruitmentOpportunitiesResponseSchema,
    });
  },
  publishMatch: (matchId: string) =>
    apiRequest<void>(`/matches/${matchId}/publish`, { method: "POST" }),
  cancelMatch: (matchId: string) =>
    apiRequest<void>(`/matches/${matchId}/cancel`, { method: "POST" }),
  roster: (matchId: string) =>
    apiRequest(`/matches/${matchId}/roster`, { schema: rosterSchema }),
  teams: (matchId: string) =>
    apiRequest(`/matches/${matchId}/teams`, { schema: matchTeamsSchema }),
  generateTeams: (matchId: string) =>
    apiRequest(`/matches/${matchId}/teams/generate`, {
      method: "POST",
      schema: matchTeamsSchema,
    }),
  saveTeams: (
    matchId: string,
    input: z.infer<typeof replaceMatchTeamsRequestSchema>,
  ) =>
    apiRequest(`/matches/${matchId}/teams`, {
      method: "PUT",
      body: JSON.stringify(input),
      schema: matchTeamsSchema,
    }),
  startMatch: (matchId: string) =>
    apiRequest<void>(`/matches/${matchId}/start`, { method: "POST" }),
  finishMatch: (matchId: string) =>
    apiRequest<void>(`/matches/${matchId}/finish`, { method: "POST" }),
  finalRoster: (matchId: string) =>
    apiRequest(`/matches/${matchId}/final-roster`, {
      schema: finalRosterSchema,
    }),
  saveFinalRoster: (
    matchId: string,
    input: z.infer<typeof finalRosterRequestSchema>,
  ) =>
    apiRequest<void>(`/matches/${matchId}/final-roster`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  result: (matchId: string) =>
    apiRequest(`/matches/${matchId}/result`, { schema: sportingResultSchema }),
  saveResultDraft: (
    matchId: string,
    input: z.infer<typeof resultDraftRequestSchema>,
  ) =>
    apiRequest(`/matches/${matchId}/result`, {
      method: "PUT",
      body: JSON.stringify(input),
      schema: sportingResultSchema,
    }),
  confirmResult: (matchId: string) =>
    apiRequest(`/matches/${matchId}/result/confirm`, {
      method: "POST",
      schema: sportingResultSchema,
    }),
  votingEligibility: (matchId: string) =>
    apiRequest(`/matches/${matchId}/voting-eligibility`, {
      schema: z.object({
        votingEligibleAfter: z.string(),
        votingStartsAt: z.string().nullable(),
        votingStarted: z.boolean(),
        observer: z
          .object({ playerId: z.uuid(), canVote: z.literal(false) })
          .nullable(),
        participants: z.array(
          z.object({
            participantId: z.uuid(),
            kind: z.enum(["PLAYER", "GUEST"]),
            playerId: z.uuid().nullable(),
            displayName: z.string(),
            attendance: z.enum(["PLAYED", "NO_SHOW"]),
            canVote: z.boolean(),
            canBeEvaluated: z.boolean(),
          }),
        ),
      }),
    }),
  voting: (matchId: string) =>
    apiRequest(`/matches/${matchId}/voting`, {
      schema: z.object({
        status: z.enum(["OPEN", "CLOSED"]),
        openedAt: z.string(),
        closesAt: z.string(),
        closeReason: z.enum(["DEADLINE", "ALL_ELIGIBLE_VOTED"]).nullable(),
        hasSubmitted: z.boolean(),
        submittedMode: z.enum(["QUICK", "FULL"]).nullable(),
        eligibleTargets: z.array(
          z.object({
            participantId: z.uuid(),
            kind: z.enum(["PLAYER", "GUEST"]),
            displayName: z.string(),
          }),
        ),
      }),
    }),
  submitBallot: (
    matchId: string,
    input: z.infer<typeof submitBallotRequestSchema>,
  ) =>
    apiRequest(`/matches/${matchId}/voting/ballot`, {
      method: "POST",
      body: JSON.stringify(input),
      schema: z.object({
        ballotId: z.uuid(),
        status: z.enum(["OPEN", "CLOSED"]),
      }),
    }),
  myBallot: (matchId: string) =>
    apiRequest(`/matches/${matchId}/voting/my-ballot`, {
      schema: z
        .object({
          mode: z.enum(["QUICK", "FULL"]),
          submittedAt: z.string(),
          evaluations: z.array(
            z.object({ targetParticipantId: z.uuid() }).passthrough(),
          ),
        })
        .nullable(),
    }),
  progressionReveal: (matchId: string) =>
    apiRequest(`/matches/${matchId}/progression/reveal`, {
      schema: progressionRevealSchema,
    }),
  materializeProgression: (matchId: string) =>
    apiRequest(`/matches/${matchId}/progression/materialize`, {
      method: "POST",
      schema: progressionRevealSchema,
    }),
  progressionHistory: (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(`/me/progression/history?${params}`, {
      schema: progressionHistoryResponseSchema,
    });
  },
  rewards: () => apiRequest("/me/rewards", { schema: rewardsResponseSchema }),
  notifications: (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return apiRequest(`/me/notifications?${params}`, {
      schema: notificationListResponseSchema,
    });
  },
  notificationUnreadCount: () =>
    apiRequest("/me/notifications/unread-count", {
      schema: notificationUnreadCountSchema,
    }),
  markNotificationRead: (notificationId: string) =>
    apiRequest(`/me/notifications/${notificationId}/read`, {
      method: "POST",
      schema: z.object({ readAt: z.iso.datetime() }),
    }),
  joinMatch: (matchId: string) =>
    apiRequest(`/matches/${matchId}/join`, {
      method: "POST",
      schema: z.object({
        id: z.uuid(),
        status: z.enum(["CONFIRMED", "WAITLISTED"]),
      }),
    }),
  leaveMatch: (matchId: string) =>
    apiRequest<void>(`/matches/${matchId}/leave`, { method: "POST" }),
  cancelParticipant: (matchId: string, participantId: string) =>
    apiRequest<void>(`/matches/${matchId}/participants/cancel`, {
      method: "POST",
      body: JSON.stringify({ participantId }),
    }),
  swapWaitlist: (
    matchId: string,
    promoteParticipantId: string,
    demoteParticipantId: string,
  ) =>
    apiRequest<void>(`/matches/${matchId}/waitlist/swap`, {
      method: "POST",
      body: JSON.stringify({ promoteParticipantId, demoteParticipantId }),
    }),
  searchVenues: (query: string, city?: string, signal?: AbortSignal) => {
    const params = new URLSearchParams({ query, limit: "8" });
    if (city) params.set("city", city);
    return apiRequest(`/venues?${params}`, {
      schema: z.array(venueSchema),
      signal,
    });
  },
  createVenue: (
    groupId: string,
    input: z.infer<typeof createVenueRequestSchema>,
  ) =>
    apiRequest(`/groups/${groupId}/venues`, {
      method: "POST",
      body: JSON.stringify(input),
      schema: venueSchema,
    }),
  courts: (venueId: string) =>
    apiRequest(`/venues/${venueId}/courts`, { schema: z.array(courtSchema) }),
  createCourt: (groupId: string, venueId: string, displayName: string) =>
    apiRequest(`/groups/${groupId}/venues/${venueId}/courts`, {
      method: "POST",
      body: JSON.stringify({ displayName }),
      schema: courtSchema,
    }),
  groupGuests: (groupId: string) =>
    apiRequest(`/groups/${groupId}/guests?limit=100&offset=0`, {
      schema: z.array(groupGuestSchema),
    }),
  createGroupGuest: (groupId: string, displayName: string) =>
    apiRequest(`/groups/${groupId}/guests`, {
      method: "POST",
      body: JSON.stringify({ displayName }),
      schema: z.object({
        id: z.uuid(),
        groupId: z.uuid(),
        displayName: z.string(),
        status: z.enum(["ACTIVE", "ARCHIVED", "DELETED"]),
        createdAt: z.coerce.date(),
      }),
    }),
  renameGroupGuest: (groupId: string, guestId: string, displayName: string) =>
    apiRequest<void>(`/groups/${groupId}/guests/${guestId}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName }),
    }),
  archiveGroupGuest: (groupId: string, guestId: string) =>
    apiRequest<void>(`/groups/${groupId}/guests/${guestId}/archive`, {
      method: "POST",
    }),
  restoreGroupGuest: (groupId: string, guestId: string) =>
    apiRequest<void>(`/groups/${groupId}/guests/${guestId}/restore`, {
      method: "POST",
    }),
  removeGroupGuest: (groupId: string, guestId: string) =>
    apiRequest<void>(`/groups/${groupId}/guests/${guestId}`, {
      method: "DELETE",
    }),
  updateMatch: (
    matchId: string,
    input: z.infer<typeof updateMatchRequestSchema>,
  ) =>
    apiRequest<void>(`/matches/${matchId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  guestPolicy: (groupId: string) =>
    apiRequest(`/groups/${groupId}/guest-policy`, {
      schema: guestPolicySchema,
    }),
  updateGuestPolicy: (
    groupId: string,
    input: { guestsEnabled?: boolean; defaultGuestAllowancePerMember?: number },
  ) =>
    apiRequest<void>(`/groups/${groupId}/guest-policy`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  addGuestToMatch: (matchId: string, groupGuestId: string) =>
    apiRequest(`/matches/${matchId}/guests`, {
      method: "POST",
      body: JSON.stringify({ groupGuestId }),
      schema: z.object({
        id: z.uuid(),
        status: z.enum(["CONFIRMED", "WAITLISTED"]),
      }),
    }),
  removeGuestFromMatch: (matchId: string, participantId: string) =>
    apiRequest<void>(`/matches/${matchId}/guests/${participantId}`, {
      method: "DELETE",
    }),
};
