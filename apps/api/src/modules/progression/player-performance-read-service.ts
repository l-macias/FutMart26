import { and, eq } from "drizzle-orm";

import type { Database } from "@football/database";
import { playerPerformances } from "@football/database/schema";

const INITIAL_ATTRIBUTE = 60;

export class PlayerPerformanceReadService {
  constructor(private readonly database: Database) {}

  async getF5(playerId: string) {
    const row = (
      await this.database
        .select()
        .from(playerPerformances)
        .where(
          and(
            eq(playerPerformances.playerId, playerId),
            eq(playerPerformances.discipline, "F5"),
          ),
        )
        .limit(1)
    )[0];

    if (!row) {
      return {
        discipline: "F5" as const,
        initialized: false,
        overall: 60,
        ratingProfile: "LIBRE" as const,
        attributes: {
          VELOCIDAD: INITIAL_ATTRIBUTE,
          PASE: INITIAL_ATTRIBUTE,
          REGATE: INITIAL_ATTRIBUTE,
          REMATE: INITIAL_ATTRIBUTE,
          DEFENSA: INITIAL_ATTRIBUTE,
          FISICO: INITIAL_ATTRIBUTE,
        },
        processedMatchCount: 0,
        lastProcessedScheduledAt: null,
      };
    }

    return {
      discipline: "F5" as const,
      initialized: true,
      overall: Number(row.internalOvr),
      ratingProfile: row.ratingProfile,
      attributes: {
        VELOCIDAD: Number(row.velocidad),
        PASE: Number(row.pase),
        REGATE: Number(row.regate),
        REMATE: Number(row.remate),
        DEFENSA: Number(row.defensa),
        FISICO: Number(row.fisico),
      },
      processedMatchCount: row.processedMatchCount,
      lastProcessedScheduledAt:
        row.lastProcessedScheduledAt?.toISOString() ?? null,
    };
  }
}
