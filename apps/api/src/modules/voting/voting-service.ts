import { randomUUID } from "node:crypto";

import { and, asc, eq, sql } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  evaluationEvidence,
  groupMemberships,
  matchParticipants,
  matchSportingResults,
  matches,
  playerEvaluations,
  players,
  votingBallots,
  votingSessions,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { hasGroupCapability } from "../groups/capabilities.js";
import { VOTING_V1_CONFIG } from "./voting-config.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Attribute =
  "PASE" | "REGATE" | "REMATE" | "DEFENSA" | "VELOCIDAD" | "FISICO";
type QuickEvaluation = {
  targetParticipantId: string;
  rating: number;
  quickSignal: "POSITIVE" | "IMPROVEMENT";
};
type FullEvaluation = {
  targetParticipantId: string;
  rating: number;
  strengths: Attribute[];
  improvements: Attribute[];
};
type BallotInput =
  | { mode: "QUICK"; evaluations: QuickEvaluation[] }
  | { mode: "FULL"; evaluations: FullEvaluation[] };

export class VotingService {
  constructor(
    private readonly database: Database,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async open(actorPlayerId: string, matchId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireVotingManager(tx, actorPlayerId, match.groupId);
      const existing = await this.sessionByMatch(tx, matchId);
      if (existing) return this.applyDeadline(tx, existing);
      if (match.status !== "FINISHED" || !match.rosterConfirmedAt)
        throw new ApplicationError(
          "roster_not_confirmed",
          "Final roster is not confirmed",
          409,
        );
      const [sportingResult] = await tx
        .select({ status: matchSportingResults.status })
        .from(matchSportingResults)
        .where(eq(matchSportingResults.matchId, matchId))
        .limit(1);
      if (!sportingResult || sportingResult.status !== "CONFIRMED")
        throw new ApplicationError(
          "sporting_result_not_confirmed",
          "Sporting result must be confirmed before Voting opens",
          409,
        );
      const now = this.clock();
      const eligibleAfter = this.eligibleAfter(match);
      if (now < eligibleAfter)
        throw new ApplicationError(
          "voting_not_eligible_yet",
          "Voting is not eligible yet",
          409,
          { votingEligibleAfter: eligibleAfter.toISOString() },
        );
      const session = {
        id: randomUUID(),
        matchId,
        status: "OPEN" as const,
        openedAt: now,
        closesAt: new Date(
          now.getTime() + VOTING_V1_CONFIG.durationHours * 3_600_000,
        ),
      };
      await tx.insert(votingSessions).values(session);
      return session;
    });
  }

  async get(actorPlayerId: string, matchId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireRead(tx, actorPlayerId, match.groupId);
      const session = await this.sessionByMatch(tx, matchId);
      if (!session)
        throw new ApplicationError(
          "voting_not_found",
          "Voting session not found",
          404,
        );
      const effective = await this.applyDeadline(tx, session);
      const targets = await this.playedParticipants(tx, matchId);
      const [ownBallot] = await tx
        .select({ id: votingBallots.id, mode: votingBallots.mode })
        .from(votingBallots)
        .where(
          and(
            eq(votingBallots.sessionId, session.id),
            eq(votingBallots.voterPlayerId, actorPlayerId),
          ),
        )
        .limit(1);
      return {
        status: effective.status,
        openedAt: effective.openedAt.toISOString(),
        closesAt: effective.closesAt.toISOString(),
        closeReason: effective.closeReason,
        hasSubmitted: Boolean(ownBallot),
        submittedMode: ownBallot?.mode ?? null,
        eligibleTargets: targets
          .filter((target) => target.playerId !== actorPlayerId)
          .map((target) => this.targetView(target)),
      };
    });
  }

  async submit(voterPlayerId: string, matchId: string, input: BallotInput) {
    return this.database.transaction(async (tx) => {
      const session = await this.lockSession(tx, matchId);
      const now = this.clock();
      if (session.status !== "OPEN" || now >= session.closesAt)
        throw new ApplicationError("voting_not_open", "Voting is closed", 409);
      const voter = await this.voterParticipation(tx, matchId, voterPlayerId);
      if (!voter)
        throw new ApplicationError(
          "voter_not_eligible",
          "Player is not eligible to vote",
          403,
        );
      const [existing] = await tx
        .select({ id: votingBallots.id })
        .from(votingBallots)
        .where(
          and(
            eq(votingBallots.sessionId, session.id),
            eq(votingBallots.voterPlayerId, voterPlayerId),
          ),
        )
        .limit(1);
      if (existing)
        throw new ApplicationError(
          "ballot_already_submitted",
          "Ballot already submitted",
          409,
        );
      await this.validateBallot(tx, matchId, voterPlayerId, input);
      const ballotId = randomUUID();
      await tx.insert(votingBallots).values({
        id: ballotId,
        sessionId: session.id,
        voterPlayerId,
        mode: input.mode,
        submittedAt: now,
      });
      for (const item of input.evaluations) {
        const evaluationId = randomUUID();
        await tx.insert(playerEvaluations).values({
          id: evaluationId,
          ballotId,
          targetParticipantId: item.targetParticipantId,
          rating: item.rating,
          quickSignal: "quickSignal" in item ? item.quickSignal : null,
        });
        if ("strengths" in item) {
          for (const attribute of item.strengths)
            await tx.insert(evaluationEvidence).values({
              id: randomUUID(),
              evaluationId,
              type: "STRENGTH",
              attribute,
            });
          for (const attribute of item.improvements)
            await tx.insert(evaluationEvidence).values({
              id: randomUUID(),
              evaluationId,
              type: "IMPROVEMENT",
              attribute,
            });
        }
      }
      const eligibleCount = await this.eligibleVoterCount(tx, matchId);
      const [submitted] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(votingBallots)
        .where(
          and(
            eq(votingBallots.sessionId, session.id),
            eq(votingBallots.status, "VALID"),
          ),
        );
      if (submitted!.count === eligibleCount) {
        await tx
          .update(votingSessions)
          .set({
            status: "CLOSED",
            closedAt: now,
            closeReason: "ALL_ELIGIBLE_VOTED",
            updatedAt: now,
          })
          .where(eq(votingSessions.id, session.id));
      }
      return {
        ballotId,
        status: submitted!.count === eligibleCount ? "CLOSED" : "OPEN",
      };
    });
  }

  async myBallot(voterPlayerId: string, matchId: string) {
    return this.database.transaction(async (tx) => {
      const session = await this.sessionByMatch(tx, matchId);
      if (!session)
        throw new ApplicationError(
          "voting_not_found",
          "Voting session not found",
          404,
        );
      if (!(await this.voterParticipation(tx, matchId, voterPlayerId)))
        throw new ApplicationError(
          "voter_not_eligible",
          "Player is not eligible to vote",
          403,
        );
      const [ballot] = await tx
        .select({
          id: votingBallots.id,
          mode: votingBallots.mode,
          submittedAt: votingBallots.submittedAt,
        })
        .from(votingBallots)
        .where(
          and(
            eq(votingBallots.sessionId, session.id),
            eq(votingBallots.voterPlayerId, voterPlayerId),
          ),
        )
        .limit(1);
      if (!ballot) return null;
      const rows = await tx
        .select({
          evaluationId: playerEvaluations.id,
          targetParticipantId: playerEvaluations.targetParticipantId,
          rating: playerEvaluations.rating,
          quickSignal: playerEvaluations.quickSignal,
          evidenceType: evaluationEvidence.type,
          attribute: evaluationEvidence.attribute,
        })
        .from(playerEvaluations)
        .leftJoin(
          evaluationEvidence,
          eq(evaluationEvidence.evaluationId, playerEvaluations.id),
        )
        .where(eq(playerEvaluations.ballotId, ballot.id))
        .orderBy(asc(playerEvaluations.createdAt));
      const evaluations = new Map<
        string,
        {
          targetParticipantId: string;
          rating: number;
          quickSignal: "POSITIVE" | "IMPROVEMENT" | null;
          strengths: Attribute[];
          improvements: Attribute[];
        }
      >();
      for (const row of rows) {
        const view = evaluations.get(row.evaluationId) ?? {
          targetParticipantId: row.targetParticipantId,
          rating: row.rating,
          quickSignal: row.quickSignal,
          strengths: [],
          improvements: [],
        };
        if (row.attribute && row.evidenceType === "STRENGTH")
          view.strengths.push(row.attribute);
        if (row.attribute && row.evidenceType === "IMPROVEMENT")
          view.improvements.push(row.attribute);
        evaluations.set(row.evaluationId, view);
      }
      return {
        mode: ballot.mode,
        submittedAt: ballot.submittedAt.toISOString(),
        evaluations: [...evaluations.values()],
      };
    });
  }

  private async validateBallot(
    tx: Transaction,
    matchId: string,
    voterPlayerId: string,
    input: BallotInput,
  ) {
    if (input.evaluations.length === 0)
      this.invalidBallot("At least one evaluation is required");
    const targetIds = input.evaluations.map((item) => item.targetParticipantId);
    if (new Set(targetIds).size !== targetIds.length)
      this.invalidBallot("Duplicate target");
    const targets = await this.playedParticipants(tx, matchId);
    const eligible = new Map(targets.map((target) => [target.id, target]));
    for (const item of input.evaluations) {
      if (!Number.isInteger(item.rating) || item.rating < 1 || item.rating > 10)
        this.invalidBallot("Rating must be an integer from 1 to 10");
      const target = eligible.get(item.targetParticipantId);
      if (!target) this.invalidBallot("Target is not evaluable");
      if (target.playerId === voterPlayerId)
        this.invalidBallot("Self evaluation is not allowed");
    }
    if (input.mode === "QUICK") {
      const positive = input.evaluations.filter(
        (item) => item.quickSignal === "POSITIVE",
      );
      const improvements = input.evaluations.filter(
        (item) => item.quickSignal === "IMPROVEMENT",
      );
      if (
        positive.length > VOTING_V1_CONFIG.maxQuickPerSignal ||
        improvements.length > VOTING_V1_CONFIG.maxQuickPerSignal
      )
        this.invalidBallot("Quick category limit exceeded");
      if (
        positive.some((item) => item.rating < 7 || item.rating > 10) ||
        improvements.some((item) => item.rating < 1 || item.rating > 5)
      )
        this.invalidBallot("Quick signal and rating are inconsistent");
    } else {
      for (const item of input.evaluations) {
        if (
          item.strengths.length > VOTING_V1_CONFIG.maxEvidencePerType ||
          item.improvements.length > VOTING_V1_CONFIG.maxEvidencePerType
        )
          this.invalidBallot("Evidence tag limit exceeded");
        if (
          new Set(item.strengths).size !== item.strengths.length ||
          new Set(item.improvements).size !== item.improvements.length
        )
          this.invalidBallot("Duplicate evidence tag");
        const valid =
          item.rating <= 5
            ? item.strengths.length === 0
            : item.rating === 6
              ? item.strengths.length === 0 && item.improvements.length === 0
              : item.improvements.length === 0;
        if (!valid) this.invalidBallot("Evidence is inconsistent with rating");
      }
    }
  }

  private playedParticipants(db: Transaction, matchId: string) {
    return db
      .select({
        id: matchParticipants.id,
        kind: matchParticipants.kind,
        playerId: matchParticipants.playerId,
        playerName: players.displayName,
        guestName: matchParticipants.guestDisplayName,
      })
      .from(matchParticipants)
      .leftJoin(players, eq(players.id, matchParticipants.playerId))
      .where(
        and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.status, "CONFIRMED"),
          eq(matchParticipants.attendance, "PLAYED"),
        ),
      )
      .orderBy(asc(matchParticipants.admissionOrder))
      .limit(200);
  }

  private targetView(
    row: Awaited<ReturnType<typeof this.playedParticipants>>[number],
  ) {
    return {
      participantId: row.id,
      kind: row.kind,
      displayName: row.kind === "PLAYER" ? row.playerName : row.guestName,
    };
  }

  private async voterParticipation(
    db: Transaction,
    matchId: string,
    playerId: string,
  ) {
    const [row] = await db
      .select({ id: matchParticipants.id })
      .from(matchParticipants)
      .where(
        and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.kind, "PLAYER"),
          eq(matchParticipants.playerId, playerId),
          eq(matchParticipants.status, "CONFIRMED"),
          eq(matchParticipants.attendance, "PLAYED"),
        ),
      )
      .limit(1);
    return row;
  }

  private async eligibleVoterCount(db: Transaction, matchId: string) {
    const [row] = await db
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
    return row!.count;
  }

  private async applyDeadline(
    tx: Transaction,
    session: typeof votingSessions.$inferSelect,
  ) {
    const now = this.clock();
    if (session.status === "OPEN" && now >= session.closesAt) {
      await tx
        .update(votingSessions)
        .set({
          status: "CLOSED",
          closedAt: now,
          closeReason: "DEADLINE",
          updatedAt: now,
        })
        .where(eq(votingSessions.id, session.id));
      return {
        ...session,
        status: "CLOSED" as const,
        closedAt: now,
        closeReason: "DEADLINE" as const,
      };
    }
    return session;
  }

  private eligibleAfter(match: typeof matches.$inferSelect) {
    return new Date(
      match.scheduledAt.getTime() +
        (match.durationMinutes + VOTING_V1_CONFIG.gracePeriodMinutes) * 60_000,
    );
  }

  private sessionByMatch(db: Transaction, matchId: string) {
    return db
      .select()
      .from(votingSessions)
      .where(eq(votingSessions.matchId, matchId))
      .limit(1)
      .then((rows) => rows[0]);
  }

  private async lockSession(tx: Transaction, matchId: string) {
    const rows = await tx.execute(
      sql`select id from ${votingSessions} where match_id = ${matchId} for update`,
    );
    if (rows.length === 0)
      throw new ApplicationError(
        "voting_not_found",
        "Voting session not found",
        404,
      );
    return (await this.sessionByMatch(tx, matchId))!;
  }

  private async lockMatch(tx: Transaction, matchId: string) {
    const rows = await tx.execute(
      sql`select id from ${matches} where id = ${matchId} for update`,
    );
    if (rows.length === 0)
      throw new ApplicationError("match_not_found", "Match not found", 404);
    return (await tx.select().from(matches).where(eq(matches.id, matchId)))[0]!;
  }

  private async requireVotingManager(
    db: Transaction,
    playerId: string,
    groupId: string,
  ) {
    const membership = await this.membership(db, playerId, groupId);
    if (
      !membership ||
      !hasGroupCapability(
        membership.role,
        membership.capabilities,
        "MATCH_MANAGE_VOTING",
      )
    )
      throw new ApplicationError("forbidden", "Forbidden", 403);
  }

  private async requireRead(
    db: Transaction,
    playerId: string,
    groupId: string,
  ) {
    const membership = await this.membership(db, playerId, groupId);
    if (
      !membership ||
      !hasGroupCapability(
        membership.role,
        membership.capabilities,
        "GROUP_READ",
      )
    )
      throw new ApplicationError("forbidden", "Forbidden", 403);
  }

  private membership(db: Transaction, playerId: string, groupId: string) {
    return db
      .select()
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.playerId, playerId),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);
  }

  private invalidBallot(message: string): never {
    throw new ApplicationError("invalid_ballot", message, 409);
  }
}
