import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "@football/database";
import { players } from "@football/database/schema";

export class PlayerService {
  constructor(private readonly database: Database) {}

  async provision(authUserId: string, displayName: string) {
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
}
