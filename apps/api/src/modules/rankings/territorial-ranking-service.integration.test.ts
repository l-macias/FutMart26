import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "@football/database";
import {
  authUser,
  groupMemberships,
  groupGuests,
  groups,
  matches,
  matchParticipants,
  matchSportingResults,
  playerPerformances,
  players,
  venueCourts,
  venues,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { encodeCityRankingKey } from "../venues/venue-city-key.js";
import {
  encodeCountryRankingKey,
  encodeProvinceRankingKey,
} from "../venues/venue-geography-key.js";
import { VenueService } from "../venues/venue-service.js";
import { TerritorialRankingService } from "./territorial-ranking-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl && new URL(databaseUrl).pathname.slice(1).endsWith("_test")
    ? databaseUrl
    : undefined;

void test(
  "Venue and City rankings derive unique Players from real territorial participation",
  { skip: !safeUrl },
  async (context) => {
    const connection = createDatabase(safeUrl!);
    context.after(() => connection.client.end());
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });
    const geographyConstraints = await connection.client.unsafe<
      { conname: string }[]
    >(
      "select conname from pg_constraint where conrelid = 'public.venues'::regclass and conname like 'venues_%_ck' order by conname",
    );
    for (const constraint of [
      "venues_country_code_format_ck",
      "venues_province_code_format_ck",
      "venues_province_country_ck",
    ])
      assert.ok(
        geographyConstraints.some((row) => row.conname === constraint),
        `Missing ${constraint}`,
      );
    const service = new TerritorialRankingService(connection.db);
    const venueService = new VenueService(connection.db);

    async function player(name: string, overall: string, processed = 1) {
      const authUserId = randomUUID();
      const id = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        email: `${authUserId}@territorial.test`,
        name,
      });
      await connection.db
        .insert(players)
        .values({ id, authUserId, displayName: name });
      await connection.db.insert(playerPerformances).values({
        id: randomUUID(),
        playerId: id,
        discipline: "F5",
        velocidad: "60",
        pase: "60",
        regate: "60",
        remate: "60",
        defensa: "60",
        fisico: "60",
        internalOvr: overall,
        processedMatchCount: processed,
      });
      return id;
    }

    const actor = await player("Actor", "75.000000000000", 4);
    const leader = await player("Leader", "90.000000000000", 2);
    const tieMore = await player("Tie more", "80.000000000000", 5);
    const tieLess = await player("Tie less", "80.000000000000", 3);
    const zero = await player("Zero", "99.000000000000", 0);
    const owner = actor;
    const groupId = randomUUID();
    await connection.db.insert(groups).values({
      id: groupId,
      name: "Territorial Test",
      createdByPlayerId: owner,
    });
    await connection.db.insert(groupMemberships).values({
      id: randomUUID(),
      groupId,
      playerId: owner,
      role: "OWNER",
    });
    const venueOne = randomUUID();
    const venueTwo = randomUUID();
    const venueOtherCity = randomUUID();
    const venueCountryOnly = randomUUID();
    const venueBrazil = randomUUID();
    const legacyVenue = randomUUID();
    const ambiguousArgentinaVenue = randomUUID();
    const ambiguousBrazilVenue = randomUUID();
    const venueSuffix = randomUUID();
    const geographySeed = venueSuffix.replaceAll("-", "").toUpperCase();
    const countryOne = `${String.fromCharCode(65 + (Number.parseInt(geographySeed.slice(0, 2), 16) % 26))}${String.fromCharCode(65 + (Number.parseInt(geographySeed.slice(2, 4), 16) % 26))}`;
    const countryTwo = `${String.fromCharCode(65 + (Number.parseInt(geographySeed.slice(4, 6), 16) % 26))}${String.fromCharCode(65 + (Number.parseInt(geographySeed.slice(6, 8), 16) % 26))}`;
    const effectiveCountryTwo =
      countryTwo === countryOne
        ? countryOne === "ZZ"
          ? "YY"
          : "ZZ"
        : countryTwo;
    const provinceOne = `${countryOne}-${geographySeed.slice(8, 11)}`;
    const provinceTwo = `${countryOne}-${geographySeed.slice(11, 14)}`;
    const foreignProvince = `${effectiveCountryTwo}-${geographySeed.slice(14, 17)}`;
    const rosarioCity = `Rosario ${venueSuffix}`;
    const normalizedRosario = `rosario ${venueSuffix}`;
    const cordobaCity = `Córdoba ${venueSuffix}`;
    const normalizedCordoba = `córdoba ${venueSuffix}`;
    const ambiguousCity = `San José ${venueSuffix}`;
    const normalizedAmbiguousCity = `san josé ${venueSuffix}`;
    await connection.db.insert(venues).values([
      {
        id: venueOne,
        displayName: `La Filial ${venueSuffix}`,
        normalizedName: `la filial ${venueSuffix}`,
        city: rosarioCity,
        normalizedCity: normalizedRosario,
        countryCode: countryOne,
        provinceCode: provinceOne,
        createdByPlayerId: owner,
      },
      {
        id: venueTwo,
        displayName: `El Galpón ${venueSuffix}`,
        normalizedName: `el galpón ${venueSuffix}`,
        city: ` ${rosarioCity.toLocaleUpperCase("es-AR")} `,
        normalizedCity: normalizedRosario,
        countryCode: countryOne,
        provinceCode: provinceOne,
        createdByPlayerId: owner,
      },
      {
        id: venueOtherCity,
        displayName: `La Docta ${venueSuffix}`,
        normalizedName: `la docta ${venueSuffix}`,
        city: cordobaCity,
        normalizedCity: normalizedCordoba,
        countryCode: countryOne,
        provinceCode: provinceTwo,
        createdByPlayerId: owner,
      },
      {
        id: venueCountryOnly,
        displayName: `Country only ${venueSuffix}`,
        normalizedName: `country only ${venueSuffix}`,
        city: `Mendoza ${venueSuffix}`,
        normalizedCity: `mendoza ${venueSuffix}`,
        countryCode: countryOne,
        createdByPlayerId: owner,
      },
      {
        id: venueBrazil,
        displayName: `Brasil ${venueSuffix}`,
        normalizedName: `brasil ${venueSuffix}`,
        city: `São Paulo ${venueSuffix}`,
        normalizedCity: `são paulo ${venueSuffix}`,
        countryCode: effectiveCountryTwo,
        provinceCode: foreignProvince,
        createdByPlayerId: owner,
      },
      {
        id: legacyVenue,
        displayName: `Legacy ${venueSuffix}`,
        normalizedName: `legacy ${venueSuffix}`,
        city: `Legacy City ${venueSuffix}`,
        normalizedCity: `legacy city ${venueSuffix}`,
        createdByPlayerId: owner,
      },
      {
        id: ambiguousArgentinaVenue,
        displayName: `Ambiguous AR ${venueSuffix}`,
        normalizedName: `ambiguous ar ${venueSuffix}`,
        city: ambiguousCity,
        normalizedCity: normalizedAmbiguousCity,
        countryCode: countryOne,
        provinceCode: provinceOne,
        createdByPlayerId: owner,
      },
      {
        id: ambiguousBrazilVenue,
        displayName: `Ambiguous BR ${venueSuffix}`,
        normalizedName: `ambiguous br ${venueSuffix}`,
        city: ambiguousCity,
        normalizedCity: normalizedAmbiguousCity,
        countryCode: effectiveCountryTwo,
        provinceCode: foreignProvince,
        createdByPlayerId: owner,
      },
    ]);
    const legacyCreated = await venueService.create(owner, groupId, {
      displayName: `Legacy create ${venueSuffix}`,
      city: `Legacy create city ${venueSuffix}`,
    });
    assert.equal(legacyCreated.countryCode, null);
    assert.equal(legacyCreated.provinceCode, null);
    const canonicalCreated = await venueService.create(owner, groupId, {
      displayName: `Canonical create ${venueSuffix}`,
      city: `Canonical city ${venueSuffix}`,
      countryCode: "ar",
      provinceCode: "ar-s",
    });
    assert.equal(canonicalCreated.countryCode, "AR");
    assert.equal(canonicalCreated.provinceCode, "AR-S");
    assert.equal(canonicalCreated.countryName, "Argentina");
    assert.equal(canonicalCreated.provinceName, "Santa Fe");
    for (const geography of [
      { countryCode: "ARG", provinceCode: null },
      { countryCode: null, provinceCode: "AR-S" },
      { countryCode: "BR", provinceCode: "AR-S" },
    ])
      await assert.rejects(
        venueService.create(owner, groupId, {
          displayName: `Invalid geography ${randomUUID()}`,
          city: `Invalid city ${randomUUID()}`,
          ...geography,
        }),
        (error: unknown) =>
          error instanceof ApplicationError &&
          error.code === "invalid_geography",
      );
    const courtOne = randomUUID();
    const courtTwo = randomUUID();
    await connection.db.insert(venueCourts).values([
      {
        id: courtOne,
        venueId: venueOne,
        displayName: "Cancha 1",
        normalizedName: "cancha 1",
        createdByPlayerId: owner,
      },
      {
        id: courtTwo,
        venueId: venueOne,
        displayName: "Cancha 2",
        normalizedName: "cancha 2",
        createdByPlayerId: owner,
      },
    ]);
    const guestId = randomUUID();
    await connection.db.insert(groupGuests).values({
      id: guestId,
      groupId,
      displayName: "Invitado",
      normalizedDisplayName: "invitado",
      createdByPlayerId: owner,
    });

    async function finishedMatch(input: {
      venueId: string | null;
      courtId?: string;
      scheduledAt: Date;
      playerIds: string[];
      noShowIds?: string[];
      status?: "FINISHED" | "CANCELLED";
      result?: "CONFIRMED" | "NOT_PLAYED";
      withGuest?: boolean;
    }) {
      const matchId = randomUUID();
      await connection.db.insert(matches).values({
        id: matchId,
        groupId,
        discipline: "F5",
        status: input.status ?? "FINISHED",
        scheduledAt: input.scheduledAt,
        durationMinutes: 60,
        capacity: 12,
        locationText: input.venueId ? "Structured" : "Manual location",
        venueId: input.venueId,
        courtId: input.courtId,
        createdByPlayerId: owner,
        rosterConfirmedAt: input.scheduledAt,
        rosterConfirmedByPlayerId: owner,
      });
      let order = 1n;
      for (const playerId of input.playerIds) {
        const noShow = input.noShowIds?.includes(playerId) ?? false;
        await connection.db.insert(matchParticipants).values({
          id: randomUUID(),
          matchId,
          kind: "PLAYER",
          playerId,
          status: "CONFIRMED",
          admissionOrder: order++,
          confirmedAt: input.scheduledAt,
          attendance: noShow ? "NO_SHOW" : "PLAYED",
          attendanceConfirmedAt: input.scheduledAt,
          attendanceConfirmedByPlayerId: owner,
        });
      }
      if (input.withGuest) {
        await connection.db.insert(matchParticipants).values({
          id: randomUUID(),
          matchId,
          kind: "GUEST",
          groupGuestId: guestId,
          guestDisplayName: "Invitado",
          guestCreatedByPlayerId: owner,
          status: "CONFIRMED",
          admissionOrder: order,
          confirmedAt: input.scheduledAt,
          attendance: "PLAYED",
          attendanceConfirmedAt: input.scheduledAt,
          attendanceConfirmedByPlayerId: owner,
        });
      }
      await connection.db.insert(matchSportingResults).values({
        id: randomUUID(),
        matchId,
        status: input.result ?? "CONFIRMED",
        teamAGoals: input.result === "NOT_PLAYED" ? null : 0,
        teamBGoals: input.result === "NOT_PLAYED" ? null : 0,
        updatedByPlayerId: owner,
        confirmedAt: input.scheduledAt,
        confirmedByPlayerId: owner,
      });
      return matchId;
    }

    const firstDate = new Date("2026-01-01T20:00:00.000Z");
    const lastVenueDate = new Date("2026-02-01T20:00:00.000Z");
    await finishedMatch({
      venueId: venueOne,
      courtId: courtOne,
      scheduledAt: firstDate,
      playerIds: [actor, leader, tieMore, tieLess, zero],
      noShowIds: [zero],
      withGuest: true,
    });
    await finishedMatch({
      venueId: venueOne,
      courtId: courtTwo,
      scheduledAt: lastVenueDate,
      playerIds: [actor],
    });
    await finishedMatch({
      venueId: venueTwo,
      scheduledAt: new Date("2026-03-01T20:00:00.000Z"),
      playerIds: [actor],
    });
    await finishedMatch({
      venueId: venueOtherCity,
      scheduledAt: new Date("2026-04-01T20:00:00.000Z"),
      playerIds: [actor],
    });
    const countryOnlyDate = new Date("2026-04-02T20:00:00.000Z");
    await finishedMatch({
      venueId: venueCountryOnly,
      scheduledAt: countryOnlyDate,
      playerIds: [actor],
    });
    await finishedMatch({
      venueId: venueBrazil,
      scheduledAt: new Date("2026-04-03T20:00:00.000Z"),
      playerIds: [actor],
    });
    await finishedMatch({
      venueId: legacyVenue,
      scheduledAt: new Date("2026-04-04T20:00:00.000Z"),
      playerIds: [actor],
    });
    await finishedMatch({
      venueId: ambiguousArgentinaVenue,
      scheduledAt: new Date("2026-04-05T20:00:00.000Z"),
      playerIds: [actor],
    });
    await finishedMatch({
      venueId: ambiguousBrazilVenue,
      scheduledAt: new Date("2026-04-06T20:00:00.000Z"),
      playerIds: [actor],
    });
    await finishedMatch({
      venueId: venueOne,
      scheduledAt: new Date("2026-05-01T20:00:00.000Z"),
      playerIds: [actor],
      status: "CANCELLED",
    });
    await finishedMatch({
      venueId: venueOne,
      scheduledAt: new Date("2026-06-01T20:00:00.000Z"),
      playerIds: [actor],
      result: "NOT_PLAYED",
    });
    await finishedMatch({
      venueId: null,
      scheduledAt: new Date("2026-07-01T20:00:00.000Z"),
      playerIds: [actor],
    });

    const venuePage = await service.list(
      actor,
      { type: "VENUE", venueId: venueOne },
      { limit: 2 },
    );
    assert.deepEqual(
      venuePage.items.map((item) => [item.position, item.player.id]),
      [
        [1, leader],
        [2, tieMore],
      ],
    );
    assert.ok(venuePage.nextCursor);
    const venueNext = await service.list(
      actor,
      { type: "VENUE", venueId: venueOne },
      { limit: 2, cursor: venuePage.nextCursor },
    );
    assert.deepEqual(
      venueNext.items.map((item) => [item.position, item.player.id]),
      [
        [3, tieLess],
        [4, actor],
      ],
    );
    assert.equal(
      new Set(
        [...venuePage.items, ...venueNext.items].map((item) => item.player.id),
      ).size,
      4,
    );
    assert.deepEqual(venueNext.me, {
      ranked: true,
      position: 4,
      overall: "75.000000000000",
      processedMatchCount: 4,
      scopeStats: {
        matchesPlayed: 2,
        lastPlayedAt: lastVenueDate.toISOString(),
      },
    });
    assert.equal(venuePage.scope.type, "VENUE");
    if (venuePage.scope.type === "VENUE")
      assert.deepEqual(
        {
          cityKey: venuePage.scope.cityKey,
          provinceCode: venuePage.scope.province?.code,
          countryCode: venuePage.scope.country?.code,
        },
        {
          cityKey: encodeCityRankingKey(normalizedRosario),
          provinceCode: provinceOne,
          countryCode: countryOne,
        },
      );
    await assert.rejects(
      service.list(
        actor,
        { type: "VENUE", venueId: venueOne },
        { limit: 20, cursor: "invalid" },
      ),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "invalid_cursor",
    );

    const city = await service.list(
      actor,
      { type: "CITY", cityKey: encodeCityRankingKey(normalizedRosario) },
      { limit: 20 },
    );
    assert.equal(
      city.items.find((item) => item.player.id === actor)?.scopeStats
        .matchesPlayed,
      3,
    );
    assert.equal(
      city.items.filter((item) => item.player.id === actor).length,
      1,
    );
    if (city.scope.type === "CITY") {
      assert.equal(city.scope.province?.code, provinceOne);
      assert.equal(city.scope.country?.code, countryOne);
      assert.equal(city.scope.key, encodeCityRankingKey(normalizedRosario));
    }
    const cordoba = await service.list(
      actor,
      { type: "CITY", cityKey: encodeCityRankingKey(normalizedCordoba) },
      { limit: 20 },
    );
    assert.deepEqual(
      cordoba.items.map((item) => item.player.id),
      [actor],
    );
    assert.equal(cordoba.items[0]?.scopeStats.matchesPlayed, 1);
    assert.equal(
      city.items.some((item) => item.player.id === zero),
      false,
    );
    assert.deepEqual(Object.keys(city.items[0]!.player).sort(), [
      "displayName",
      "id",
    ]);

    const santaFeKey = encodeProvinceRankingKey(provinceOne);
    const santaFePage = await service.list(
      actor,
      { type: "PROVINCE", provinceKey: santaFeKey },
      { limit: 2 },
    );
    assert.ok(santaFePage.nextCursor);
    const santaFeNext = await service.list(
      actor,
      { type: "PROVINCE", provinceKey: santaFeKey },
      { limit: 2, cursor: santaFePage.nextCursor },
    );
    assert.equal(
      new Set(
        [...santaFePage.items, ...santaFeNext.items].map(
          (item) => item.player.id,
        ),
      ).size,
      4,
    );
    assert.deepEqual(santaFeNext.me, {
      ranked: true,
      position: 4,
      overall: "75.000000000000",
      processedMatchCount: 4,
      scopeStats: {
        matchesPlayed: 4,
        lastPlayedAt: new Date("2026-04-05T20:00:00.000Z").toISOString(),
      },
    });
    assert.equal(santaFePage.scope.type, "PROVINCE");
    if (santaFePage.scope.type === "PROVINCE") {
      assert.equal(santaFePage.scope.name, provinceOne);
      assert.equal(santaFePage.scope.country.code, countryOne);
    }
    const cordobaProvince = await service.list(
      actor,
      { type: "PROVINCE", provinceKey: encodeProvinceRankingKey(provinceTwo) },
      { limit: 20 },
    );
    assert.deepEqual(
      cordobaProvince.items.map((item) => item.player.id),
      [actor],
    );
    assert.equal(cordobaProvince.items[0]?.scopeStats.matchesPlayed, 1);

    const argentina = await service.list(
      actor,
      { type: "COUNTRY", countryKey: encodeCountryRankingKey(countryOne) },
      { limit: 20 },
    );
    assert.equal(argentina.scope.type, "COUNTRY");
    assert.equal(
      argentina.items.find((item) => item.player.id === actor)?.scopeStats
        .matchesPlayed,
      6,
    );
    assert.equal(
      argentina.items.find((item) => item.player.id === actor)?.scopeStats
        .lastPlayedAt,
      new Date("2026-04-05T20:00:00.000Z").toISOString(),
    );
    assert.equal(
      argentina.items.filter((item) => item.player.id === actor).length,
      1,
    );
    assert.equal(
      argentina.items.some((item) => item.player.id === zero),
      false,
    );

    const brazil = await service.list(
      actor,
      {
        type: "COUNTRY",
        countryKey: encodeCountryRankingKey(effectiveCountryTwo),
      },
      { limit: 20 },
    );
    assert.deepEqual(
      brazil.items.map((item) => item.player.id),
      [actor],
    );
    assert.equal(brazil.items[0]?.scopeStats.matchesPlayed, 2);

    const ambiguous = await service.list(
      actor,
      {
        type: "CITY",
        cityKey: encodeCityRankingKey(normalizedAmbiguousCity),
      },
      { limit: 20 },
    );
    if (ambiguous.scope.type === "CITY") {
      assert.equal(ambiguous.scope.province, null);
      assert.equal(ambiguous.scope.country, null);
    }

    const legacyVenueRanking = await service.list(
      actor,
      { type: "VENUE", venueId: legacyVenue },
      { limit: 20 },
    );
    assert.deepEqual(
      legacyVenueRanking.items.map((item) => item.player.id),
      [actor],
    );
    if (legacyVenueRanking.scope.type === "VENUE") {
      assert.equal(legacyVenueRanking.scope.province, null);
      assert.equal(legacyVenueRanking.scope.country, null);
    }
    await assert.rejects(
      service.list(
        actor,
        { type: "PROVINCE", provinceKey: santaFeKey },
        { limit: 20, cursor: "invalid" },
      ),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "invalid_cursor",
    );
  },
);
