import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, inArray, lt, gte, or, sql } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  groupMemberships,
  groupMatchDefaults,
  groupGuests,
  groups,
  matchParticipants,
  matchPlayerInvitations,
  matchScheduleChanges,
  matchSportingResults,
  matchTeamAssignments,
  matches,
  players,
  venueCourts,
  venues,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { encodeCityRankingKey } from "../venues/venue-city-key.js";
import { presentVenueGeography } from "../venues/venue-geography-key.js";
import {
  type GroupCapability,
  hasGroupCapability,
} from "../groups/capabilities.js";
import { MatchRecruitmentService } from "./match-recruitment-service.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | Transaction;
type MatchRow = typeof matches.$inferSelect;
type MatchInput = {
  discipline: "F5";
  scheduledAt: Date;
  durationMinutes: number;
  capacity: number;
  locationText: string;
  venueId?: string | null;
  courtId?: string | null;
  saveAsDefaults?: boolean;
  defaultStartTime?: string;
};
type MatchUpdate = Partial<
  Omit<MatchInput, "discipline" | "saveAsDefaults" | "defaultStartTime">
>;

export class MatchService {
  constructor(
    private readonly database: Database,
    private readonly recruitment = new MatchRecruitmentService(database),
  ) {}

  async create(actorPlayerId: string, groupId: string, input: MatchInput) {
    this.validateCapacity(input.capacity);
    const permissions = await this.matchPermissions(actorPlayerId, groupId);
    return this.database.transaction(async (tx) => {
      await this.requireGroupCapability(
        tx,
        actorPlayerId,
        groupId,
        "MATCH_MANAGE",
        true,
      );
      const location = await this.resolveLocation(tx, input);
      const [match] = await tx
        .insert(matches)
        .values({
          id: randomUUID(),
          groupId,
          createdByPlayerId: actorPlayerId,
          discipline: input.discipline,
          scheduledAt: input.scheduledAt,
          durationMinutes: input.durationMinutes,
          capacity: input.capacity,
          ...location,
        })
        .returning();
      if (input.saveAsDefaults) {
        await tx
          .insert(groupMatchDefaults)
          .values({
            groupId,
            discipline: input.discipline,
            defaultVenueId: location.venueId,
            defaultCourtId: location.courtId,
            defaultLocationText: location.venueId
              ? null
              : location.locationText,
            defaultStartTime: input.defaultStartTime ?? null,
            defaultDurationMinutes: input.durationMinutes,
            defaultCapacity: input.capacity,
            updatedByPlayerId: actorPlayerId,
          })
          .onConflictDoUpdate({
            target: groupMatchDefaults.groupId,
            set: {
              defaultVenueId: location.venueId,
              defaultCourtId: location.courtId,
              defaultLocationText: location.venueId
                ? null
                : location.locationText,
              defaultStartTime: input.defaultStartTime ?? null,
              defaultDurationMinutes: input.durationMinutes,
              defaultCapacity: input.capacity,
              updatedByPlayerId: actorPlayerId,
              updatedAt: new Date(),
            },
          });
      }
      return this.summary(match!, permissions);
    });
  }

  async defaults(actorPlayerId: string, groupId: string) {
    await this.requireGroupCapability(
      this.database,
      actorPlayerId,
      groupId,
      "GROUP_READ",
      false,
    );
    const [result] = await this.database
      .select({
        defaults: groupMatchDefaults,
        venue: venues,
        court: venueCourts,
      })
      .from(groupMatchDefaults)
      .leftJoin(venues, eq(venues.id, groupMatchDefaults.defaultVenueId))
      .leftJoin(
        venueCourts,
        eq(venueCourts.id, groupMatchDefaults.defaultCourtId),
      )
      .where(eq(groupMatchDefaults.groupId, groupId))
      .limit(1);
    const row = result?.defaults;
    return {
      discipline: "F5" as const,
      defaultVenueId: row?.defaultVenueId ?? null,
      defaultCourtId: row?.defaultCourtId ?? null,
      defaultLocationText: row?.defaultLocationText ?? null,
      defaultStartTime: row?.defaultStartTime ?? "20:00",
      defaultDurationMinutes: row?.defaultDurationMinutes ?? 60,
      defaultCapacity: row?.defaultCapacity ?? 10,
      defaultVenue: result?.venue
        ? {
            id: result.venue.id,
            displayName: result.venue.displayName,
            city: result.venue.city,
            cityKey: encodeCityRankingKey(result.venue.normalizedCity),
            ...presentVenueGeography(
              result.venue.countryCode,
              result.venue.provinceCode,
            ),
            address: result.venue.address,
            status: result.venue.status,
          }
        : null,
      defaultCourt: result?.court
        ? {
            id: result.court.id,
            venueId: result.court.venueId,
            displayName: result.court.displayName,
            status: result.court.status,
          }
        : null,
    };
  }

