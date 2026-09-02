import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "@football/database";
import { players } from "@football/database/schema";
import { ApplicationError } from "../errors.js";

export class PlayerService {
  constructor(private readonly database: Database) {}

  async provision(authUserId: string, displayName: string) {
    const player = await this.provisionForCompliance(authUserId, displayName);
    if (player.accountStatus === "ANONYMIZED")
      throw new ApplicationError(
        "account_anonymized",
        "This account is no longer active",
        403,
      );
    return player;
  }

  async provisionForCompliance(authUserId: string, displayName: string) {
    const [created] = await this.database
      .insert(players)
      .values({ id: randomUUID(), authUserId, displayName })
      .onConflictDoNothing({ target: players.authUserId })
      .returning();
    if (created) return created;
    const [existing] = await this.database
      .select()
      .from(players)
      .where(eq(players.authUserId, authUserId))
      .limit(1);
    if (!existing)
      throw new Error("Player provisioning failed after unique conflict");
    return existing;
  }

  async updateDisplayName(playerId: string, displayName: string) {
    const [updated] = await this.database
      .update(players)
      .set({ displayName, updatedAt: new Date() })
      .where(eq(players.id, playerId))
      .returning({ id: players.id, displayName: players.displayName });
    if (!updated) throw new Error("Player disappeared during identity update");
    return updated;
  }
}
