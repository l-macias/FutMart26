import { and, eq } from "drizzle-orm";

import type { ProgressionRevealResponse } from "@football/contracts";
import type { Database } from "@football/database";
import {
  groups,
  matchParticipants,
  matches,
  matchSportingResults,
  players,
  progressionConfigVersions,
  progressionSnapshots,
  votingSessions,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { votingClosesAt, votingOpensAt } from "../voting/voting-window.js";
import { RewardService } from "../rewards/reward-service.js";
import { progressionSnapshotReadModel } from "./progression-snapshot-read-model.js";
import { ProgressionService } from "./progression-service.js";

type PendingReason = Extract<
  ProgressionRevealResponse,
  { status: "PROGRESSION_PENDING" }
>["reason"];

export class ProgressionRevealService {
  constructor(
    private readonly database: Database,
    private readonly progression: ProgressionService,
    private readonly rewards: RewardService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async get(
    actorPlayerId: string,
    matchId: string,
  ): Promise<ProgressionRevealResponse> {
    const [match] = await this.database
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    if (!match)
      throw new ApplicationError("match_not_found", "Match not found", 404);

    const [participant] = await this.database
      .select({ displayName: players.displayName })
      .from(matchParticipants)
      .innerJoin(players, eq(players.id, matchParticipants.playerId))
      .where(
        and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.kind, "PLAYER"),
          eq(matchParticipants.playerId, actorPlayerId),
          eq(matchParticipants.status, "CONFIRMED"),
          eq(matchParticipants.attendance, "PLAYED"),
        ),
      )
      .limit(1);
    if (!participant)
      throw new ApplicationError(
        "forbidden",
        "Progression reveal is private",
        403,
      );

    const [snapshot] = await this.database
      .select({
        row: progressionSnapshots,
        configVersion: progressionConfigVersions.version,
      })
      .from(progressionSnapshots)
      .innerJoin(
        progressionConfigVersions,
        eq(progressionConfigVersions.id, progressionSnapshots.configVersionId),
      )
      .where(
        and(
          eq(progressionSnapshots.matchId, matchId),
          eq(progressionSnapshots.playerId, actorPlayerId),
          eq(progressionSnapshots.discipline, match.discipline),
        ),
      )
      .limit(1);

    if (snapshot)
      return this.available(
        match,
        participant.displayName,
        snapshot.row,
        snapshot.configVersion,
      );

    const [result] = await this.database
      .select()
      .from(matchSportingResults)
      .where(eq(matchSportingResults.matchId, matchId))
      .limit(1);
    if (
      match.status !== "FINISHED" ||
      !match.rosterConfirmedAt ||
      result?.status !== "CONFIRMED" ||
      !result.confirmedAt
    )
      return pending("CLOSURE_INCOMPLETE", null, null);

    const startsAt = votingOpensAt(
      match.scheduledAt,
      match.durationMinutes,
      result.confirmedAt,
    );
    const closesAt = votingClosesAt(startsAt);
    const now = this.clock();
    if (now < startsAt)
      return pending("VOTING_NOT_STARTED", startsAt, closesAt);

    const [session] = await this.database
      .select({ status: votingSessions.status })
      .from(votingSessions)
      .where(eq(votingSessions.matchId, matchId))
      .limit(1);
    if (session?.status === "CLOSED" || now >= closesAt)
      return pending("READY_TO_MATERIALIZE", startsAt, closesAt);

    return {
      status: "VOTING_OPEN",
      votingStartsAt: startsAt.toISOString(),
      votingClosesAt: closesAt.toISOString(),
    };
  }

  async materialize(
    actorPlayerId: string,
    matchId: string,
  ): Promise<ProgressionRevealResponse> {
    const current = await this.get(actorPlayerId, matchId);
    if (current.status === "AVAILABLE") {
      await this.rewards.reconcileActorMatch(actorPlayerId, matchId);
      return this.get(actorPlayerId, matchId);
    }
    if (
      current.status === "VOTING_OPEN" ||
      current.reason !== "READY_TO_MATERIALIZE"
    )
      return current;

    try {
      await this.progression.processMatch(matchId);
    } catch (error) {
      if (
        error instanceof ApplicationError &&
        error.code === "progression_out_of_order"
      )
        return {
          ...current,
          reason: "EARLIER_MATCH_PENDING",
        };
      throw error;
    }
    await this.rewards.reconcileActorMatch(actorPlayerId, matchId);
    return this.get(actorPlayerId, matchId);
  }

  private async available(
    match: typeof matches.$inferSelect,
    displayName: string,
    snapshot: typeof progressionSnapshots.$inferSelect,
    configVersion: string,
  ): Promise<ProgressionRevealResponse> {
    const [[group], [result]] = await Promise.all([
      this.database
        .select({ id: groups.id, name: groups.name })
        .from(groups)
        .where(eq(groups.id, match.groupId))
        .limit(1),
      this.database
        .select()
        .from(matchSportingResults)
        .where(eq(matchSportingResults.matchId, match.id))
        .limit(1),
    ]);
    if (
      !group ||
      result?.status !== "CONFIRMED" ||
      result.teamAGoals === null ||
      result.teamBGoals === null
    )
      throw new Error("Progression snapshot has invalid sporting context");

    const rewards = await this.rewards.forMatch(snapshot.playerId, match.id);
    return {
      status: "AVAILABLE",
      context: {
        matchId: match.id,
        discipline: match.discipline,
        scheduledAt: match.scheduledAt.toISOString(),
        group,
        result: {
          teamAGoals: result.teamAGoals,
          teamBGoals: result.teamBGoals,
          winner:
            result.teamAGoals === result.teamBGoals
              ? "DRAW"
              : result.teamAGoals > result.teamBGoals
                ? "TEAM_A"
                : "TEAM_B",
        },
        player: { displayName },
      },
      snapshot: progressionSnapshotReadModel(snapshot, configVersion),
      rewards,
    };
  }
}

function pending(
  reason: PendingReason,
  startsAt: Date | null,
  closesAt: Date | null,
): ProgressionRevealResponse {
  return {
    status: "PROGRESSION_PENDING",
    reason,
    votingStartsAt: startsAt?.toISOString() ?? null,
    votingClosesAt: closesAt?.toISOString() ?? null,
  };
}
