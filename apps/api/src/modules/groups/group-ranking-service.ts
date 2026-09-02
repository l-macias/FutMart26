import { Buffer } from "node:buffer";

import { and, count, desc, eq, gt, lt, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { GroupRankingResponse } from "@football/contracts";
import { idSchema, progressionDecimalSchema } from "@football/contracts";
import type { Database } from "@football/database";
import {
  groupMemberships,
  groups,
  playerPerformances,
  players,
  progressionSnapshots,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { hasGroupCapability } from "./capabilities.js";

const cursorSchema = z
  .object({
    version: z.literal(1),
    overall: progressionDecimalSchema,
    processedMatchCount: z.number().int().positive(),
    playerId: idSchema,
  })
  .strict();
type RankingCursor = z.infer<typeof cursorSchema>;

const eligible = (groupId: string) =>
  and(
    eq(groupMemberships.groupId, groupId),
    eq(groupMemberships.status, "ACTIVE"),
    eq(playerPerformances.discipline, "F5"),
    gt(playerPerformances.processedMatchCount, 0),
  );

const after = (cursor: RankingCursor) =>
  or(
    lt(playerPerformances.internalOvr, cursor.overall),
    and(
      eq(playerPerformances.internalOvr, cursor.overall),
      lt(playerPerformances.processedMatchCount, cursor.processedMatchCount),
    ),
    and(
      eq(playerPerformances.internalOvr, cursor.overall),
      eq(playerPerformances.processedMatchCount, cursor.processedMatchCount),
      gt(players.id, cursor.playerId),
    ),
  );

const before = (cursor: RankingCursor) =>
  or(
    gt(playerPerformances.internalOvr, cursor.overall),
    and(
      eq(playerPerformances.internalOvr, cursor.overall),
      gt(playerPerformances.processedMatchCount, cursor.processedMatchCount),
    ),
    and(
      eq(playerPerformances.internalOvr, cursor.overall),
      eq(playerPerformances.processedMatchCount, cursor.processedMatchCount),
      lt(players.id, cursor.playerId),
    ),
  );

const at = (cursor: RankingCursor) =>
  and(
    eq(playerPerformances.internalOvr, cursor.overall),
    eq(playerPerformances.processedMatchCount, cursor.processedMatchCount),
    eq(players.id, cursor.playerId),
  );

export class GroupRankingService {
  constructor(private readonly database: Database) {}

  async list(
    actorPlayerId: string,
    groupId: string,
    input: { limit: number; cursor?: string },
  ): Promise<GroupRankingResponse> {
    const [access] = await this.database
      .select({
        groupName: groups.name,
        role: groupMemberships.role,
        capabilities: groupMemberships.capabilities,
      })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.playerId, actorPlayerId),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (!access) throw new ApplicationError("forbidden", "Forbidden", 403);
    if (!hasGroupCapability(access.role, access.capabilities, "GROUP_READ"))
      throw new ApplicationError("forbidden", "Forbidden", 403);

    const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;
    const rankBase = cursor
      ? Number(
          (
            await this.database
              .select({ value: count() })
              .from(groupMemberships)
              .innerJoin(players, eq(players.id, groupMemberships.playerId))
              .innerJoin(
                playerPerformances,
                eq(playerPerformances.playerId, players.id),
              )
              .where(and(eligible(groupId), or(before(cursor), at(cursor))))
          )[0]?.value ?? 0,
        )
      : 0;

    const rows = await this.database
      .select({
        playerId: players.id,
        displayName: players.displayName,
        overall: playerPerformances.internalOvr,
        processedMatchCount: playerPerformances.processedMatchCount,
        recentMatchId: sql<string | null>`(
          select ${progressionSnapshots.matchId}
          from ${progressionSnapshots}
          where ${progressionSnapshots.playerId} = ${players.id}
            and ${progressionSnapshots.discipline} = 'F5'
          order by ${progressionSnapshots.processedAt} desc, ${progressionSnapshots.id} desc
          limit 1
        )`,
        recentOvrDelta: sql<string | null>`(
          select ${progressionSnapshots.ovrDelta}
          from ${progressionSnapshots}
          where ${progressionSnapshots.playerId} = ${players.id}
            and ${progressionSnapshots.discipline} = 'F5'
          order by ${progressionSnapshots.processedAt} desc, ${progressionSnapshots.id} desc
          limit 1
        )`,
        recentOutcome: sql<"APPLIED" | "NEUTRAL" | "NO_EVIDENCE" | null>`(
          select ${progressionSnapshots.processingOutcome}
          from ${progressionSnapshots}
          where ${progressionSnapshots.playerId} = ${players.id}
            and ${progressionSnapshots.discipline} = 'F5'
          order by ${progressionSnapshots.processedAt} desc, ${progressionSnapshots.id} desc
          limit 1
        )`,
      })
      .from(groupMemberships)
      .innerJoin(players, eq(players.id, groupMemberships.playerId))
      .innerJoin(
        playerPerformances,
        eq(playerPerformances.playerId, players.id),
      )
      .where(and(eligible(groupId), cursor ? after(cursor) : undefined))
      .orderBy(
        desc(playerPerformances.internalOvr),
        desc(playerPerformances.processedMatchCount),
        players.id,
      )
      .limit(input.limit + 1);

    const page = rows.slice(0, input.limit);
    const [actorPerformance] = await this.database
      .select({
        playerId: players.id,
        overall: playerPerformances.internalOvr,
        processedMatchCount: playerPerformances.processedMatchCount,
      })
      .from(groupMemberships)
      .innerJoin(players, eq(players.id, groupMemberships.playerId))
      .innerJoin(
        playerPerformances,
        eq(playerPerformances.playerId, players.id),
      )
      .where(
        and(eligible(groupId), eq(groupMemberships.playerId, actorPlayerId)),
      )
      .limit(1);
    let me: GroupRankingResponse["me"] = { ranked: false };
    if (actorPerformance) {
      const actorCursor: RankingCursor = {
        version: 1,
        overall: actorPerformance.overall,
        processedMatchCount: actorPerformance.processedMatchCount,
        playerId: actorPerformance.playerId,
      };
      const [preceding] = await this.database
        .select({ value: count() })
        .from(groupMemberships)
        .innerJoin(players, eq(players.id, groupMemberships.playerId))
        .innerJoin(
          playerPerformances,
          eq(playerPerformances.playerId, players.id),
        )
        .where(and(eligible(groupId), before(actorCursor)));
      me = {
        ranked: true,
        position: Number(preceding?.value ?? 0) + 1,
        overall: actorPerformance.overall,
        processedMatchCount: actorPerformance.processedMatchCount,
      };
    }

    return {
      group: { id: groupId, name: access.groupName },
      discipline: "F5",
      items: page.map((row, index) => ({
        position: rankBase + index + 1,
        player: { id: row.playerId, displayName: row.displayName },
        performance: {
          overall: row.overall,
          processedMatchCount: row.processedMatchCount,
        },
        recent:
          row.recentMatchId && row.recentOvrDelta && row.recentOutcome
            ? {
                matchId: row.recentMatchId,
                ovrDelta: row.recentOvrDelta,
                processingOutcome: row.recentOutcome,
              }
            : null,
        isCurrentPlayer: row.playerId === actorPlayerId,
      })),
      me,
      nextCursor:
        rows.length > input.limit && page.length > 0
          ? encodeCursor({
              version: 1,
              overall: page.at(-1)!.overall,
              processedMatchCount: page.at(-1)!.processedMatchCount,
              playerId: page.at(-1)!.playerId,
            })
          : null,
    };
  }
}

function encodeCursor(cursor: RankingCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): RankingCursor {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    throw new ApplicationError("invalid_cursor", "Invalid ranking cursor", 400);
  }
}
