import type { PersonalHomeResponse } from "@football/contracts";

import type { MatchService } from "../matches/match-service.js";
import type { MatchRecruitmentService } from "../matches/match-recruitment-service.js";
import type { NotificationService } from "../notifications/notification-service.js";
import type { PlayerPerformanceReadService } from "../progression/player-performance-read-service.js";
import type { GlobalRankingService } from "../rankings/global-ranking-service.js";

const ATTENTION_NOTIFICATION_TYPES = [
  "VOTING_AVAILABLE",
  "PROGRESSION_AVAILABLE",
  "MATCH_CANCELLED",
  "CONNECTION_REQUESTED",
  "GROUP_INVITATION_RECEIVED",
  "MATCH_INVITATION_RECEIVED",
  "GROUP_MODERATOR_GRANTED",
  "GROUP_MODERATOR_REMOVED",
] as const;

export class HomeService {
  constructor(
    private readonly matches: MatchService,
    private readonly recruitment: MatchRecruitmentService,
    private readonly notifications: NotificationService,
    private readonly performance: PlayerPerformanceReadService,
    private readonly rankings: GlobalRankingService,
  ) {}

  async get(
    player: { id: string; displayName: string },
    onOptionalFailure: (area: "attention" | "opportunities") => void = () =>
      undefined,
  ): Promise<PersonalHomeResponse> {
    const [matches, progress, ranking, attention, opportunities] =
      await Promise.all([
        this.matches.listForPlayer(player.id, {
          upcomingLimit: 1,
          historyLimit: 1,
        }),
        this.performance.getF5(player.id),
        this.rankings.list(player.id, { limit: 1 }),
        this.notifications
          .list(player.id, {
            limit: 5,
            unreadOnly: true,
            types: ATTENTION_NOTIFICATION_TYPES,
          })
          .then((value) => ({ available: true, items: value.items }))
          .catch(() => {
            onOptionalFailure("attention");
            return { available: false, items: [] };
          }),
        this.recruitment
          .opportunities(player.id, { limit: 3 })
          .then((value) => ({ available: true, items: value.items }))
          .catch(() => {
            onOptionalFailure("opportunities");
            return { available: false, items: [] };
          }),
      ]);

    return {
      player,
      currentOrNextMatch: matches.current ?? matches.upcoming[0] ?? null,
      attention,
      opportunities,
      progress: {
        overall: progress.overall,
        initialized: progress.initialized,
        processedMatchCount: progress.processedMatchCount,
      },
      globalPosition: ranking.me.ranked
        ? {
            ranked: true,
            position: ranking.me.position,
            overall: ranking.me.overall,
          }
        : { ranked: false },
    };
  }
}
