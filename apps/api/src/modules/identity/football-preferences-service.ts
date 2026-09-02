import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import type { Database } from "@football/database";
import { playerFootballPreferences } from "@football/database/schema";

type FootballRole = "LIBRE" | "DEFENSIVO" | "MEDIO" | "OFENSIVO" | "PORTERO";
type FootballStrength =
  "VELOCIDAD" | "PASE" | "REGATE" | "REMATE" | "DEFENSA" | "FISICO";

export class FootballPreferencesService {
  constructor(private readonly database: Database) {}

  async get(playerId: string) {
    const [row] = await this.database
      .select()
      .from(playerFootballPreferences)
      .where(
        and(
          eq(playerFootballPreferences.playerId, playerId),
          eq(playerFootballPreferences.discipline, "F5"),
        ),
      )
      .limit(1);
    return row
      ? this.present(row)
      : {
          configured: false,
          discipline: "F5" as const,
          preferredRoles: [] as FootballRole[],
          willingToPlayGoalkeeper: false,
          strengths: [] as FootballStrength[],
        };
  }

  async put(
    playerId: string,
    input: {
      preferredRoles: FootballRole[];
      willingToPlayGoalkeeper: boolean;
      strengths: FootballStrength[];
    },
  ) {
    const [row] = await this.database
      .insert(playerFootballPreferences)
      .values({
        id: randomUUID(),
        playerId,
        discipline: "F5",
        ...input,
      })
      .onConflictDoUpdate({
        target: [
          playerFootballPreferences.playerId,
          playerFootballPreferences.discipline,
        ],
        set: { ...input, updatedAt: new Date() },
      })
      .returning();
    return this.present(row!);
  }

  private present(row: typeof playerFootballPreferences.$inferSelect) {
    return {
      configured: true,
      discipline: "F5" as const,
      preferredRoles: row.preferredRoles,
      willingToPlayGoalkeeper: row.willingToPlayGoalkeeper,
      strengths: row.strengths,
    };
  }
}
