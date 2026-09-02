import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { Decimal } from "decimal.js";

import type { RewardsResponse } from "@football/contracts";
import type { Database } from "@football/database";
import {
  groups,
  matchAwards,
  matchParticipants,
  matchParticipantStats,
  matches,
  playerAchievements,
  progressionSnapshots,
} from "@football/database/schema";

export const HIGH_RATING_THRESHOLD = "8.000000000000";
const RECONCILIATION_MATCH_LIMIT = 100;
const RECENT_AWARD_LIMIT = 20;
const PUBLIC_AWARD_LIMIT = 5;

type AchievementType = typeof playerAchievements.$inferInsert.type;
type AwardType = typeof matchAwards.$inferInsert.type;

const achievementCopy: Record<
  AchievementType,
  { title: string; description: string }
> = {
  FIRST_MATCH: {
    title: "Primer partido",
    description: "Completaste tu primer partido F5 procesado.",
  },
  FIVE_MATCHES: {
    title: "Cinco partidos",
    description: "Alcanzaste cinco partidos F5 procesados.",
  },
  TEN_MATCHES: {
    title: "Diez partidos",
    description: "Alcanzaste diez partidos F5 procesados.",
  },
  FIRST_GOAL: {
    title: "Primer gol",
    description: "Convertiste tu primer gol registrado.",
  },
  HAT_TRICK: {
    title: "Hat-trick",
    description: "Marcaste al menos tres goles en un partido.",
  },
  FIRST_ASSIST: {
    title: "Primera asistencia",
    description: "Registraste tu primera asistencia.",
  },
  HIGH_RATING: {
    title: "Partido sobresaliente",
    description: "Recibiste un rating agregado de 8.0 o más.",
  },
};

const awardCopy: Record<AwardType, { title: string; description: string }> = {
  TOP_RATED: {
    title: "Mejor valorado",
    description: "Obtuviste el rating agregado más alto del partido.",
  },
  TOP_SCORER: {
    title: "Goleador del partido",
    description: "Terminaste con la mayor cantidad de goles del partido.",
  },
  TOP_ASSIST: {
    title: "Máximo asistidor",
    description: "Terminaste con la mayor cantidad de asistencias del partido.",
  },
};

export class RewardService {
  constructor(private readonly database: Database) {}

  async list(actorPlayerId: string): Promise<RewardsResponse> {
    await this.reconcilePlayer(actorPlayerId);
    const [achievements, awards] = await Promise.all([
      this.database
        .select()
        .from(playerAchievements)
        .where(eq(playerAchievements.playerId, actorPlayerId))
        .orderBy(
          desc(playerAchievements.earnedAt),
          desc(playerAchievements.id),
        ),
      this.database
        .select({
          award: matchAwards,
          scheduledAt: matches.scheduledAt,
          groupId: groups.id,
          groupName: groups.name,
        })
        .from(matchAwards)
        .innerJoin(matches, eq(matches.id, matchAwards.matchId))
        .innerJoin(groups, eq(groups.id, matches.groupId))
        .where(eq(matchAwards.playerId, actorPlayerId))
        .orderBy(desc(matchAwards.awardedAt), desc(matchAwards.id))
        .limit(RECENT_AWARD_LIMIT),
    ]);
    return {
      achievements: achievements.map(presentAchievement),
      recentAwards: awards.map(({ award, scheduledAt, groupId, groupName }) =>
        presentAward(award, scheduledAt, groupId, groupName),
      ),
    };
  }

  async listPublic(playerId: string) {
    await this.reconcilePlayer(playerId);
    const [achievements, awards, [awardTotal]] = await Promise.all([
      this.database
        .select()
        .from(playerAchievements)
        .where(eq(playerAchievements.playerId, playerId))
        .orderBy(
          desc(playerAchievements.earnedAt),
          desc(playerAchievements.id),
        ),
      this.database
        .select({ award: matchAwards, scheduledAt: matches.scheduledAt })
        .from(matchAwards)
        .innerJoin(matches, eq(matches.id, matchAwards.matchId))
        .where(eq(matchAwards.playerId, playerId))
        .orderBy(desc(matchAwards.awardedAt), desc(matchAwards.id))
        .limit(PUBLIC_AWARD_LIMIT),
      this.database
        .select({ value: sql<number>`count(*)::int` })
        .from(matchAwards)
        .where(eq(matchAwards.playerId, playerId)),
    ]);
    return {
      achievements: achievements.map((row) => {
        const presented = presentAchievement(row);
        return {
          type: presented.type,
          earnedAt: presented.earnedAt,
          title: presented.title,
          description: presented.description,
        };
      }),
      recentAwards: awards.map(({ award: row, scheduledAt }) => ({
        type: row.type,
        awardedAt: row.awardedAt.toISOString(),
        scheduledAt: scheduledAt.toISOString(),
        ...awardCopy[row.type],
      })),
      achievementCount: achievements.length,
      awardCount: awardTotal?.value ?? 0,
    };
  }

