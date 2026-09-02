import { Buffer } from "node:buffer";

import { and, desc, eq, lt, or } from "drizzle-orm";
import { z } from "zod";

import type {
  ProgressionHistoryEntry,
  ProgressionHistoryResponse,
} from "@football/contracts";
import { idSchema } from "@football/contracts";
import type { Database } from "@football/database";
import {
  groups,
  matches,
  matchSportingResults,
  progressionConfigVersions,
  progressionSnapshots,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { progressionSnapshotReadModel } from "./progression-snapshot-read-model.js";

const cursorSchema = z
  .object({
    version: z.literal(1),
    scheduledAt: z.iso.datetime(),
    matchId: idSchema,
  })
  .strict();

type HistoryCursor = z.infer<typeof cursorSchema>;

export class ProgressionHistoryService {
  constructor(private readonly database: Database) {}

  async list(
    actorPlayerId: string,
    input: { limit: number; cursor?: string },
  ): Promise<ProgressionHistoryResponse> {
    const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;
    const cursorCondition = cursor
      ? or(
          lt(matches.scheduledAt, new Date(cursor.scheduledAt)),
          and(
            eq(matches.scheduledAt, new Date(cursor.scheduledAt)),
            lt(matches.id, cursor.matchId),
          ),
        )
      : undefined;

    const rows = await this.database
      .select({
        snapshot: progressionSnapshots,
        configVersion: progressionConfigVersions.version,
        match: {
          id: matches.id,
          discipline: matches.discipline,
          scheduledAt: matches.scheduledAt,
        },
        group: { id: groups.id, name: groups.name },
        result: {
          status: matchSportingResults.status,
          teamAGoals: matchSportingResults.teamAGoals,
          teamBGoals: matchSportingResults.teamBGoals,
        },
      })
      .from(progressionSnapshots)
      .innerJoin(matches, eq(matches.id, progressionSnapshots.matchId))
      .innerJoin(groups, eq(groups.id, matches.groupId))
      .innerJoin(
        progressionConfigVersions,
        eq(progressionConfigVersions.id, progressionSnapshots.configVersionId),
      )
      .leftJoin(
        matchSportingResults,
        eq(matchSportingResults.matchId, matches.id),
      )
      .where(
        and(
          eq(progressionSnapshots.playerId, actorPlayerId),
          eq(progressionSnapshots.discipline, "F5"),
          cursorCondition,
        ),
      )
      .orderBy(desc(matches.scheduledAt), desc(matches.id))
      .limit(input.limit + 1);

    const page = rows.slice(0, input.limit);
    return {
      items: page.map(historyEntry),
      nextCursor:
        rows.length > input.limit && page.length > 0
          ? encodeCursor({
              version: 1,
              scheduledAt: page.at(-1)!.match.scheduledAt.toISOString(),
              matchId: page.at(-1)!.match.id,
            })
          : null,
    };
  }
}

function historyEntry(row: {
  snapshot: typeof progressionSnapshots.$inferSelect;
  configVersion: string;
  match: {
    id: string;
    discipline: "F5";
    scheduledAt: Date;
  };
  group: { id: string; name: string };
  result: {
    status: "DRAFT" | "CONFIRMED" | "NOT_PLAYED";
    teamAGoals: number | null;
    teamBGoals: number | null;
  } | null;
}): ProgressionHistoryEntry {
  if (
    row.result?.status !== "CONFIRMED" ||
    row.result.teamAGoals === null ||
    row.result.teamBGoals === null
  )
    throw new Error("Progression snapshot has invalid sporting context");

  const { teamAGoals, teamBGoals } = row.result;
  return {
    context: {
      matchId: row.match.id,
      discipline: row.match.discipline,
      scheduledAt: row.match.scheduledAt.toISOString(),
      group: row.group,
      result: {
        teamAGoals,
        teamBGoals,
        winner:
          teamAGoals === teamBGoals
            ? "DRAW"
            : teamAGoals > teamBGoals
              ? "TEAM_A"
              : "TEAM_B",
      },
    },
    snapshot: progressionSnapshotReadModel(row.snapshot, row.configVersion),
  };
}

function encodeCursor(cursor: HistoryCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): HistoryCursor {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    throw new ApplicationError(
      "invalid_cursor",
      "Invalid progression history cursor",
      400,
    );
  }
}
