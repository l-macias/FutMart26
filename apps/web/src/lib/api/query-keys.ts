export const queryKeys = {
  me: ["me"] as const,
  compliance: ["me", "compliance"] as const,
  publicPlayerProfile: (playerId: string) =>
    ["players", playerId, "public-profile"] as const,
  playerSearch: (q: string) => ["players", "search", q] as const,
  globalSearch: (q: string) => ["search", q] as const,
  globalRanking: ["rankings", "global", "F5"] as const,
  globalRankingPreview: ["rankings", "global", "F5", "preview"] as const,
  featuredPlayers: (period: "7d" | "30d") =>
    ["discovery", "players", "featured", period] as const,
  risingPlayers: (period: "7d" | "30d") =>
    ["discovery", "players", "rising", period] as const,
  featuredGroups: (period: "7d" | "30d") =>
    ["discovery", "groups", "featured", period] as const,
  connectionStatus: (playerId: string) =>
    ["me", "connections", playerId, "status"] as const,
  connections: ["me", "connections", "list"] as const,
  connectionRequests: (direction: "incoming" | "outgoing") =>
    ["me", "connections", "requests", direction] as const,
  directedInvitations: ["me", "directed-invitations"] as const,
  performance: ["me", "performance", "F5"] as const,
  footballPreferences: ["me", "football-preferences", "F5"] as const,
  groups: ["groups"] as const,
  group: (groupId: string) => ["groups", groupId] as const,
  groupMembers: (groupId: string, includeBlocked = false) =>
    ["groups", groupId, "members", { includeBlocked }] as const,
  groupRanking: (groupId: string) =>
    ["groups", groupId, "rankings", "F5"] as const,
  venueRanking: (venueId: string) =>
    ["rankings", "venues", venueId, "F5"] as const,
  cityRanking: (cityKey: string) =>
    ["rankings", "cities", cityKey, "F5"] as const,
  provinceRanking: (provinceKey: string) =>
    ["rankings", "provinces", provinceKey, "F5"] as const,
  countryRanking: (countryKey: string) =>
    ["rankings", "countries", countryKey, "F5"] as const,
  groupActivity: (groupId: string) => ["groups", groupId, "activity"] as const,
  groupStats: (groupId: string) => ["groups", groupId, "stats"] as const,
  invitations: (groupId: string) => ["groups", groupId, "invitations"] as const,
  managedDirectedGroupInvitations: (groupId: string) =>
    ["groups", groupId, "directed-invitations"] as const,
  invitationPreview: (token: string) => ["invitations", token] as const,
  matches: (groupId: string) => ["groups", groupId, "matches"] as const,
  personalMatches: (upcomingLimit = 5, recentLimit = 5) =>
    ["me", "matches", { upcomingLimit, recentLimit }] as const,
  personalMatchesRoot: ["me", "matches"] as const,
  matchDefaults: (groupId: string) =>
    ["groups", groupId, "match-defaults"] as const,
  match: (matchId: string) => ["matches", matchId] as const,
  recruitmentOpportunities: ["me", "recruitment", "opportunities"] as const,
  roster: (matchId: string) => ["matches", matchId, "roster"] as const,
  teams: (matchId: string) => ["matches", matchId, "teams"] as const,
  finalRoster: (matchId: string) =>
    ["matches", matchId, "final-roster"] as const,
  result: (matchId: string) => ["matches", matchId, "result"] as const,
  votingEligibility: (matchId: string) =>
    ["matches", matchId, "voting-eligibility"] as const,
  voting: (matchId: string) => ["matches", matchId, "voting"] as const,
  myBallot: (matchId: string) =>
    ["matches", matchId, "voting", "my-ballot"] as const,
  progressionReveal: (matchId: string) =>
    ["matches", matchId, "progression", "reveal"] as const,
  progressionHistory: ["me", "progression", "history"] as const,
  rewards: ["me", "rewards"] as const,
  notifications: ["me", "notifications"] as const,
  notificationUnreadCount: ["me", "notifications", "unread-count"] as const,
  venueSearch: (query: string, city?: string) =>
    ["venues", "search", query, city] as const,
  courts: (venueId: string) => ["venues", venueId, "courts"] as const,
  groupGuests: (groupId: string) => ["groups", groupId, "guests"] as const,
  guestPolicy: (groupId: string) =>
    ["groups", groupId, "guest-policy"] as const,
};