  async reconcileActorMatch(actorPlayerId: string, matchId: string) {
    await Promise.all([
      this.reconcileAchievements(actorPlayerId),
      this.reconcileMatches([matchId]),
    ]);
    return this.forMatch(actorPlayerId, matchId);
  }

  async forMatch(actorPlayerId: string, matchId: string) {
    const [achievements, awards] = await Promise.all([
      this.database
        .select()
        .from(playerAchievements)
        .where(
          and(
            eq(playerAchievements.playerId, actorPlayerId),
            eq(playerAchievements.sourceMatchId, matchId),
          ),
        )
        .orderBy(asc(playerAchievements.type)),
      this.database
        .select({
          award: matchAwards,
          scheduledAt: matches.scheduledAt,
          groupId: groups.id,
          groupName: groups.name,
        })
        .from(matchAwards)
        .innerJoin(matches, eq(matches.id, matchAwards.matchId))
        .innerJoin(groups, eq(groups.id, matches.groupId))
        .where(
          and(
            eq(matchAwards.playerId, actorPlayerId),
            eq(matchAwards.matchId, matchId),
          ),
        )
        .orderBy(asc(matchAwards.type)),
    ]);
    return {
      achievements: achievements.map(presentAchievement),
      awards: awards.map(({ award, scheduledAt, groupId, groupName }) =>
        presentAward(award, scheduledAt, groupId, groupName),
      ),
    };
  }

  async reconcilePlayer(playerId: string) {
    await this.reconcileAchievements(playerId);
    const matchesToReconcile = await this.database
      .select({ matchId: progressionSnapshots.matchId })
      .from(progressionSnapshots)
      .where(
        and(
          eq(progressionSnapshots.playerId, playerId),
          eq(progressionSnapshots.discipline, "F5"),
        ),
      )
      .orderBy(desc(progressionSnapshots.processedAt))
      .limit(RECONCILIATION_MATCH_LIMIT);
    await this.reconcileMatches(matchesToReconcile.map((row) => row.matchId));
  }

  async reconcileMatches(matchIds: readonly string[]) {
    if (matchIds.length === 0) return;
    const rows = await this.database
      .select({
        matchId: matchParticipants.matchId,
        playerId: matchParticipants.playerId,
        aggregatedRating: progressionSnapshots.aggregatedRating,
        goals: matchParticipantStats.goals,
        assists: matchParticipantStats.assists,
        processedAt: progressionSnapshots.processedAt,
      })
      .from(matchParticipants)
      .innerJoin(
        progressionSnapshots,
        and(
          eq(progressionSnapshots.matchId, matchParticipants.matchId),
          eq(progressionSnapshots.playerId, matchParticipants.playerId),
          eq(progressionSnapshots.discipline, "F5"),
        ),
      )
      .leftJoin(
        matchParticipantStats,
        eq(matchParticipantStats.participantId, matchParticipants.id),
      )
      .where(
        and(
          inArray(matchParticipants.matchId, [...matchIds]),
          eq(matchParticipants.kind, "PLAYER"),
          eq(matchParticipants.status, "CONFIRMED"),
          eq(matchParticipants.attendance, "PLAYED"),
        ),
      );

    const byMatch = new Map<string, typeof rows>();
    for (const row of rows) {
      const group = byMatch.get(row.matchId) ?? [];
      group.push(row);
      byMatch.set(row.matchId, group);
    }

    const awards: (typeof matchAwards.$inferInsert)[] = [];
    for (const [matchId, participants] of byMatch) {
      const rated = participants.filter((row) => row.aggregatedRating !== null);
      if (rated.length > 0) {
        const maximum = Decimal.max(
          ...rated.map((row) => new Decimal(row.aggregatedRating!)),
        );
        for (const row of rated.filter((candidate) =>
          new Decimal(candidate.aggregatedRating!).eq(maximum),
        ))
          if (row.playerId)
            awards.push(
              award(matchId, row.playerId, "TOP_RATED", row.processedAt),
            );
      }
      addStatAwards(awards, matchId, participants, "goals", "TOP_SCORER");
      addStatAwards(awards, matchId, participants, "assists", "TOP_ASSIST");
    }
    if (awards.length > 0)
      await this.database
        .insert(matchAwards)
        .values(awards)
        .onConflictDoNothing({
          target: [matchAwards.matchId, matchAwards.playerId, matchAwards.type],
        });
  }

