import { Buffer } from "node:buffer";

import { asc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import type { TerritorialRankingResponse } from "@football/contracts";
import {
  countryDisplayName,
  idSchema,
  progressionDecimalSchema,
  provinceDisplayName,
} from "@football/contracts";
import type { Database } from "@football/database";
import {
  accountSuspensions,
  matches,
  matchParticipants,
  matchSportingResults,
  playerPerformances,
  players,
  venues,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import {
  decodeCityRankingKey,
  encodeCityRankingKey,
} from "../venues/venue-city-key.js";
import {
  decodeCountryRankingKey,
  decodeProvinceRankingKey,
  encodeCountryRankingKey,
  presentVenueGeography,
} from "../venues/venue-geography-key.js";

const cursorSchema = z
  .object({
    version: z.literal(1),
    overall: progressionDecimalSchema,
    processedMatchCount: z.number().int().positive(),
    playerId: idSchema,
  })
  .strict();
type RankingCursor = z.infer<typeof cursorSchema>;
type Scope =
  | { type: "VENUE"; venueId: string }
  | { type: "CITY"; cityKey: string }
  | { type: "PROVINCE"; provinceKey: string }
  | { type: "COUNTRY"; countryKey: string };
type RankingRow = {
  player_id: string;
  display_name: string;
  overall: string;
  processed_match_count: number;
  matches_played: number;
  last_played_at: Date | string;
  position: number | string;
};

export class TerritorialRankingService {
  constructor(private readonly database: Database) {}

  async list(
    actorPlayerId: string,
    scope: Scope,
    input: { limit: number; cursor?: string },
  ): Promise<TerritorialRankingResponse> {
    const descriptor = await this.resolveScope(scope);
    const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;
    const scopeCondition = this.scopeCondition(scope);
    const ranked = this.rankedQuery(scopeCondition);
    const after = cursor
      ? sql`where (
          overall < ${cursor.overall}::numeric
          or (overall = ${cursor.overall}::numeric and processed_match_count < ${cursor.processedMatchCount})
          or (overall = ${cursor.overall}::numeric and processed_match_count = ${cursor.processedMatchCount} and player_id > ${cursor.playerId}::uuid)
        )`
      : sql``;
    const result = await this.database.execute<RankingRow>(sql`
      ${ranked}
      select * from ranked
      ${after}
      order by overall desc, processed_match_count desc, player_id asc
      limit ${input.limit + 1}
    `);
    const rows = Array.from(result);
    const page = rows.slice(0, input.limit);
    const actorResult = await this.database.execute<RankingRow>(sql`
      ${ranked}
      select * from ranked where player_id = ${actorPlayerId}::uuid limit 1
    `);
    const actor = Array.from(actorResult)[0];

    return {
      scope: descriptor,
      discipline: "F5",
      items: page.map((row) => ({
        position: Number(row.position),
        player: { id: row.player_id, displayName: row.display_name },
        performance: {
          overall: row.overall,
          processedMatchCount: Number(row.processed_match_count),
        },
        scopeStats: {
          matchesPlayed: Number(row.matches_played),
          lastPlayedAt: new Date(row.last_played_at).toISOString(),
        },
        isCurrentPlayer: row.player_id === actorPlayerId,
      })),
      me: actor
        ? {
            ranked: true,
            position: Number(actor.position),
            overall: actor.overall,
            processedMatchCount: Number(actor.processed_match_count),
            scopeStats: {
              matchesPlayed: Number(actor.matches_played),
              lastPlayedAt: new Date(actor.last_played_at).toISOString(),
            },
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

  private rankedQuery(scopeCondition: SQL) {
    return sql`
      with territorial as (
        select
          ${matchParticipants.playerId} as player_id,
          count(distinct ${matches.id})::int as matches_played,
          max(${matches.scheduledAt}) as last_played_at
        from ${matches}
        inner join ${venues} on ${venues.id} = ${matches.venueId}
        inner join ${matchSportingResults}
          on ${matchSportingResults.matchId} = ${matches.id}
          and ${matchSportingResults.status} = 'CONFIRMED'
        inner join ${matchParticipants}
          on ${matchParticipants.matchId} = ${matches.id}
        where ${matches.discipline} = 'F5'
          and ${matches.status} = 'FINISHED'
          and ${matchParticipants.kind} = 'PLAYER'
          and ${matchParticipants.status} = 'CONFIRMED'
          and ${matchParticipants.attendance} = 'PLAYED'
          and ${scopeCondition}
        group by ${matchParticipants.playerId}
      ), ranked as (
        select
          ${players.id} as player_id,
          ${players.displayName} as display_name,
          ${playerPerformances.internalOvr} as overall,
          ${playerPerformances.processedMatchCount} as processed_match_count,
          territorial.matches_played,
          territorial.last_played_at,
          row_number() over (
            order by ${playerPerformances.internalOvr} desc,
              ${playerPerformances.processedMatchCount} desc,
              ${players.id} asc
          ) as position
        from territorial
        inner join ${players} on ${players.id} = territorial.player_id
        inner join ${playerPerformances}
          on ${playerPerformances.playerId} = territorial.player_id
          and ${playerPerformances.discipline} = 'F5'
          and ${playerPerformances.processedMatchCount} > 0
        where ${players.profileVisibility} = 'PUBLIC'
          and ${players.accountStatus} = 'ACTIVE'
          and not exists (select 1 from ${accountSuspensions} where ${accountSuspensions.authUserId} = ${players.authUserId} and ${accountSuspensions.reactivatedAt} is null)
      )
    `;
  }

  private scopeCondition(scope: Scope) {
    switch (scope.type) {
      case "VENUE":
        return sql`${matches.venueId} = ${scope.venueId}`;
      case "CITY":
        return sql`${venues.normalizedCity} = ${decodeCityRankingKey(scope.cityKey)}`;
      case "PROVINCE":
        return sql`${venues.provinceCode} = ${decodeProvinceRankingKey(scope.provinceKey)}`;
      case "COUNTRY":
        return sql`${venues.countryCode} = ${decodeCountryRankingKey(scope.countryKey)}`;
    }
  }

  private async resolveScope(
    scope: Scope,
  ): Promise<TerritorialRankingResponse["scope"]> {
    if (scope.type === "VENUE") {
      const [venue] = await this.database
        .select({
          id: venues.id,
          name: venues.displayName,
          city: venues.city,
          normalizedCity: venues.normalizedCity,
          countryCode: venues.countryCode,
          provinceCode: venues.provinceCode,
        })
        .from(venues)
        .where(eq(venues.id, scope.venueId))
        .limit(1);
      if (!venue)
        throw new ApplicationError("venue_not_found", "Venue not found", 404);
      return {
        type: "VENUE",
        id: venue.id,
        name: venue.name,
        city: venue.city,
        cityKey: encodeCityRankingKey(venue.normalizedCity),
        ...this.parentLinks(venue.countryCode, venue.provinceCode),
      };
    }
    if (scope.type === "PROVINCE") {
      const provinceCode = decodeProvinceRankingKey(scope.provinceKey);
      const [venue] = await this.database
        .select({ countryCode: venues.countryCode })
        .from(venues)
        .where(eq(venues.provinceCode, provinceCode))
        .orderBy(asc(venues.createdAt), asc(venues.id))
        .limit(1);
      if (!venue?.countryCode)
        throw new ApplicationError(
          "province_not_found",
          "Province not found",
          404,
        );
      return {
        type: "PROVINCE",
        key: scope.provinceKey,
        code: provinceCode,
        name: provinceDisplayName(provinceCode),
        country: this.countryLink(venue.countryCode),
      };
    }
    if (scope.type === "COUNTRY") {
      const countryCode = decodeCountryRankingKey(scope.countryKey);
      const [venue] = await this.database
        .select({ id: venues.id })
        .from(venues)
        .where(eq(venues.countryCode, countryCode))
        .limit(1);
      if (!venue)
        throw new ApplicationError(
          "country_not_found",
          "Country not found",
          404,
        );
      return {
        type: "COUNTRY",
        key: scope.countryKey,
        code: countryCode,
        name: countryDisplayName(countryCode),
      };
    }
    const normalizedCity = decodeCityRankingKey(scope.cityKey);
    const [venue] = await this.database
      .select({ city: venues.city })
      .from(venues)
      .where(eq(venues.normalizedCity, normalizedCity))
      .orderBy(asc(venues.createdAt), asc(venues.id))
      .limit(1);
    if (!venue)
      throw new ApplicationError("city_not_found", "City not found", 404);
    const parents = await this.cityParents(normalizedCity);
    return {
      type: "CITY",
      key: scope.cityKey,
      name: venue.city,
      ...parents,
    };
  }

  private async cityParents(normalizedCity: string) {
    const result = await this.database.execute<{
      country_code: string | null;
      province_code: string | null;
    }>(sql`
      select distinct ${venues.countryCode} as country_code,
        ${venues.provinceCode} as province_code
      from ${venues}
      inner join ${matches} on ${matches.venueId} = ${venues.id}
      inner join ${matchSportingResults}
        on ${matchSportingResults.matchId} = ${matches.id}
        and ${matchSportingResults.status} = 'CONFIRMED'
      inner join ${matchParticipants}
        on ${matchParticipants.matchId} = ${matches.id}
        and ${matchParticipants.kind} = 'PLAYER'
        and ${matchParticipants.status} = 'CONFIRMED'
        and ${matchParticipants.attendance} = 'PLAYED'
      where ${venues.normalizedCity} = ${normalizedCity}
        and ${matches.discipline} = 'F5'
        and ${matches.status} = 'FINISHED'
    `);
    const rows = Array.from(result);
    if (rows.length === 0) return { province: null, country: null };
    const countryCodes = new Set(rows.map((row) => row.country_code));
    const provinceCodes = new Set(rows.map((row) => row.province_code));
    const countryCode =
      countryCodes.size === 1 ? (rows[0]?.country_code ?? null) : null;
    const provinceCode =
      provinceCodes.size === 1 ? (rows[0]?.province_code ?? null) : null;
    return this.parentLinks(countryCode, provinceCode);
  }

  private parentLinks(countryCode: string | null, provinceCode: string | null) {
    const geography = presentVenueGeography(countryCode, provinceCode);
    return {
      country:
        geography.countryCode && geography.countryKey && geography.countryName
          ? {
              code: geography.countryCode,
              key: geography.countryKey,
              name: geography.countryName,
            }
          : null,
      province:
        geography.provinceCode &&
        geography.provinceKey &&
        geography.provinceName
          ? {
              code: geography.provinceCode,
              key: geography.provinceKey,
              name: geography.provinceName,
            }
          : null,
    };
  }

  private countryLink(countryCode: string) {
    return {
      code: countryCode,
      key: encodeCountryRankingKey(countryCode),
      name: countryDisplayName(countryCode),
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
    throw new ApplicationError(
      "invalid_cursor",
      "Invalid territorial ranking cursor",
      400,
    );
  }
}
