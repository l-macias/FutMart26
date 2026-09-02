import { randomUUID } from "node:crypto";

import { and, asc, eq, ilike } from "drizzle-orm";

import { countryCodeSchema, provinceCodeSchema } from "@football/contracts";
import type { Database } from "@football/database";
import {
  groupMemberships,
  groups,
  venueCourts,
  venues,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { hasGroupCapability } from "../groups/capabilities.js";
import { encodeCityRankingKey, normalizePlaceName } from "./venue-city-key.js";
import { presentVenueGeography } from "./venue-geography-key.js";

export { normalizePlaceName } from "./venue-city-key.js";

export class VenueService {
  constructor(private readonly database: Database) {}

  async search(query: string, city: string | undefined, limit: number) {
    const normalizedQuery = normalizePlaceName(query);
    const normalizedCity = city ? normalizePlaceName(city) : undefined;
    const rows = await this.database
      .select({
        id: venues.id,
        displayName: venues.displayName,
        city: venues.city,
        normalizedCity: venues.normalizedCity,
        countryCode: venues.countryCode,
        provinceCode: venues.provinceCode,
        address: venues.address,
        status: venues.status,
      })
      .from(venues)
      .where(
        and(
          eq(venues.status, "ACTIVE"),
          ilike(venues.normalizedName, `%${normalizedQuery}%`),
          normalizedCity === undefined
            ? undefined
            : eq(venues.normalizedCity, normalizedCity),
        ),
      )
      .orderBy(
        asc(venues.normalizedName),
        asc(venues.normalizedCity),
        asc(venues.id),
      )
      .limit(limit);
    return rows.map(({ normalizedCity: currentCity, ...row }) => ({
      ...row,
      cityKey: encodeCityRankingKey(currentCity),
      ...presentVenueGeography(row.countryCode, row.provinceCode),
    }));
  }

  async create(
    actorPlayerId: string,
    groupId: string,
    input: {
      displayName: string;
      city: string;
      address?: string | null;
      countryCode?: string | null;
      provinceCode?: string | null;
    },
  ) {
    await this.requireManager(actorPlayerId, groupId);
    const displayName = input.displayName
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ");
    const city = input.city.normalize("NFKC").trim().replace(/\s+/g, " ");
    const geography = this.normalizeGeography(
      input.countryCode,
      input.provinceCode,
    );
    try {
      const [venue] = await this.database
        .insert(venues)
        .values({
          id: randomUUID(),
          displayName,
          normalizedName: normalizePlaceName(displayName),
          city,
          normalizedCity: normalizePlaceName(city),
          ...geography,
          address: input.address?.normalize("NFKC").trim() || null,
          createdByPlayerId: actorPlayerId,
        })
        .returning();
      return this.presentVenue(venue!);
    } catch (error) {
      if (this.constraint(error) === "venues_active_name_city_uq") {
        const [candidate] = await this.database
          .select()
          .from(venues)
          .where(
            and(
              eq(venues.normalizedName, normalizePlaceName(displayName)),
              eq(venues.normalizedCity, normalizePlaceName(city)),
              eq(venues.status, "ACTIVE"),
            ),
          )
          .limit(1);
        throw new ApplicationError(
          "venue_candidate_conflict",
          "A Venue with that name already exists in this city",
          409,
          candidate ? { candidate: this.presentVenue(candidate) } : undefined,
        );
      }
      throw error;
    }
  }

  async courts(venueId: string) {
    return this.database
      .select({
        id: venueCourts.id,
        venueId: venueCourts.venueId,
        displayName: venueCourts.displayName,
        status: venueCourts.status,
      })
      .from(venueCourts)
      .where(
        and(eq(venueCourts.venueId, venueId), eq(venueCourts.status, "ACTIVE")),
      )
      .orderBy(asc(venueCourts.normalizedName), asc(venueCourts.id))
      .limit(100);
  }

  async createCourt(
    actorPlayerId: string,
    groupId: string,
    venueId: string,
    displayNameInput: string,
  ) {
    await this.requireManager(actorPlayerId, groupId);
    const displayName = displayNameInput
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ");
    const [venue] = await this.database
      .select({ id: venues.id })
      .from(venues)
      .where(and(eq(venues.id, venueId), eq(venues.status, "ACTIVE")))
      .limit(1);
    if (!venue)
      throw new ApplicationError("venue_not_found", "Venue not found", 404);
    try {
      const [court] = await this.database
        .insert(venueCourts)
        .values({
          id: randomUUID(),
          venueId,
          displayName,
          normalizedName: normalizePlaceName(displayName),
          createdByPlayerId: actorPlayerId,
        })
        .returning();
      return this.presentCourt(court!);
    } catch (error) {
      if (this.constraint(error) === "venue_courts_active_name_uq")
        throw new ApplicationError(
          "court_candidate_conflict",
          "A Court with that name already exists at this Venue",
          409,
        );
      throw error;
    }
  }

  private async requireManager(actorPlayerId: string, groupId: string) {
    const [membership] = await this.database
      .select({
        role: groupMemberships.role,
        capabilities: groupMemberships.capabilities,
        groupStatus: groups.status,
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
    if (
      !membership ||
      !hasGroupCapability(
        membership.role,
        membership.capabilities,
        "MATCH_MANAGE",
      )
    )
      throw new ApplicationError("forbidden", "Forbidden", 403);
    if (membership.groupStatus !== "ACTIVE")
      throw new ApplicationError("group_archived", "Group is archived", 409);
  }

  private presentVenue(row: typeof venues.$inferSelect) {
    return {
      id: row.id,
      displayName: row.displayName,
      city: row.city,
      cityKey: encodeCityRankingKey(row.normalizedCity),
      ...presentVenueGeography(row.countryCode, row.provinceCode),
      address: row.address,
      status: row.status,
    };
  }

  private normalizeGeography(
    countryInput: string | null | undefined,
    provinceInput: string | null | undefined,
  ) {
    try {
      const countryCode = countryInput
        ? countryCodeSchema.parse(countryInput)
        : null;
      const provinceCode = provinceInput
        ? provinceCodeSchema.parse(provinceInput)
        : null;
      if (provinceCode && !countryCode)
        throw new Error("Province requires country");
      if (
        provinceCode &&
        countryCode &&
        !provinceCode.startsWith(`${countryCode}-`)
      )
        throw new Error("Province does not belong to country");
      return { countryCode, provinceCode };
    } catch {
      throw new ApplicationError(
        "invalid_geography",
        "Invalid Venue geography",
        422,
      );
    }
  }

  private presentCourt(row: typeof venueCourts.$inferSelect) {
    return {
      id: row.id,
      venueId: row.venueId,
      displayName: row.displayName,
      status: row.status,
    };
  }

  private constraint(error: unknown) {
    let current = error;
    while (
      typeof current === "object" &&
      current &&
      !("constraint_name" in current) &&
      "cause" in current
    )
      current = current.cause;
    return typeof current === "object" &&
      current &&
      "constraint_name" in current
      ? String(current.constraint_name)
      : undefined;
  }
}
