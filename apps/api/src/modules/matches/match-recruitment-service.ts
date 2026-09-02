import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@football/database";
import {
  groupMemberships,
  groups,
  matchParticipants,
  matchRecruitmentNeeds,
  matches,
  playerFootballPreferences,
  venues,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { hasGroupCapability } from "../groups/capabilities.js";
import { encodeCityRankingKey } from "../venues/venue-city-key.js";
import { presentVenueGeography } from "../venues/venue-geography-key.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type MatchRow = typeof matches.$inferSelect;
type Need = {
  role: typeof matchRecruitmentNeeds.$inferSelect.role;
  quantity: number;
};

const cursorSchema = z
  .object({
    version: z.literal(1),
    scheduledAt: z.iso.datetime(),
    matchId: z.uuid(),
  })
  .strict();

export class MatchRecruitmentService {
  constructor(private readonly database: Database) {}

  async replace(
    actorPlayerId: string,
    matchId: string,
    input: { enabled: boolean; needs: Need[] },
  ) {
    return this.database.transaction(async (tx) => {
      await tx.execute(
        sql`select id from ${matches} where id = ${matchId} for update`,
      );
      const [match] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1);
      if (!match)
        throw new ApplicationError("match_not_found", "Match not found", 404);
      await this.requireManager(tx, actorPlayerId, match.groupId);
      if (match.status !== "DRAFT" && match.status !== "OPEN")
        throw new ApplicationError(
          "match_not_open",
          "Recruitment is locked",
          409,
        );
      const roles = new Set(input.needs.map((need) => need.role));
      if (roles.size !== input.needs.length)
        throw new ApplicationError(
          "invalid_recruitment",
          "Recruitment roles must be unique",
          422,
        );
      if (
        input.needs.some(
          (need) => !Number.isInteger(need.quantity) || need.quantity <= 0,
        )
      )
        throw new ApplicationError(
          "invalid_recruitment",
          "Recruitment quantities must be positive integers",
          422,
        );
      const confirmed = await this.confirmedCount(tx, matchId);
      const openSpots = Math.max(match.capacity - confirmed, 0);
      const total = input.needs.reduce((sum, need) => sum + need.quantity, 0);
      if (input.enabled && total > openSpots)
        throw new ApplicationError(
          "invalid_recruitment",
          "Recruitment needs exceed current open spots",
          409,
        );
      await tx
        .update(matches)
        .set({ recruitmentEnabled: input.enabled, updatedAt: new Date() })
        .where(eq(matches.id, matchId));
      await tx
        .delete(matchRecruitmentNeeds)
        .where(eq(matchRecruitmentNeeds.matchId, matchId));
      if (input.needs.length)
        await tx.insert(matchRecruitmentNeeds).values(
          input.needs.map((need) => ({
            id: randomUUID(),
            matchId,
            role: need.role,
            quantity: need.quantity,
          })),
        );
      return this.model(match, confirmed, input.needs, input.enabled);
    });
  }

  async modelForMatch(match: MatchRow, confirmedCount: number) {
    const needs = await this.needsFor([match.id]);
    return this.model(match, confirmedCount, needs.get(match.id) ?? []);
  }

  async modelsForMatches(rows: { match: MatchRow; confirmedCount: number }[]) {
    const needs = await this.needsFor(rows.map((row) => row.match.id));
    return new Map(
      rows.map((row) => [
        row.match.id,
        this.model(
          row.match,
          row.confirmedCount,
          needs.get(row.match.id) ?? [],
        ),
      ]),
    );
  }

  async opportunities(
    actorPlayerId: string,
    input: { limit: number; cursor?: string },
  ) {
    const cursor = input.cursor ? this.decodeCursor(input.cursor) : null;
    const confirmedSql = sql<number>`(
      select count(*)::int from match_participants p
      where p.match_id = ${matches.id} and p.status = 'CONFIRMED'
    )`;
    const rows = await this.database
      .select({
        match: matches,
        groupName: groups.name,
        venue: venues,
        confirmedCount: confirmedSql,
      })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .innerJoin(matches, eq(matches.groupId, groupMemberships.groupId))
      .leftJoin(venues, eq(venues.id, matches.venueId))
      .where(
        and(
          eq(groupMemberships.playerId, actorPlayerId),
          eq(groupMemberships.status, "ACTIVE"),
          eq(groups.status, "ACTIVE"),
          eq(matches.discipline, "F5"),
          eq(matches.status, "OPEN"),
          eq(matches.recruitmentEnabled, true),
          sql`${matches.capacity} > ${confirmedSql}`,
          sql`not exists (
            select 1 from match_participants own
            where own.match_id = ${matches.id}
              and own.kind = 'PLAYER'
              and own.player_id = ${actorPlayerId}
              and own.status in ('CONFIRMED', 'WAITLISTED')
          )`,
          cursor
            ? or(
                gt(matches.scheduledAt, new Date(cursor.scheduledAt)),
                and(
                  eq(matches.scheduledAt, new Date(cursor.scheduledAt)),
                  gt(matches.id, cursor.matchId),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(matches.scheduledAt), asc(matches.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit);
    const needs = await this.needsFor(page.map((row) => row.match.id));
    const [preferences] = await this.database
      .select()
      .from(playerFootballPreferences)
      .where(
        and(
          eq(playerFootballPreferences.playerId, actorPlayerId),
          eq(playerFootballPreferences.discipline, "F5"),
        ),
      )
      .limit(1);
    return {
      items: page.map((row) => {
        const matchNeeds = needs.get(row.match.id) ?? [];
        return {
          matchId: row.match.id,
          group: { id: row.match.groupId, name: row.groupName },
          scheduledAt: row.match.scheduledAt.toISOString(),
          locationText: row.match.locationText,
          venue: row.venue
            ? {
                id: row.venue.id,
                displayName: row.venue.displayName,
                city: row.venue.city,
                cityKey: encodeCityRankingKey(row.venue.normalizedCity),
                ...presentVenueGeography(
                  row.venue.countryCode,
                  row.venue.provinceCode,
                ),
                address: row.venue.address,
                status: row.venue.status,
              }
            : null,
          openSpots: Math.max(row.match.capacity - row.confirmedCount, 0),
          needs: matchNeeds,
          matchesMyProfile: this.matchesProfile(matchNeeds, preferences),
        };
      }),
      nextCursor:
        rows.length > input.limit && page.length
          ? this.encodeCursor(page[page.length - 1]!.match)
          : null,
    };
  }

  private model(
    match: MatchRow,
    confirmedCount: number,
    needs: Need[],
    enabled = match.recruitmentEnabled,
  ) {
    const openSpots = Math.max(match.capacity - confirmedCount, 0);
    return {
      enabled,
      effectiveStatus:
        !enabled || match.status !== "OPEN"
          ? ("CLOSED" as const)
          : openSpots === 0
            ? ("FULL" as const)
            : ("OPEN" as const),
      openSpots,
      needs,
    };
  }

  private async needsFor(matchIds: string[]) {
    const result = new Map<string, Need[]>();
    if (!matchIds.length) return result;
    const rows = await this.database
      .select({
        matchId: matchRecruitmentNeeds.matchId,
        role: matchRecruitmentNeeds.role,
        quantity: matchRecruitmentNeeds.quantity,
      })
      .from(matchRecruitmentNeeds)
      .where(inArray(matchRecruitmentNeeds.matchId, matchIds))
      .orderBy(matchRecruitmentNeeds.role);
    for (const row of rows)
      result.set(row.matchId, [
        ...(result.get(row.matchId) ?? []),
        { role: row.role, quantity: row.quantity },
      ]);
    return result;
  }

  private confirmedCount(database: Database | Transaction, matchId: string) {
    return database
      .select({ value: sql<number>`count(*)::int` })
      .from(matchParticipants)
      .where(
        and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.status, "CONFIRMED"),
        ),
      )
      .then((rows) => rows[0]?.value ?? 0);
  }

  private async requireManager(
    database: Transaction,
    playerId: string,
    groupId: string,
  ) {
    const [membership] = await database
      .select({
        role: groupMemberships.role,
        capabilities: groupMemberships.capabilities,
      })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.playerId, playerId),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      )
      .limit(1);
    if (
      !membership ||
      !hasGroupCapability(
        membership.role,
        membership.capabilities,
        "MATCH_MANAGE",
      )
    )
      throw new ApplicationError("forbidden", "Forbidden", 403);
  }

  private matchesProfile(
    needs: Need[],
    preferences: typeof playerFootballPreferences.$inferSelect | undefined,
  ) {
    if (!preferences) return false;
    return needs.some(
      (need) =>
        preferences.preferredRoles.includes(need.role) ||
        (need.role === "PORTERO" && preferences.willingToPlayGoalkeeper),
    );
  }

  private encodeCursor(match: MatchRow) {
    return Buffer.from(
      JSON.stringify({
        version: 1,
        scheduledAt: match.scheduledAt.toISOString(),
        matchId: match.id,
      }),
    ).toString("base64url");
  }

  private decodeCursor(cursor: string) {
    try {
      return cursorSchema.parse(
        JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
      );
    } catch {
      throw new ApplicationError("invalid_cursor", "Invalid cursor", 400);
    }
  }
}
