import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "@football/database";
import { groupGuests, matches } from "@football/database/schema";

export async function seedGroupGuest(
  database: Database,
  matchId: string,
  createdByPlayerId: string,
  displayName: string,
) {
  const [match] = await database
    .select({ groupId: matches.groupId })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) throw new Error("Match not found while seeding GroupGuest");
  const id = randomUUID();
  await database.insert(groupGuests).values({
    id,
    groupId: match.groupId,
    displayName,
    normalizedDisplayName: `${displayName.trim().toLowerCase()}-${id}`,
    status: "ACTIVE",
    createdByPlayerId,
  });
  return id;
}
