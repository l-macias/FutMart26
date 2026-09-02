import { and, asc, eq, sql } from "drizzle-orm";

import type {
  PlayerSearchResponse,
  PublicPlayerProfile,
} from "@football/contracts";
import type { Database } from "@football/database";
import {
  accountSuspensions,
  matches,
  matchParticipants,
  matchParticipantStats,
  matchSportingResults,
  playerPerformances,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { PlayerPerformanceReadService } from "../progression/player-performance-read-service.js";
import { RewardService } from "../rewards/reward-service.js";
import { FootballPreferencesService } from "./football-preferences-service.js";
import { PlayerMediaService } from "../media/player-media-service.js";

export class PublicPlayerProfileService {
  constructor(
    private readonly database: Database,
    private readonly performances: PlayerPerformanceReadService,
    private readonly preferences: FootballPreferencesService,
    private readonly rewards: RewardService,
    private readonly media?: PlayerMediaService,
  ) {}

  async get(
    actorPlayerId: string,
    targetPlayerId: string,
  ): Promise<PublicPlayerProfile> {
    const [player] = await this.database
      .select({
        id: players.id,
        displayName: players.displayName,
        profileVisibility: players.profileVisibility,
        accountStatus: players.accountStatus,
        suspensionId: accountSuspensions.id,
      })
      .from(players)
      .leftJoin(
        accountSuspensions,
        and(
          eq(accountSuspensions.authUserId, players.authUserId),
          sql`${accountSuspensions.reactivatedAt} is null`,
        ),
      )
      .where(eq(players.id, targetPlayerId))
      .limit(1);
    if (!player)
      throw new ApplicationError("player_not_found", "Player not found", 404);
    if (player.accountStatus === "ANONYMIZED" || player.suspensionId)
      throw new ApplicationError("player_not_found", "Player not found", 404);
    if (player.profileVisibility === "PRIVATE")
      return {
        visibility: "PRIVATE",
        player: { id: player.id, displayName: player.displayName },
        isCurrentPlayer: player.id === actorPlayerId,
      };

    const [performance, footballPreferences, rewards, [stats]] =
      await Promise.all([
        this.performances.getF5(targetPlayerId),
        this.preferences.get(targetPlayerId),
        this.rewards.listPublic(targetPlayerId),
        this.database
          .select({
            goals: sql<number>`coalesce(sum(${matchParticipantStats.goals}), 0)::int`,
            assists: sql<number>`coalesce(sum(${matchParticipantStats.assists}), 0)::int`,
          })
          .from(matchParticipants)
          .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
          .innerJoin(
            matchSportingResults,
            and(
              eq(matchSportingResults.matchId, matches.id),
              eq(matchSportingResults.status, "CONFIRMED"),
            ),
          )
          .leftJoin(
            matchParticipantStats,
            eq(matchParticipantStats.participantId, matchParticipants.id),
          )
          .where(
            and(
              eq(matchParticipants.playerId, targetPlayerId),
              eq(matchParticipants.kind, "PLAYER"),
              eq(matchParticipants.status, "CONFIRMED"),
              eq(matchParticipants.attendance, "PLAYED"),
              eq(matches.status, "FINISHED"),
              eq(matches.discipline, "F5"),
            ),
          ),
      ]);

    return {
      visibility: "PUBLIC",
      player: {
        id: player.id,
        displayName: player.displayName,
        image: (await this.media?.getPlayerImage(player.id)) ?? null,
      },
      performance: {
        discipline: "F5",
        initialized: performance.initialized,
        overall: performance.overall,
        attributes: performance.attributes,
        processedMatchCount: performance.processedMatchCount,
      },
      footballProfile: footballPreferences.configured
        ? {
            preferredRoles: footballPreferences.preferredRoles,
            willingToPlayGoalkeeper:
              footballPreferences.willingToPlayGoalkeeper,
            strengths: footballPreferences.strengths,
          }
        : null,
      rewards: {
        achievements: rewards.achievements,
        recentAwards: rewards.recentAwards,
      },
      summary: {
        totalGoals: stats?.goals ?? 0,
        totalAssists: stats?.assists ?? 0,
        achievementCount: rewards.achievementCount,
        awardCount: rewards.awardCount,
      },
      isCurrentPlayer: player.id === actorPlayerId,
    };
  }

  async search(
    actorPlayerId: string,
    input: { q: string; limit: number },
  ): Promise<PlayerSearchResponse> {
    const normalizedQuery = input.q
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ");
    const escaped = normalizedQuery.replace(/[\\%_]/g, "\\$&");
    const rows = await this.database
      .select({
        playerId: players.id,
        displayName: players.displayName,
        overall: playerPerformances.internalOvr,
        processedMatchCount: playerPerformances.processedMatchCount,
      })
      .from(players)
      .leftJoin(
        playerPerformances,
        and(
          eq(playerPerformances.playerId, players.id),
          eq(playerPerformances.discipline, "F5"),
        ),
      )
      .where(
        and(
          eq(players.profileVisibility, "PUBLIC"),
          eq(players.accountStatus, "ACTIVE"),
          sql`not exists (select 1 from ${accountSuspensions} where ${accountSuspensions.authUserId} = ${players.authUserId} and ${accountSuspensions.reactivatedAt} is null)`,
          sql`${players.displayName} ilike ${`%${escaped}%`} escape '\\'`,
        ),
      )
      .orderBy(asc(sql`lower(${players.displayName})`), asc(players.id))
      .limit(input.limit);

    return {
      items: rows.map((row) => ({
        player: { id: row.playerId, displayName: row.displayName },
        performance: {
          overall: row.overall === null ? null : Number(row.overall),
          processedMatchCount: row.processedMatchCount ?? 0,
        },
        isCurrentPlayer: row.playerId === actorPlayerId,
      })),
    };
  }
}