  async list(actorPlayerId: string, groupId: string) {
    await this.requireGroupCapability(
      this.database,
      actorPlayerId,
      groupId,
      "GROUP_READ",
      false,
    );
    const permissions = await this.matchPermissions(actorPlayerId, groupId);
    const rows = await this.database
      .select({
        match: matches,
        confirmedCount: sql<number>`count(${matchParticipants.id}) filter (where ${matchParticipants.status} = 'CONFIRMED')::int`,
        waitlistCount: sql<number>`count(${matchParticipants.id}) filter (where ${matchParticipants.status} = 'WAITLISTED')::int`,
      })
      .from(matches)
      .leftJoin(matchParticipants, eq(matchParticipants.matchId, matches.id))
      .where(eq(matches.groupId, groupId))
      .groupBy(matches.id)
      .orderBy(asc(matches.scheduledAt), asc(matches.id))
      .limit(100);
    const recruitment = await this.recruitment.modelsForMatches(
      rows.map((row) => ({
        match: row.match,
        confirmedCount: row.confirmedCount,
      })),
    );
    return rows.map(({ match, confirmedCount, waitlistCount }) => ({
      ...this.baseSummary(match),
      confirmedCount,
      waitlistCount,
      availableSpots: Math.max(0, match.capacity - confirmedCount),
      recruitment: recruitment.get(match.id)!,
      ...permissions,
      scheduleChange: null,
    }));
  }

  async listForPlayer(
    actorPlayerId: string,
    limits: { upcomingLimit: number; recentLimit: number },
  ) {
    const now = new Date();
    const select = {
      match: matches,
      groupId: groups.id,
      groupName: groups.name,
      venue: venues,
      court: venueCourts,
      confirmedCount: sql<number>`(
        select count(*)::int from ${matchParticipants} participant_count
        where participant_count.match_id = ${matches.id}
          and participant_count.status = 'CONFIRMED'
      )`,
      waitlistCount: sql<number>`(
        select count(*)::int from ${matchParticipants} participant_count
        where participant_count.match_id = ${matches.id}
          and participant_count.status = 'WAITLISTED'
      )`,
      participationStatus: sql<"CONFIRMED" | "WAITLISTED" | null>`(
        select participant_self.status from ${matchParticipants} participant_self
        where participant_self.match_id = ${matches.id}
          and participant_self.player_id = ${actorPlayerId}
          and participant_self.status in ('CONFIRMED', 'WAITLISTED')
        order by participant_self.joined_at desc
        limit 1
      )`,
      waitlistPosition: sql<number | null>`(
        select case when participant_self.status = 'WAITLISTED' then (
          select count(*)::int from ${matchParticipants} participant_before
          where participant_before.match_id = participant_self.match_id
            and participant_before.status = 'WAITLISTED'
            and participant_before.admission_order <= participant_self.admission_order
        ) else null end
        from ${matchParticipants} participant_self
        where participant_self.match_id = ${matches.id}
          and participant_self.player_id = ${actorPlayerId}
          and participant_self.status in ('CONFIRMED', 'WAITLISTED')
        order by participant_self.joined_at desc
        limit 1
      )`,
    };
    const base = () =>
      this.database
        .select(select)
        .from(matches)
        .innerJoin(groups, eq(groups.id, matches.groupId))
        .innerJoin(
          groupMemberships,
          and(
            eq(groupMemberships.groupId, matches.groupId),
            eq(groupMemberships.playerId, actorPlayerId),
            eq(groupMemberships.status, "ACTIVE"),
          ),
        )
        .leftJoin(venues, eq(venues.id, matches.venueId))
        .leftJoin(
          venueCourts,
          and(
            eq(venueCourts.id, matches.courtId),
            eq(venueCourts.venueId, matches.venueId),
          ),
        );
    const [upcoming, recent] = await Promise.all([
      base()
        .where(
          and(
            inArray(matches.status, ["DRAFT", "OPEN"]),
            gte(matches.scheduledAt, now),
          ),
        )
        .orderBy(asc(matches.scheduledAt), asc(matches.id))
        .limit(limits.upcomingLimit),
      base()
        .where(
          or(
            inArray(matches.status, ["STARTED", "FINISHED"]),
            and(
              lt(matches.scheduledAt, now),
              inArray(matches.status, ["DRAFT", "OPEN"]),
            ),
          ),
        )
        .orderBy(desc(matches.scheduledAt), asc(matches.id))
        .limit(limits.recentLimit),
    ]);
    return {
      upcoming: upcoming.map((row) => this.personalSummary(row)),
      recent: recent.map((row) => this.personalSummary(row)),
    };
  }

