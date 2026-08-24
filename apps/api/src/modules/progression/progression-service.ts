import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, lte, sql } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  evaluationEvidence,
  matchParticipants,
  matches,
  playerEvaluations,
  playerPerformances,
  progressionConfigVersions,
  progressionSnapshots,
  votingBallots,
  votingSessions,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
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
      await this.requireEffectivelyClosedVoting(tx, matchId, processedAt);
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
        await this.provisionAndLockPerformance(
          tx,
          participant.playerId,
          match.discipline,
        );
        const existing = await this.snapshot(
          tx,
          participant.playerId,
          matchId,
          match.discipline,
        );
        if (existing) {
          results.push(existing);
          continue;
        }
        await this.assertHistoricalOrder(
          tx,
          participant.playerId,
          matchId,
          match.scheduledAt,
          processedAt,
        );
        const performance = await this.performance(
          tx,
          participant.playerId,
          match.discipline,
        );
        const evidence = await this.evidence(
          tx,
          matchId,
          participant.participantId,
          participant.playerId,
        );
        const calculation = calculateProgression(
          this.stateFromPerformance(performance),
          evidence,
          config,
        );
        const snapshot = {
          id: randomUUID(),
          playerId: participant.playerId,
          matchId,
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
          configVersionId: configRow.id,
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
            lastProcessedMatchId: matchId,
            lastProcessedScheduledAt: match.scheduledAt,
            updatedAt: processedAt,
          })
          .where(eq(playerPerformances.id, performance.id));
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

  private async assertHistoricalOrder(
    tx: Transaction,
    playerId: string,
    matchId: string,
    scheduledAt: Date,
    now: Date,
  ) {
    const rows = await tx.execute(sql`
      select prior.id
      from ${matches} prior
      join ${matchParticipants} participant
        on participant.match_id = prior.id
       and participant.kind = 'PLAYER'
       and participant.player_id = ${playerId}
       and participant.status = 'CONFIRMED'
       and participant.attendance = 'PLAYED'
      join ${votingSessions} session
        on session.match_id = prior.id
       and (session.status = 'CLOSED' or session.closes_at <= ${now.toISOString()}::timestamptz)
      left join ${progressionSnapshots} snapshot
        on snapshot.match_id = prior.id
       and snapshot.player_id = ${playerId}
       and snapshot.discipline = prior.discipline
      where prior.status = 'FINISHED'
        and snapshot.id is null
        and prior.id <> ${matchId}
        and (prior.scheduled_at < ${scheduledAt.toISOString()}::timestamptz or (prior.scheduled_at = ${scheduledAt.toISOString()}::timestamptz and prior.id::text < ${matchId}::text))
      limit 1
    `);
    if (rows.length > 0)
      throw new ApplicationError(
        "progression_out_of_order",
        "An earlier closed Match must be processed first",
        409,
      );
  }

  private async requireEffectivelyClosedVoting(
    tx: Transaction,
    matchId: string,
    now: Date,
  ) {
    const locked = await tx.execute(
      sql`select id from ${votingSessions} where match_id = ${matchId} for update`,
    );
    if (locked.length === 0)
      throw new ApplicationError(
        "progression_not_ready",
        "Voting session does not exist",
        409,
      );
    const [session] = await tx
      .select()
      .from(votingSessions)
      .where(eq(votingSessions.matchId, matchId));
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
          closedAt: now,
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