  private async reconcileAchievements(playerId: string) {
    const [milestones, firstGoal, hatTrick, firstAssist, highRating] =
      await Promise.all([
        this.database
          .select({
            matchId: progressionSnapshots.matchId,
            processedAt: progressionSnapshots.processedAt,
          })
          .from(progressionSnapshots)
          .innerJoin(matches, eq(matches.id, progressionSnapshots.matchId))
          .where(
            and(
              eq(progressionSnapshots.playerId, playerId),
              eq(progressionSnapshots.discipline, "F5"),
            ),
          )
          .orderBy(asc(matches.scheduledAt), asc(matches.id))
          .limit(10),
        this.statAchievement(playerId, gt(matchParticipantStats.goals, 0)),
        this.statAchievement(playerId, gte(matchParticipantStats.goals, 3)),
        this.statAchievement(playerId, gt(matchParticipantStats.assists, 0)),
        this.database
          .select({
            matchId: progressionSnapshots.matchId,
            processedAt: progressionSnapshots.processedAt,
          })
          .from(progressionSnapshots)
          .innerJoin(matches, eq(matches.id, progressionSnapshots.matchId))
          .where(
            and(
              eq(progressionSnapshots.playerId, playerId),
              eq(progressionSnapshots.discipline, "F5"),
              gte(progressionSnapshots.aggregatedRating, HIGH_RATING_THRESHOLD),
            ),
          )
          .orderBy(asc(matches.scheduledAt), asc(matches.id))
          .limit(1),
      ]);

    const candidates: (typeof playerAchievements.$inferInsert)[] = [];
    const add = (
      type: AchievementType,
      source: { matchId: string; processedAt: Date } | undefined,
    ) => {
      if (source)
        candidates.push({
          id: randomUUID(),
          playerId,
          type,
          sourceMatchId: source.matchId,
          earnedAt: source.processedAt,
        });
    };
    add("FIRST_MATCH", milestones[0]);
    add("FIVE_MATCHES", milestones[4]);
    add("TEN_MATCHES", milestones[9]);
    add("FIRST_GOAL", firstGoal[0]);
    add("HAT_TRICK", hatTrick[0]);
    add("FIRST_ASSIST", firstAssist[0]);
    add("HIGH_RATING", highRating[0]);
    if (candidates.length > 0)
      await this.database
        .insert(playerAchievements)
        .values(candidates)
        .onConflictDoNothing({
          target: [playerAchievements.playerId, playerAchievements.type],
        });
  }

  private statAchievement(playerId: string, condition: ReturnType<typeof gt>) {
    return this.database
      .select({
        matchId: progressionSnapshots.matchId,
        processedAt: progressionSnapshots.processedAt,
      })
      .from(progressionSnapshots)
      .innerJoin(matches, eq(matches.id, progressionSnapshots.matchId))
      .innerJoin(
        matchParticipants,
        and(
          eq(matchParticipants.matchId, progressionSnapshots.matchId),
          eq(matchParticipants.playerId, progressionSnapshots.playerId),
          eq(matchParticipants.kind, "PLAYER"),
          eq(matchParticipants.status, "CONFIRMED"),
          eq(matchParticipants.attendance, "PLAYED"),
        ),
      )
      .innerJoin(
        matchParticipantStats,
        eq(matchParticipantStats.participantId, matchParticipants.id),
      )
      .where(
        and(
          eq(progressionSnapshots.playerId, playerId),
          eq(progressionSnapshots.discipline, "F5"),
          condition,
        ),
      )
      .orderBy(asc(matches.scheduledAt), asc(matches.id))
      .limit(1);
  }
}

function award(
  matchId: string,
  playerId: string,
  type: AwardType,
  awardedAt: Date,
): typeof matchAwards.$inferInsert {
  return { id: randomUUID(), matchId, playerId, type, awardedAt };
}

function addStatAwards(
  target: (typeof matchAwards.$inferInsert)[],
  matchId: string,
  participants: {
    playerId: string | null;
    goals: number | null;
    assists: number | null;
    processedAt: Date;
  }[],
  field: "goals" | "assists",
  type: "TOP_SCORER" | "TOP_ASSIST",
) {
  const maximum = Math.max(...participants.map((row) => row[field] ?? 0));
  if (maximum <= 0) return;
  for (const row of participants.filter(
    (candidate) => candidate[field] === maximum,
  ))
    if (row.playerId)
      target.push(award(matchId, row.playerId, type, row.processedAt));
}

function presentAchievement(row: typeof playerAchievements.$inferSelect) {
  return {
    type: row.type,
    earnedAt: row.earnedAt.toISOString(),
    sourceMatchId: row.sourceMatchId,
    ...achievementCopy[row.type],
  };
}

function presentAward(
  row: typeof matchAwards.$inferSelect,
  scheduledAt: Date,
  groupId: string,
  groupName: string,
) {
  return {
    type: row.type,
    matchId: row.matchId,
    awardedAt: row.awardedAt.toISOString(),
    ...awardCopy[row.type],
    context: {
      group: { id: groupId, name: groupName },
      scheduledAt: scheduledAt.toISOString(),
    },
  };
}