  async get(actorPlayerId: string, matchId: string) {
    const match = await this.requireReadableMatch(actorPlayerId, matchId);
    const [change] = await this.database
      .select({
        previousScheduledAt: matchScheduleChanges.previousScheduledAt,
        changedAt: matchScheduleChanges.changedAt,
      })
      .from(matchScheduleChanges)
      .where(eq(matchScheduleChanges.matchId, matchId))
      .orderBy(
        sql`${matchScheduleChanges.changedAt} desc`,
        sql`${matchScheduleChanges.id} desc`,
      )
      .limit(1);
    return this.summary(
      match,
      await this.matchPermissions(actorPlayerId, match.groupId),
      change
        ? {
            previousScheduledAt: change.previousScheduledAt.toISOString(),
            changedAt: change.changedAt.toISOString(),
          }
        : null,
    );
  }

  async cancelParticipant(
    actorPlayerId: string,
    matchId: string,
    participantId: string,
  ) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      this.requireOpen(match);
      await this.requireGroupCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "MATCH_MANAGE",
        true,
      );
      const [participant] = await tx
        .select()
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.id, participantId),
            eq(matchParticipants.matchId, matchId),
            inArray(matchParticipants.status, ["CONFIRMED", "WAITLISTED"]),
          ),
        )
        .limit(1);
      if (!participant)
        throw new ApplicationError(
          "not_participating",
          "Participant is not active",
          404,
        );
      await this.cancelParticipation(tx, participant.id, actorPlayerId);
      if (participant.status === "CONFIRMED")
        await this.promoteAvailable(tx, matchId, match.capacity);
    });
  }

  async swapWaitlist(
    actorPlayerId: string,
    matchId: string,
    promoteParticipantId: string,
    demoteParticipantId: string,
  ) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      this.requireOpen(match);
      await this.requireGroupCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "MATCH_MANAGE",
        true,
      );
      const rows = await tx
        .select()
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.matchId, matchId),
            inArray(matchParticipants.id, [
              promoteParticipantId,
              demoteParticipantId,
            ]),
            inArray(matchParticipants.status, ["CONFIRMED", "WAITLISTED"]),
          ),
        );
      const promote = rows.find((row) => row.id === promoteParticipantId);
      const demote = rows.find((row) => row.id === demoteParticipantId);
      if (promote?.status !== "WAITLISTED" || demote?.status !== "CONFIRMED")
        throw new ApplicationError(
          "invalid_queue_override",
          "Expected one waitlisted and one confirmed participant",
          409,
        );
      const now = new Date();
      await tx
        .update(matchParticipants)
        .set({
          status: "CONFIRMED",
          confirmedAt: now,
          promotedAt: now,
          updatedAt: now,
        })
        .where(eq(matchParticipants.id, promote.id));
      await tx
        .update(matchParticipants)
        .set({
          status: "WAITLISTED",
          admissionOrder: match.nextAdmissionOrder,
          confirmedAt: null,
          promotedAt: null,
          updatedAt: now,
        })
        .where(eq(matchParticipants.id, demote.id));
      await tx
        .update(matches)
        .set({
          nextAdmissionOrder: match.nextAdmissionOrder + 1n,
          updatedAt: now,
        })
        .where(eq(matches.id, matchId));
    });
  }

  async publish(actorPlayerId: string, matchId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireGroupCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "MATCH_MANAGE",
        true,
      );
      if (match.status !== "DRAFT") this.invalidTransition();
      const blockers = await tx.execute(sql`
        select older.id
        from ${matches} older
        where older.group_id = ${match.groupId}
          and older.status = 'FINISHED'
          and older.roster_confirmed_at is not null
          and (older.scheduled_at, older.id) < (${match.scheduledAt.toISOString()}::timestamptz, ${match.id}::uuid)
          and exists (
            select 1 from ${matchParticipants} participant
            where participant.match_id = older.id
              and participant.status = 'CONFIRMED'
              and participant.attendance = 'PLAYED'
          )
          and not exists (
            select 1 from ${matchSportingResults} result
            where result.match_id = older.id
              and result.status in ('CONFIRMED', 'NOT_PLAYED')
          )
        order by older.scheduled_at, older.id
        limit 1
      `);
      if (blockers.length > 0)
        throw new ApplicationError(
          "prior_match_sporting_closure_required",
          "An older played Match requires sporting closure before publication",
          409,
        );
      const now = new Date();
      await tx
        .update(matches)
        .set({ status: "OPEN", publishedAt: now, updatedAt: now })
        .where(eq(matches.id, matchId));
    });
  }

  async update(actorPlayerId: string, matchId: string, input: MatchUpdate) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireGroupCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "MATCH_MANAGE",
        true,
      );
      if (match.status !== "DRAFT" && match.status !== "OPEN")
        this.invalidTransition();
      if (input.capacity !== undefined) {
        this.validateCapacity(input.capacity);
        const confirmedCount = await this.confirmedCount(tx, matchId);
        if (input.capacity < confirmedCount)
          throw new ApplicationError(
            "capacity_below_confirmed",
            "Capacity cannot be lower than confirmed participants",
            409,
          );
      }
      const location =
        input.venueId !== undefined ||
        input.courtId !== undefined ||
        input.locationText !== undefined
          ? await this.resolveLocation(tx, {
              ...match,
              ...input,
              venueId:
                input.venueId === undefined ? match.venueId : input.venueId,
              courtId:
                input.courtId === undefined ? match.courtId : input.courtId,
              locationText: input.locationText ?? match.locationText,
            })
          : {};
      if (
        input.scheduledAt !== undefined &&
        input.scheduledAt.getTime() !== match.scheduledAt.getTime()
      ) {
        await tx.insert(matchScheduleChanges).values({
          id: randomUUID(),
          matchId,
          previousScheduledAt: match.scheduledAt,
          nextScheduledAt: input.scheduledAt,
          changedByPlayerId: actorPlayerId,
        });
      }
      await tx
        .update(matches)
        .set({ ...input, ...location, updatedAt: new Date() })
        .where(eq(matches.id, matchId));
      if (
        match.status === "OPEN" &&
        input.capacity !== undefined &&
        input.capacity > match.capacity
      ) {
        await this.promoteAvailable(tx, matchId, input.capacity);
      }
    });
  }

  async cancel(actorPlayerId: string, matchId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireGroupCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "MATCH_MANAGE",
        true,
      );
      if (match.status !== "DRAFT" && match.status !== "OPEN")
        this.invalidTransition();
      await tx
        .update(matches)
        .set({
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledByPlayerId: actorPlayerId,
          updatedAt: new Date(),
        })
        .where(eq(matches.id, matchId));
    });
  }

  async start(actorPlayerId: string, matchId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireGroupCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "MATCH_MANAGE",
        true,
      );
      if (match.status === "STARTED") return;
      if (match.status !== "OPEN") this.invalidTransition();
      const [counts] = await tx
        .select({
          confirmed: sql<number>`count(distinct ${matchParticipants.id})::int`,
          assigned: sql<number>`count(distinct ${matchTeamAssignments.participantId})::int`,
        })
        .from(matchParticipants)
        .leftJoin(
          matchTeamAssignments,
          eq(matchTeamAssignments.participantId, matchParticipants.id),
        )
        .where(
          and(
            eq(matchParticipants.matchId, matchId),
            eq(matchParticipants.status, "CONFIRMED"),
          ),
        );
      if (counts!.confirmed !== counts!.assigned)
        throw new ApplicationError(
          "incomplete_team_assignments",
          "Every confirmed participant must have one team assignment before START",
          409,
        );
      const now = new Date();
      await tx
        .update(matches)
        .set({ status: "STARTED", rosterLockedAt: now, updatedAt: now })
        .where(eq(matches.id, matchId));
    });
  }

  async join(actorPlayerId: string, matchId: string) {
    return this.database.transaction((tx) =>
      this.joinInTransaction(tx, actorPlayerId, matchId),
    );
  }

  async acceptInvitation(actorPlayerId: string, invitationId: string) {
    return this.database.transaction(async (tx) => {
      await tx.execute(
        sql`select id from ${matchPlayerInvitations} where id = ${invitationId} for update`,
      );
      const [invitation] = await tx
        .select()
        .from(matchPlayerInvitations)
        .where(
          and(
            eq(matchPlayerInvitations.id, invitationId),
            eq(matchPlayerInvitations.invitedPlayerId, actorPlayerId),
          ),
        )
        .limit(1);
      if (!invitation)
        throw new ApplicationError(
          "invitation_not_available",
          "Invitation not available",
          404,
        );
      if (invitation.status === "ACCEPTED") {
        const [participant] = await tx
          .select()
          .from(matchParticipants)
          .where(
            and(
              eq(matchParticipants.matchId, invitation.matchId),
              eq(matchParticipants.playerId, actorPlayerId),
              inArray(matchParticipants.status, ["CONFIRMED", "WAITLISTED"]),
            ),
          )
          .limit(1);
        if (!participant)
          throw new ApplicationError(
            "concurrency_conflict",
            "Accepted invitation has no participation",
            409,
          );
        return this.presentInvitationAdmission(invitation.matchId, participant);
      }
      if (invitation.status !== "PENDING")
        throw new ApplicationError(
          "invitation_not_available",
          "Invitation not available",
          409,
        );
      const participant = await this.joinInTransaction(
        tx,
        actorPlayerId,
        invitation.matchId,
      );
      await tx
        .update(matchPlayerInvitations)
        .set({
          status: "ACCEPTED",
          respondedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(matchPlayerInvitations.id, invitation.id),
            eq(matchPlayerInvitations.status, "PENDING"),
          ),
        );
      return this.presentInvitationAdmission(invitation.matchId, participant);
    });
  }

  private async joinInTransaction(
    tx: Transaction,
    actorPlayerId: string,
    matchId: string,
  ) {
    const match = await this.lockMatch(tx, matchId);
    await this.requireGroupCapability(
      tx,
      actorPlayerId,
      match.groupId,
      "GROUP_READ",
      true,
    );
    this.requireOpen(match);
    const [existing] = await tx
      .select()
      .from(matchParticipants)
      .where(
        and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.kind, "PLAYER"),
          eq(matchParticipants.playerId, actorPlayerId),
          inArray(matchParticipants.status, ["CONFIRMED", "WAITLISTED"]),
        ),
      )
      .limit(1);
    if (existing) return existing;
    return this.admit(tx, match, {
      kind: "PLAYER",
      playerId: actorPlayerId,
    });
  }

  private presentInvitationAdmission(
    matchId: string,
    participant: typeof matchParticipants.$inferSelect,
  ) {
    return {
      outcome: participant.status as "CONFIRMED" | "WAITLISTED",
      matchId,
      participantId: participant.id,
      admissionOrder: participant.admissionOrder.toString(),
    };
  }

  async leave(actorPlayerId: string, matchId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireGroupCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "GROUP_READ",
        true,
      );
      this.requireOpen(match);
      const [participation] = await tx
        .select()
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.matchId, matchId),
            eq(matchParticipants.kind, "PLAYER"),
            eq(matchParticipants.playerId, actorPlayerId),
            inArray(matchParticipants.status, ["CONFIRMED", "WAITLISTED"]),
          ),
        )
        .limit(1);
      if (!participation)
        throw new ApplicationError(
          "not_participating",
          "Player is not participating",
          409,
        );
      await this.cancelParticipation(tx, participation.id, actorPlayerId);
      if (participation.status === "CONFIRMED")
        await this.promoteAvailable(tx, matchId, match.capacity);
    });
  }

  async addGuest(actorPlayerId: string, matchId: string, groupGuestId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      this.requireOpen(match);
      const [membership] = await tx
        .select({
          id: groupMemberships.id,
          role: groupMemberships.role,
          capabilities: groupMemberships.capabilities,
          guestAllowanceOverride: groupMemberships.guestAllowanceOverride,
          guestsEnabled: groups.guestsEnabled,
          defaultAllowance: groups.defaultGuestAllowancePerMember,
          groupStatus: groups.status,
        })
        .from(groupMemberships)
        .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
        .where(
          and(
            eq(groupMemberships.groupId, match.groupId),
            eq(groupMemberships.playerId, actorPlayerId),
            eq(groupMemberships.status, "ACTIVE"),
          ),
        )
        .limit(1);
      if (!membership)
        throw new ApplicationError("forbidden", "Forbidden", 403);
      if (membership.groupStatus !== "ACTIVE")
        throw new ApplicationError("group_archived", "Group is archived", 409);
      if (!membership.guestsEnabled)
        throw new ApplicationError(
          "guest_policy_disabled",
          "Guests are disabled for this Group",
          409,
        );
      await tx.execute(
        sql`select id from ${groupMemberships} where id = ${membership.id} for update`,
      );
      const [guest] = await tx
        .select()
        .from(groupGuests)
        .where(
          and(
            eq(groupGuests.id, groupGuestId),
            eq(groupGuests.groupId, match.groupId),
            eq(groupGuests.status, "ACTIVE"),
          ),
        )
        .limit(1);
      if (!guest)
        throw new ApplicationError(
          "guest_not_reusable",
          "Guest is not reusable",
          409,
        );
      const [existingGuestParticipation] = await tx
        .select({ id: matchParticipants.id })
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.matchId, matchId),
            eq(matchParticipants.kind, "GUEST"),
            eq(matchParticipants.groupGuestId, groupGuestId),
            inArray(matchParticipants.status, ["CONFIRMED", "WAITLISTED"]),
          ),
        )
        .limit(1);
      if (existingGuestParticipation)
        throw new ApplicationError(
          "already_joined",
          "Guest already participates in this Match",
          409,
        );
      const hasOverride =
        membership.role === "OWNER" ||
        hasGroupCapability(
          membership.role,
          membership.capabilities,
          "MATCH_GUEST_OVERRIDE",
        );
      if (!hasOverride) {
        const allowance =
          membership.guestAllowanceOverride ?? membership.defaultAllowance;
        const [active] = await tx
          .select({ value: sql<number>`count(*)::int` })
          .from(matchParticipants)
          .where(
            and(
              eq(matchParticipants.matchId, matchId),
              eq(matchParticipants.kind, "GUEST"),
              eq(matchParticipants.guestCreatedByPlayerId, actorPlayerId),
              inArray(matchParticipants.status, ["CONFIRMED", "WAITLISTED"]),
            ),
          );
        if ((active?.value ?? 0) >= allowance)
          throw new ApplicationError(
            "guest_allowance_exceeded",
            "Guest allowance exceeded",
            409,
          );
      }
      return this.admit(tx, match, {
        kind: "GUEST",
        groupGuestId: guest.id,
        guestDisplayName: guest.displayName,
        guestCreatedByPlayerId: actorPlayerId,
      });
    });
  }

  async cancelGuest(actorPlayerId: string, matchId: string, guestId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      this.requireOpen(match);
      const [guest] = await tx
        .select()
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.id, guestId),
            eq(matchParticipants.matchId, matchId),
            eq(matchParticipants.kind, "GUEST"),
            inArray(matchParticipants.status, ["CONFIRMED", "WAITLISTED"]),
          ),
        )
        .limit(1);
      if (!guest)
        throw new ApplicationError(
          "not_participating",
          "Guest is not participating",
          404,
        );
      if (guest.guestCreatedByPlayerId !== actorPlayerId) {
        await this.requireGroupCapability(
          tx,
          actorPlayerId,
          match.groupId,
          "MATCH_MANAGE_GUESTS",
          true,
        );
      }
      await this.cancelParticipation(tx, guest.id, actorPlayerId);
      if (guest.status === "CONFIRMED")
        await this.promoteAvailable(tx, matchId, match.capacity);
    });
  }

  async roster(actorPlayerId: string, matchId: string) {
    const match = await this.requireReadableMatch(actorPlayerId, matchId);
    const rows = await this.database
      .select({
        id: matchParticipants.id,
        kind: matchParticipants.kind,
        status: matchParticipants.status,
        playerId: matchParticipants.playerId,
        groupGuestId: matchParticipants.groupGuestId,
        playerName: players.displayName,
        guestName: matchParticipants.guestDisplayName,
        joinedAt: matchParticipants.joinedAt,
        admissionOrder: matchParticipants.admissionOrder,
        promotedAt: matchParticipants.promotedAt,
        addedByPlayerId: matchParticipants.guestCreatedByPlayerId,
      })
      .from(matchParticipants)
      .leftJoin(players, eq(players.id, matchParticipants.playerId))
      .where(
        and(
          eq(matchParticipants.matchId, matchId),
          inArray(matchParticipants.status, ["CONFIRMED", "WAITLISTED"]),
        ),
      )
      .orderBy(asc(matchParticipants.admissionOrder))
      .limit(200);
    const mapRow = (row: (typeof rows)[number], position: number) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      playerId: row.playerId,
      groupGuestId: row.kind === "GUEST" ? row.groupGuestId : null,
      displayName: row.kind === "PLAYER" ? row.playerName : row.guestName,
      joinedAt: row.joinedAt.toISOString(),
      position,
      isCurrentActor: row.kind === "PLAYER" && row.playerId === actorPlayerId,
      addedByCurrentActor:
        row.kind === "GUEST" && row.addedByPlayerId === actorPlayerId,
    });
    const confirmed = rows
      .filter((row) => row.status === "CONFIRMED")
      .map((row, index) => mapRow(row, index + 1));
    const waitlist = rows
      .filter((row) => row.status === "WAITLISTED")
      .map((row, index) => mapRow(row, index + 1));
    const currentRow = rows.find(
      (row) => row.kind === "PLAYER" && row.playerId === actorPlayerId,
    );
    const currentWaitlistPosition =
      currentRow?.status === "WAITLISTED"
        ? waitlist.findIndex((row) => row.id === currentRow.id) + 1
        : null;
    return {
      capacity: match.capacity,
      confirmedCount: confirmed.length,
      waitlistCount: waitlist.length,
      availableSpots: Math.max(0, match.capacity - confirmed.length),
      confirmed,
      waitlist,
      currentParticipation: currentRow
        ? {
            participantId: currentRow.id,
            status: currentRow.status,
            admissionNumber: Number(currentRow.admissionOrder),
            waitlistPosition: currentWaitlistPosition,
            promotedAt: currentRow.promotedAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  private async admit(
    tx: Transaction,
    match: MatchRow,
    identity:
      | { kind: "PLAYER"; playerId: string }
      | {
          kind: "GUEST";
          groupGuestId: string;
          guestDisplayName: string;
          guestCreatedByPlayerId: string;
        },
  ) {
    const confirmedCount = await this.confirmedCount(tx, match.id);
    const status = confirmedCount < match.capacity ? "CONFIRMED" : "WAITLISTED";
    const now = new Date();
    const [participant] = await tx
      .insert(matchParticipants)
      .values({
        id: randomUUID(),
        matchId: match.id,
        admissionOrder: match.nextAdmissionOrder,
        status,
        confirmedAt: status === "CONFIRMED" ? now : null,
        ...identity,
      })
      .returning();
    await tx
      .update(matches)
      .set({
        nextAdmissionOrder: match.nextAdmissionOrder + 1n,
        updatedAt: now,
      })
      .where(eq(matches.id, match.id));
    return participant!;
  }

  private async promoteAvailable(
    tx: Transaction,
    matchId: string,
    capacity: number,
  ) {
    let confirmedCount = await this.confirmedCount(tx, matchId);
    while (confirmedCount < capacity) {
      const [next] = await tx
        .select()
        .from(matchParticipants)
        .where(
          and(
            eq(matchParticipants.matchId, matchId),
            eq(matchParticipants.status, "WAITLISTED"),
          ),
        )
        .orderBy(asc(matchParticipants.admissionOrder))
        .limit(1);
      if (!next) return;
      const now = new Date();
      await tx
        .update(matchParticipants)
        .set({
          status: "CONFIRMED",
          confirmedAt: now,
          promotedAt: now,
          updatedAt: now,
        })
        .where(eq(matchParticipants.id, next.id));
      confirmedCount += 1;
    }
  }

  private async cancelParticipation(
    tx: Transaction,
    id: string,
    actorPlayerId: string,
  ) {
    const now = new Date();
    await tx
      .delete(matchTeamAssignments)
      .where(eq(matchTeamAssignments.participantId, id));
    await tx
      .update(matchParticipants)
      .set({
        status: "CANCELLED",
        cancelledAt: now,
        cancelledByPlayerId: actorPlayerId,
        updatedAt: now,
      })
      .where(eq(matchParticipants.id, id));
  }

  private async confirmedCount(db: DatabaseExecutor, matchId: string) {
    const [count] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(matchParticipants)
      .where(
        and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.status, "CONFIRMED"),
        ),
      );
    return count?.value ?? 0;
  }

  private async summary(
    match: MatchRow,
    permissions = {
      canManage: false,
      canManageGuests: false,
      canComplete: false,
      canClose: false,
    },
    scheduleChange: {
      previousScheduledAt: string;
      changedAt: string;
    } | null = null,
  ) {
    const [counts] = await this.database
      .select({
        confirmed: sql<number>`count(*) filter (where ${matchParticipants.status} = 'CONFIRMED')::int`,
        waitlisted: sql<number>`count(*) filter (where ${matchParticipants.status} = 'WAITLISTED')::int`,
      })
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, match.id));
    const confirmedCount = counts?.confirmed ?? 0;
    const recruitment = await this.recruitment.modelForMatch(
      match,
      confirmedCount,
    );
    const [structured] = match.venueId
      ? await this.database
          .select({ venue: venues, court: venueCourts })
          .from(venues)
          .leftJoin(
            venueCourts,
            eq(
              venueCourts.id,
              match.courtId ?? "00000000-0000-0000-0000-000000000000",
            ),
          )
          .where(eq(venues.id, match.venueId))
          .limit(1)
      : [];
    return {
      ...this.baseSummary(match),
      confirmedCount,
      waitlistCount: counts?.waitlisted ?? 0,
      availableSpots: Math.max(0, match.capacity - confirmedCount),
      recruitment,
      ...permissions,
      scheduleChange,
      venue: structured
        ? {
            id: structured.venue.id,
            displayName: structured.venue.displayName,
            city: structured.venue.city,
            cityKey: encodeCityRankingKey(structured.venue.normalizedCity),
            ...presentVenueGeography(
              structured.venue.countryCode,
              structured.venue.provinceCode,
            ),
            address: structured.venue.address,
            status: structured.venue.status,
          }
        : null,
      court: structured?.court
        ? {
            id: structured.court.id,
            venueId: structured.court.venueId,
            displayName: structured.court.displayName,
            status: structured.court.status,
          }
        : null,
    };
  }

  private baseSummary(match: MatchRow) {
    return {
      id: match.id,
      groupId: match.groupId,
      discipline: match.discipline,
      status: match.status,
      scheduledAt: match.scheduledAt.toISOString(),
      durationMinutes: match.durationMinutes,
      capacity: match.capacity,
      locationText: match.locationText,
      venueId: match.venueId,
      courtId: match.courtId,
      rosterLockedAt: match.rosterLockedAt?.toISOString() ?? null,
      venue: null,
      court: null,
      canManage: false,
      canManageGuests: false,
      canComplete: false,
      canClose: false,
      scheduleChange: null,
    };
  }

  private personalSummary(row: {
    match: MatchRow;
    groupId: string;
    groupName: string;
    venue: typeof venues.$inferSelect | null;
    court: typeof venueCourts.$inferSelect | null;
    confirmedCount: number;
    waitlistCount: number;
    participationStatus: "CONFIRMED" | "WAITLISTED" | null;
    waitlistPosition: number | null;
  }) {
    return {
      id: row.match.id,
      group: { id: row.groupId, name: row.groupName },
      discipline: row.match.discipline,
      status: row.match.status,
      scheduledAt: row.match.scheduledAt.toISOString(),
      durationMinutes: row.match.durationMinutes,
      capacity: row.match.capacity,
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
      court: row.court
        ? {
            id: row.court.id,
            venueId: row.court.venueId,
            displayName: row.court.displayName,
            status: row.court.status,
          }
        : null,
      confirmedCount: row.confirmedCount,
      waitlistCount: row.waitlistCount,
      participation: row.participationStatus
        ? {
            status: row.participationStatus,
            waitlistPosition: row.waitlistPosition,
          }
        : null,
    };
  }

  private async matchPermissions(actorPlayerId: string, groupId: string) {
    const [membership] = await this.database
      .select({
        role: groupMemberships.role,
        capabilities: groupMemberships.capabilities,
      })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.playerId, actorPlayerId),
          eq(groupMemberships.status, "ACTIVE"),
        ),
      )
      .limit(1);
    const has = (capability: GroupCapability) =>
      Boolean(
        membership &&
        hasGroupCapability(
          membership.role,
          membership.capabilities,
          capability,
        ),
      );
    const canComplete = has("MATCH_COMPLETE");
    return {
      canManage: has("MATCH_MANAGE"),
      canManageGuests: has("MATCH_MANAGE_GUESTS"),
      canComplete,
      canClose:
        canComplete && has("MATCH_CONFIRM_ROSTER") && has("MATCH_MANAGE_STATS"),
    };
  }

  private async resolveLocation(
    db: DatabaseExecutor,
    input: {
      locationText: string;
      venueId?: string | null;
      courtId?: string | null;
    },
  ) {
    if (!input.venueId) {
      if (input.courtId)
        throw new ApplicationError(
          "court_requires_venue",
          "Court requires Venue",
          409,
        );
      const locationText = input.locationText.trim();
      if (!locationText)
        throw new ApplicationError(
          "invalid_location",
          "Location is required",
          400,
        );
      return { venueId: null, courtId: null, locationText };
    }
    const [location] = await db
      .select({
        venueId: venues.id,
        venueName: venues.displayName,
        city: venues.city,
        courtId: venueCourts.id,
        courtName: venueCourts.displayName,
      })
      .from(venues)
      .leftJoin(
        venueCourts,
        and(
          eq(
            venueCourts.id,
            input.courtId ?? "00000000-0000-0000-0000-000000000000",
          ),
          eq(venueCourts.venueId, venues.id),
        ),
      )
      .where(and(eq(venues.id, input.venueId), eq(venues.status, "ACTIVE")))
      .limit(1);
    if (!location)
      throw new ApplicationError("venue_not_found", "Venue not found", 404);
    if (input.courtId && !location.courtId)
      throw new ApplicationError(
        "court_not_at_venue",
        "Court does not belong to Venue",
        409,
      );
    return {
      venueId: location.venueId,
      courtId: location.courtId,
      locationText: [location.venueName, location.courtName, location.city]
        .filter(Boolean)
        .join(" · "),
    };
  }

  private validateCapacity(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0)
      throw new ApplicationError(
        "invalid_capacity",
        "Capacity must be a positive integer",
        400,
      );
  }

  private async lockMatch(tx: Transaction, matchId: string) {
    const locked = await tx.execute(
      sql`select id from ${matches} where id = ${matchId} for update`,
    );
    if (locked.length === 0)
      throw new ApplicationError("match_not_found", "Match not found", 404);
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    return match!;
  }

  private async requireReadableMatch(actorPlayerId: string, matchId: string) {
    const [match] = await this.database
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    if (!match)
      throw new ApplicationError("match_not_found", "Match not found", 404);
    await this.requireGroupCapability(
      this.database,
      actorPlayerId,
      match.groupId,
      "GROUP_READ",
      false,
    );
    return match;
  }

  private async requireGroupCapability(
    db: DatabaseExecutor,
    actorPlayerId: string,
    groupId: string,
    capability: GroupCapability,
    requireActiveGroup: boolean,
  ) {
    const [membership] = await db
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
    if (!membership) throw new ApplicationError("forbidden", "Forbidden", 403);
    if (requireActiveGroup && membership.groupStatus !== "ACTIVE")
      throw new ApplicationError(
        "group_archived",
        "Archived group cannot be mutated",
        409,
      );
    if (
      !hasGroupCapability(membership.role, membership.capabilities, capability)
    )
      throw new ApplicationError("forbidden", "Forbidden", 403);
  }

  private requireOpen(match: MatchRow) {
    if (match.rosterLockedAt || match.status === "STARTED")
      throw new ApplicationError("roster_locked", "Roster is locked", 409);
    if (match.status !== "OPEN")
      throw new ApplicationError("match_not_open", "Match is not open", 409);
  }

  private invalidTransition(): never {
    throw new ApplicationError(
      "invalid_match_transition",
      "Invalid match transition",
      409,
    );
  }
}
