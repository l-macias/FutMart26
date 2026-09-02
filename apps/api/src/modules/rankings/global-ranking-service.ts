import { Buffer } from "node:buffer";

import { sql } from "drizzle-orm";
import { z } from "zod";

import type { GlobalRankingResponse } from "@football/contracts";
import { idSchema, progressionDecimalSchema } from "@football/contracts";
import type { Database } from "@football/database";
import {
  accountSuspensions,
  playerPerformances,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";

const cursorSchema = z
  .object({
    version: z.literal(1),
    overall: progressionDecimalSchema,
    processedMatchCount: z.number().int().positive(),
    playerId: idSchema,
  })
  .strict();
type Cursor = z.infer<typeof cursorSchema>;
type Row = {
  player_id: string;
  display_name: string;
  overall: string;
  processed_match_count: number;
  position: number | string;
};

export class GlobalRankingService {
  constructor(private readonly database: Database) {}

  async list(
    actorPlayerId: string,
    input: { limit: number; cursor?: string },
  ): Promise<GlobalRankingResponse> {
    const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;
    const ranked = this.rankedQuery();
    const after = cursor
      ? sql`where (
          overall < ${cursor.overall}::numeric
          or (overall = ${cursor.overall}::numeric and processed_match_count < ${cursor.processedMatchCount})
          or (overall = ${cursor.overall}::numeric and processed_match_count = ${cursor.processedMatchCount} and player_id > ${cursor.playerId}::uuid)
        )`
      : sql``;
    const [result, actorResult] = await Promise.all([
      this.database.execute<Row>(sql`
        ${ranked}
        select * from ranked
        ${after}
        order by overall desc, processed_match_count desc, player_id asc
        limit ${input.limit + 1}
      `),
      this.database.execute<Row>(sql`
        ${ranked}
        select * from ranked where player_id = ${actorPlayerId}::uuid limit 1
      `),
    ]);
    const rows = Array.from(result);
    const page = rows.slice(0, input.limit);
    const actor = Array.from(actorResult)[0];

    return {
      scope: { type: "GLOBAL", label: "Global" },
      discipline: "F5",
      items: page.map((row) => ({
        position: Number(row.position),
        player: { id: row.player_id, displayName: row.display_name },
        performance: {
          overall: row.overall,
          processedMatchCount: Number(row.processed_match_count),
        },
        isCurrentPlayer: row.player_id === actorPlayerId,
      })),
      me: actor
        ? {
            ranked: true,
            position: Number(actor.position),
            overall: actor.overall,
            processedMatchCount: Number(actor.processed_match_count),
          }
        : { ranked: false },
      nextCursor:
        rows.length > input.limit && page.length > 0
          ? encodeCursor({
              version: 1,
              overall: page.at(-1)!.overall,
              processedMatchCount: Number(page.at(-1)!.processed_match_count),
              playerId: page.at(-1)!.player_id,
            })
          : null,
    };
  }

  private rankedQuery() {
    return sql`
      with ranked as (
        select
          ${players.id} as player_id,
          ${players.displayName} as display_name,
          ${playerPerformances.internalOvr} as overall,
          ${playerPerformances.processedMatchCount} as processed_match_count,
          row_number() over (
            order by ${playerPerformances.internalOvr} desc,
              ${playerPerformances.processedMatchCount} desc,
              ${players.id} asc
          ) as position
        from ${players}
        inner join ${playerPerformances}
          on ${playerPerformances.playerId} = ${players.id}
          and ${playerPerformances.discipline} = 'F5'
          and ${playerPerformances.processedMatchCount} > 0
        where ${players.profileVisibility} = 'PUBLIC'
          and ${players.accountStatus} = 'ACTIVE'
          and not exists (select 1 from ${accountSuspensions} where ${accountSuspensions.authUserId} = ${players.authUserId} and ${accountSuspensions.reactivatedAt} is null)
      )
    `;
  }
}

function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): Cursor {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    throw new ApplicationError("invalid_cursor", "Invalid ranking cursor", 400);
  }
}
