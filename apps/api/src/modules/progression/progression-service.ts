import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, lte, sql } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  evaluationEvidence,
  matchParticipants,
  matches,
  matchSportingResults,
  playerEvaluations,
  playerPerformances,
  progressionConfigVersions,
  progressionSnapshots,
  votingBallots,
  votingSessions,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { votingClosesAt, votingOpensAt } from "../voting/voting-window.js";
import {
  ATTRIBUTES,
  type Attribute,
  progressionConfigSchema,
} from "./progression-config.js";
import {
  calculateProgression,
  initialPerformanceState,
  type MatchEvidence,
  type ProgressionState,
} from "./progression-engine.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const performanceColumns: Record<
  Attribute,
  keyof typeof playerPerformances.$inferSelect
> = {
  VELOCIDAD: "velocidad",
  PASE: "pase",
  REGATE: "regate",
  REMATE: "remate",
  DEFENSA: "defensa",
  FISICO: "fisico",
};

export class ProgressionService {
  constructor(
    private readonly database: Database,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async processMatch(matchId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      if (match.status !== "FINISHED" || !match.rosterConfirmedAt)
        throw new ApplicationError(
          "progression_not_ready",
          "Match and final roster are not complete",
          409,
        );
      const processedAt = this.clock();
      await this.requireEffectivelyClosedVoting(tx, match, processedAt);
      const configRow = await this.resolveConfig(
        tx,
        match.discipline,
        processedAt,
      );
      const config = progressionConfigSchema.parse(configRow.document);
      const participants = await tx
        .select({
          participantId: matchParticipants.id,
          playerId: matchParticipants.playerId,
        })
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.matchId, matchId),
            eq(matchParticipants.kind, "PLAYER"),
            eq(matchParticipants.status, "CONFIRMED"),
            eq(matchParticipants.attendance, "PLAYED"),
          ),
        )
        .orderBy(asc(matchParticipants.playerId));

      const results = [];
      for (const participant of participants) {
        if (!participant.playerId) continue;
        const existingBeforeLock = await this.snapshot(
          tx,
          participant.playerId,
          matchId,
          match.discipline,
        );
        if (existingBeforeLock) {
          results.push(existingBeforeLock);
          continue;
        }
        const predecessors = await this.pendingPredecessors(
          tx,
          participant.playerId,
          matchId,
          match.scheduledAt,
          match.discipline,
        );
        for (const predecessor of predecessors) {
          try {
            await this.requireEffectivelyClosedVoting(
              tx,
              predecessor.match,
              processedAt,
            );
          } catch (error) {
            if (
              error instanceof ApplicationError &&
              error.code === "progression_not_ready"
            )
              throw new ApplicationError(
                "progression_chain_blocked",
                "An earlier Match is not ready for progression",
                409,
              );
            throw error;
          }
        }
        await this.provisionAndLockPerformance(
          tx,
          participant.playerId,
          match.discipline,
        );
        const existingAfterLock = await this.snapshot(
          tx,
          participant.playerId,
          matchId,
          match.discipline,
        );
        if (existingAfterLock) {
          results.push(existingAfterLock);
          continue;
        }
        for (const predecessor of predecessors) {
          await this.processPlayerMatch(
            tx,
            predecessor.match,
            predecessor.participantId,
            participant.playerId,
            config,
            configRow.id,
            processedAt,
          );
        }
        const snapshot = await this.processPlayerMatch(
          tx,
          match,
          participant.participantId,
          participant.playerId,
          config,
          configRow.id,
          processedAt,
        );
        results.push(snapshot);
      }
      return results;
    });
  }

  private async evidence(
    tx: Transaction,
    matchId: string,
    participantId: string,
    playerId: string,
  ): Promise<MatchEvidence> {
    const countRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(matchParticipants)
      .where(
        and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.kind, "PLAYER"),
          eq(matchParticipants.status, "CONFIRMED"),
          eq(matchParticipants.attendance, "PLAYED"),
        ),
      );
    const playedPlayers = countRows[0]?.count ?? 0;
    const rows = await tx
      .select({
        evaluationId: playerEvaluations.id,
        rating: playerEvaluations.rating,
        voterPlayerId: votingBallots.voterPlayerId,
        evidenceType: evaluationEvidence.type,
        attribute: evaluationEvidence.attribute,
      })
      .from(playerEvaluations)
      .innerJoin(
        votingBallots,
        eq(votingBallots.id, playerEvaluations.ballotId),
      )
      .innerJoin(votingSessions, eq(votingSessions.id, votingBallots.sessionId))
      .leftJoin(
        evaluationEvidence,
        eq(evaluationEvidence.evaluationId, playerEvaluations.id),
      )
      .where(
        and(
          eq(votingSessions.matchId, matchId),
          eq(votingBallots.status, "VALID"),
          eq(playerEvaluations.targetParticipantId, participantId),
        ),
      );
    const evaluations = new Map<
      string,
      { rating: number; strengths: Attribute[]; improvements: Attribute[] }
    >();
    for (const row of rows) {
      if (row.voterPlayerId === playerId)
        throw new ApplicationError(
          "invalid_progression_evidence",
          "Self evaluation cannot be processed",
          409,
        );
      const item = evaluations.get(row.evaluationId) ?? {
        rating: row.rating,
        strengths: [],
        improvements: [],
      };
      if (row.attribute && row.evidenceType === "STRENGTH")
        item.strengths.push(row.attribute);
      if (row.attribute && row.evidenceType === "IMPROVEMENT")
        item.improvements.push(row.attribute);
      evaluations.set(row.evaluationId, item);
    }
    return {
      ratings: [...evaluations.values()].map((item) => item.rating),
      eligibleEvaluatorsForTarget: Math.max(0, playedPlayers - 1),
      strengthTags: [...evaluations.values()].map((item) => item.strengths),
      improvementTags: [...evaluations.values()].map(
        (item) => item.improvements,
      ),
    };
  }

  private async provisionAndLockPerformance(
    tx: Transaction,
    playerId: string,
    discipline: "F5",
  ) {
    const initial = initialPerformanceState();
    await tx
      .insert(playerPerformances)
      .values({
        id: randomUUID(),
        playerId,
        discipline,
        ratingProfile: initial.ratingProfile,
        velocidad: initial.attributes.VELOCIDAD,
        pase: initial.attributes.PASE,
        regate: initial.attributes.REGATE,
        remate: initial.attributes.REMATE,
        defensa: initial.attributes.DEFENSA,
        fisico: initial.attributes.FISICO,
        internalOvr: "60.000000000000",
      })
      .onConflictDoNothing({
        target: [playerPerformances.playerId, playerPerformances.discipline],
      });
    await tx.execute(
      sql`select id from ${playerPerformances} where player_id = ${playerId} and discipline = ${discipline} for update`,
    );
  }

  private pendingPredecessors(
    tx: Transaction,
    playerId: string,
    matchId: string,
    scheduledAt: Date,
    discipline: "F5",
  ) {
    return tx
      .select({
        match: matches,
        participantId: matchParticipants.id,
      })
      .from(matches)
      .innerJoin(
        matchParticipants,
        and(
          eq(matchParticipants.matchId, matches.id),
          eq(matchParticipants.kind, "PLAYER"),
          eq(matchParticipants.playerId, playerId),
          eq(matchParticipants.status, "CONFIRMED"),
          eq(matchParticipants.attendance, "PLAYED"),
        ),
      )
      .leftJoin(
        progressionSnapshots,
        and(
          eq(progressionSnapshots.matchId, matches.id),
          eq(progressionSnapshots.playerId, playerId),
          eq(progressionSnapshots.discipline, matches.discipline),
        ),
      )
      .where(
        and(
          eq(matches.status, "FINISHED"),
          eq(matches.discipline, discipline),
          sql`${matches.rosterConfirmedAt} is not null`,
          sql`${progressionSnapshots.id} is null`,
          sql`${matches.id} <> ${matchId}`,
          sql`(${matches.scheduledAt} < ${scheduledAt.toISOString()}::timestamptz or (${matches.scheduledAt} = ${scheduledAt.toISOString()}::timestamptz and ${matches.id}::text < ${matchId}::text))`,
        ),
      )
      .orderBy(asc(matches.scheduledAt), asc(matches.id));
  }

  private async processPlayerMatch(
    tx: Transaction,
    match: typeof matches.$inferSelect,
    participantId: string,
    playerId: string,
    config: ReturnType<typeof progressionConfigSchema.parse>,
    configVersionId: string,
    processedAt: Date,
  ) {
    const existing = await this.snapshot(
      tx,
      playerId,
      match.id,
      match.discipline,
    );
    if (existing) return existing;
    const performance = await this.performance(tx, playerId, match.discipline);
    const evidence = await this.evidence(tx, match.id, participantId, playerId);
    const calculation = calculateProgression(
      this.stateFromPerformance(performance),
      evidence,
      config,
    );
    const snapshot = {
      id: randomUUID(),
      playerId,
      matchId: match.id,
      discipline: match.discipline,
      beforeAttributes: calculation.beforeAttributes,
      afterAttributes: calculation.afterAttributes,
      attributeDeltas: calculation.attributeDeltas,
      beforeOvr: calculation.beforeOvr,
      afterOvr: calculation.afterOvr,
      ovrDelta: calculation.ovrDelta,
      evaluationsReceived: calculation.evaluationsReceived,
      eligibleEvaluatorsForTarget: calculation.eligibleEvaluatorsForTarget,
      aggregatedRating: calculation.aggregatedRating,
      participationRatio: calculation.participationRatio,
      confidenceMultiplier: calculation.confidenceMultiplier,
      rawPerformanceSignal: calculation.rawPerformanceSignal,
      effectivePerformanceSignal: calculation.effectivePerformanceSignal,
      streakBefore: calculation.streakBefore,
      streakAfter: calculation.streakAfter,
      streakMultiplier: calculation.streakMultiplier,
      progressionBudget: calculation.progressionBudget,
      baseDistribution: calculation.baseDistribution,
      tagCoverage: calculation.tagCoverage,
      tagDistribution: calculation.tagDistribution,
      finalDistribution: calculation.finalDistribution,
      configVersionId,
      processingOutcome: calculation.processingOutcome,
      processedAt,
    };
    await tx.insert(progressionSnapshots).values(snapshot);
    await tx
      .update(playerPerformances)
      .set({
        velocidad: calculation.afterAttributes.VELOCIDAD,
        pase: calculation.afterAttributes.PASE,
        regate: calculation.afterAttributes.REGATE,
        remate: calculation.afterAttributes.REMATE,
        defensa: calculation.afterAttributes.DEFENSA,
        fisico: calculation.afterAttributes.FISICO,
        internalOvr: calculation.afterOvr,
        streakDirection: calculation.streakAfter.direction,
        streakCount: calculation.streakAfter.count,
        processedMatchCount: performance.processedMatchCount + 1,
        lastProcessedMatchId: match.id,
        lastProcessedScheduledAt: match.scheduledAt,
        updatedAt: processedAt,
      })
      .where(eq(playerPerformances.id, performance.id));
    return snapshot;
  }

  private async requireEffectivelyClosedVoting(
    tx: Transaction,
    match: typeof matches.$inferSelect,
    now: Date,
  ) {
    await tx.execute(
      sql`select id from ${votingSessions} where match_id = ${match.id} for update`,
    );
    let [session] = await tx
      .select()
      .from(votingSessions)
      .where(eq(votingSessions.matchId, match.id));

    if (!session) {
      const [result] = await tx
        .select({
          status: matchSportingResults.status,
          confirmedAt: matchSportingResults.confirmedAt,
        })
        .from(matchSportingResults)
        .where(eq(matchSportingResults.matchId, match.id))
        .limit(1);
      if (result?.status !== "CONFIRMED" || !result.confirmedAt)
        throw new ApplicationError(
          "progression_not_ready",
          "Sporting result is not confirmed",
          409,
        );
      const openedAt = votingOpensAt(
        match.scheduledAt,
        match.durationMinutes,
        result.confirmedAt,
      );
      const closesAt = votingClosesAt(openedAt);
      if (now < closesAt)
        throw new ApplicationError(
          "progression_not_ready",
          "Voting window is still open",
          409,
        );
      await tx.insert(votingSessions).values({
        id: randomUUID(),
        matchId: match.id,
        status: "CLOSED",
        openedAt,
        closesAt,
        closedAt: closesAt,
        closeReason: "DEADLINE",
      });
      [session] = await tx
        .select()
        .from(votingSessions)
        .where(eq(votingSessions.matchId, match.id));
    }

    if (session!.status === "OPEN" && now < session!.closesAt)
      throw new ApplicationError(
        "progression_not_ready",
        "Voting session is still open",
        409,
      );
    if (session!.status === "OPEN")
      await tx
        .update(votingSessions)
        .set({
          status: "CLOSED",
          closedAt: session!.closesAt,
          closeReason: "DEADLINE",
          updatedAt: now,
        })
        .where(eq(votingSessions.id, session!.id));
  }

  private async resolveConfig(
    tx: Transaction,
    discipline: "F5",
    processedAt: Date,
  ) {
    const [row] = await tx
      .select()
      .from(progressionConfigVersions)
      .where(
        and(
          eq(progressionConfigVersions.discipline, discipline),
          lte(progressionConfigVersions.activatedAt, processedAt),
        ),
      )
      .orderBy(
        desc(progressionConfigVersions.activatedAt),
        desc(progressionConfigVersions.version),
      )
      .limit(1);
    if (!row)
      throw new ApplicationError(
        "progression_config_not_found",
        "No active progression configuration",
        409,
      );
    return row;
  }

  private async lockMatch(tx: Transaction, matchId: string) {
    const locked = await tx.execute(
      sql`select id from ${matches} where id = ${matchId} for update`,
    );
    if (locked.length === 0)
      throw new ApplicationError("match_not_found", "Match not found", 404);
    return (await tx.select().from(matches).where(eq(matches.id, matchId)))[0]!;
  }

  private performance(tx: Transaction, playerId: string, discipline: "F5") {
    return tx
      .select()
      .from(playerPerformances)
      .where(
        and(
          eq(playerPerformances.playerId, playerId),
          eq(playerPerformances.discipline, discipline),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]!);
  }

  private snapshot(
    tx: Transaction,
    playerId: string,
    matchId: string,
    discipline: "F5",
  ) {
    return tx
      .select()
      .from(progressionSnapshots)
      .where(
        and(
          eq(progressionSnapshots.playerId, playerId),
          eq(progressionSnapshots.matchId, matchId),
          eq(progressionSnapshots.discipline, discipline),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);
  }

  private stateFromPerformance(
    performance: typeof playerPerformances.$inferSelect,
  ): ProgressionState {
    return {
      attributes: Object.fromEntries(
        ATTRIBUTES.map((attribute) => [
          attribute,
          String(performance[performanceColumns[attribute]]),
        ]),
      ) as ProgressionState["attributes"],
      ratingProfile: performance.ratingProfile,
      streak: {
        direction: performance.streakDirection,
        count: performance.streakCount,
      },
    };
  }
}
