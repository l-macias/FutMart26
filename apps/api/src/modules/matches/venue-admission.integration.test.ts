import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "@football/database";
import {
  authUser,
  groupGuests,
  groupMemberships,
  matchParticipants,
  matchScheduleChanges,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { GroupService } from "../groups/group-service.js";
import { PlayerService } from "../identity/player-service.js";
import { VenueService } from "../venues/venue-service.js";
import { MatchService } from "./match-service.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const safeUrl =
  databaseUrl &&
  new URL(databaseUrl).pathname.replace(/^\//, "").endsWith("_test")
    ? databaseUrl
    : undefined;

void test(
  "Venue, recurring Match defaults and administrative admission integrate against PostgreSQL",
  { skip: !safeUrl },
  async () => {
    const connection = createDatabase(safeUrl!);
    await migrate(connection.db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "../../packages/database/drizzle",
      ),
    });
    const players = new PlayerService(connection.db);
    const groups = new GroupService(connection.db);
    const venues = new VenueService(connection.db);
    const matches = new MatchService(connection.db);

    async function player(name: string) {
      const authUserId = randomUUID();
      await connection.db.insert(authUser).values({
        id: authUserId,
        email: `${authUserId}@venue-match.test`,
        name,
      });
      return players.provision(authUserId, name);
    }
    async function member(groupId: string, playerId: string) {
      await connection.db.insert(groupMemberships).values({
        id: randomUUID(),
        groupId,
        playerId,
        role: "MEMBER",
      });
    }
    const owner = await player("Venue owner");
    const group = await groups.create(owner.id, `Venue group ${randomUUID()}`);
    const venueName = `La Filial ${randomUUID()}`;

    const venue = await venues.create(owner.id, group.id, {
      displayName: `  ${venueName}  `,
      city: "Rosario",
      address: "Córdoba 123",
    });
    assert.equal(venue.displayName, venueName);
    await assert.rejects(
      venues.create(owner.id, group.id, {
        displayName: venueName.toLocaleUpperCase("es"),
        city: " rosario ",
      }),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "venue_candidate_conflict",
    );
    const homonym = await venues.create(owner.id, group.id, {
      displayName: venueName,
      city: "Córdoba",
    });
    assert.notEqual(homonym.id, venue.id);
    const court = await venues.createCourt(
      owner.id,
      group.id,
      venue.id,
      "Cancha 1",
    );
    await assert.rejects(
      venues.createCourt(owner.id, group.id, venue.id, " cancha  1 "),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "court_candidate_conflict",
    );

    const draft = await matches.create(owner.id, group.id, {
      discipline: "F5",
      scheduledAt: new Date("2027-10-06T23:00:00.000Z"),
      durationMinutes: 60,
      capacity: 12,
      locationText: "ignored structured snapshot",
      venueId: venue.id,
      courtId: court.id,
      saveAsDefaults: true,
      defaultStartTime: "20:00",
    });
    assert.equal(draft.capacity, 12);
    assert.equal(draft.locationText, `${venueName} · Cancha 1 · Rosario`);
    const defaults = await matches.defaults(owner.id, group.id);
    assert.equal(defaults.defaultVenue?.id, venue.id);
    assert.equal(defaults.defaultCourt?.id, court.id);
    assert.equal(defaults.defaultCapacity, 12);

    await matches.create(owner.id, group.id, {
      discipline: "F5",
      scheduledAt: new Date("2027-10-13T23:00:00.000Z"),
      durationMinutes: 75,
      capacity: 11,
      locationText: "Cancha excepcional",
    });
    assert.equal(
      (await matches.defaults(owner.id, group.id)).defaultCapacity,
      12,
    );

    await matches.publish(owner.id, draft.id);
    const admitted = [];
    for (let index = 1; index <= 13; index += 1) {
      const current = await player(`Admission ${index}`);
      await member(group.id, current.id);
      admitted.push({
        player: current,
        participation: await matches.join(current.id, draft.id),
      });
    }
    assert.equal(
      admitted.filter(
        ({ participation }) => participation.status === "CONFIRMED",
      ).length,
      12,
    );
    assert.equal(admitted[12]!.participation.status, "WAITLISTED");

    await matches.cancelParticipant(
      owner.id,
      draft.id,
      admitted[0]!.participation.id,
    );
    const promoted = await matches.roster(admitted[12]!.player.id, draft.id);
    assert.equal(promoted.currentParticipation?.status, "CONFIRMED");
    assert.ok(promoted.currentParticipation?.promotedAt);
    const [cancelled] = await connection.db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.id, admitted[0]!.participation.id))
      .limit(1);
    assert.equal(cancelled?.cancelledByPlayerId, owner.id);

    const replacement = await player("Queue replacement");
    await member(group.id, replacement.id);
    const waitlisted = await matches.join(replacement.id, draft.id);
    assert.equal(waitlisted.status, "WAITLISTED");
    const demotedId = admitted[1]!.participation.id;
    await matches.swapWaitlist(owner.id, draft.id, waitlisted.id, demotedId);
    const swapped = await connection.db
      .select({ id: matchParticipants.id, status: matchParticipants.status })
      .from(matchParticipants)
      .where(inArray(matchParticipants.id, [waitlisted.id, demotedId]));
    assert.equal(
      swapped.find((row) => row.id === waitlisted.id)?.status,
      "CONFIRMED",
    );
    assert.equal(
      swapped.find((row) => row.id === demotedId)?.status,
      "WAITLISTED",
    );
    assert.equal((await matches.roster(owner.id, draft.id)).confirmedCount, 12);

    const guestId = randomUUID();
    await connection.db.insert(groupGuests).values({
      id: guestId,
      groupId: group.id,
      displayName: "Guest capacity",
      normalizedDisplayName: "guest capacity",
      createdByPlayerId: owner.id,
    });
    const guest = await matches.addGuest(owner.id, draft.id, guestId);
    assert.equal(guest.status, "WAITLISTED");
    await assert.rejects(
      matches.addGuest(owner.id, draft.id, guestId),
      (error: unknown) =>
        error instanceof ApplicationError && error.code === "already_joined",
    );

    await matches.update(owner.id, draft.id, {
      scheduledAt: new Date("2027-10-07T00:00:00.000Z"),
    });
    const [audit] = await connection.db
      .select()
      .from(matchScheduleChanges)
      .where(eq(matchScheduleChanges.matchId, draft.id));
    assert.equal(audit?.changedByPlayerId, owner.id);
    assert.equal(
      (await matches.get(owner.id, draft.id)).scheduleChange
        ?.previousScheduledAt,
      "2027-10-06T23:00:00.000Z",
    );

    const raceMatch = await matches.create(owner.id, group.id, {
      discipline: "F5",
      scheduledAt: new Date("2027-12-01T20:00:00.000Z"),
      durationMinutes: 60,
      capacity: 1,
      locationText: "Race court",
    });
    await matches.publish(owner.id, raceMatch.id);
    const raceConfirmed = await player("Race confirmed");
    const raceWaiting = await player("Race waiting");
    await member(group.id, raceConfirmed.id);
    await member(group.id, raceWaiting.id);
    const raceParticipation = await matches.join(
      raceConfirmed.id,
      raceMatch.id,
    );
    await matches.join(raceWaiting.id, raceMatch.id);
    const cancellationRace = await Promise.allSettled([
      matches.cancelParticipant(owner.id, raceMatch.id, raceParticipation.id),
      matches.leave(raceConfirmed.id, raceMatch.id),
    ]);
    assert.equal(
      cancellationRace.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const raceRoster = await matches.roster(owner.id, raceMatch.id);
    assert.equal(raceRoster.confirmedCount, 1);
    assert.equal(raceRoster.waitlistCount, 0);
    assert.equal(raceRoster.confirmed[0]?.playerId, raceWaiting.id);

    const catalog = await connection.client.unsafe<{ indexname: string }[]>(
      "select indexname from pg_indexes where schemaname = 'public' and indexname in ('venues_active_name_city_uq','venue_courts_active_name_uq','match_participants_active_group_guest_uq') order by indexname",
    );
    assert.deepEqual(
      catalog.map((row) => row.indexname),
      [
        "match_participants_active_group_guest_uq",
        "venue_courts_active_name_uq",
        "venues_active_name_city_uq",
      ],
    );
    const crossVenueCourt = await venues.createCourt(
      owner.id,
      group.id,
      homonym.id,
      "Cancha X",
    );
    await assert.rejects(
      matches.create(owner.id, group.id, {
        discipline: "F5",
        scheduledAt: new Date("2027-11-01T20:00:00.000Z"),
        durationMinutes: 60,
        capacity: 10,
        locationText: "invalid",
        venueId: venue.id,
        courtId: crossVenueCourt.id,
      }),
      (error: unknown) =>
        error instanceof ApplicationError &&
        error.code === "court_not_at_venue",
    );

    await connection.client.end();
  },
);
