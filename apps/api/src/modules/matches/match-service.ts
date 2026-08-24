import { randomUUID } from "node:crypto";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "@football/database";
import {
  groupMemberships,
  groups,
  matchParticipants,
  matchSportingResults,
  matchTeamAssignments,
  matches,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import {
  type GroupCapability,
  hasGroupCapability,
} from "../groups/capabilities.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseExecutor = Database | Transaction;
type MatchRow = typeof matches.$inferSelect;
type MatchInput = {
  discipline: "F5";
  scheduledAt: Date;
  durationMinutes: number;
  capacity: number;
  locationText: string;
};
type MatchUpdate = Partial<Omit<MatchInput, "discipline">>;

export class MatchService {
  constructor(private readonly database: Database) {}

  async create(actorPlayerId: string, groupId: string, input: MatchInput) {
    this.validateCapacity(input.capacity);
    await this.requireGroupCapability(
      this.database,
      actorPlayerId,
      groupId,
      "MATCH_MANAGE",
      true,
    );
    const [match] = await this.database
      .insert(matches)
      .values({
        id: randomUUID(),
        groupId,
        createdByPlayerId: actorPlayerId,
        ...input,
      })
      .returning();
    return this.summary(match!);
  }

  async list(actorPlayerId: string, groupId: string) {
    await this.requireGroupCapability(
      this.database,
      actorPlayerId,
      groupId,
      "GROUP_READ",
      false,
    );
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
    return rows.map(({ match, confirmedCount, waitlistCount }) => ({
      ...this.baseSummary(match),
      confirmedCount,
      waitlistCount,
      availableSpots: Math.max(0, match.capacity - confirmedCount),
    }));
  }

  async get(actorPlayerId: string, matchId: string) {
    const match = await this.requireReadableMatch(actorPlayerId, matchId);
    return this.summary(match);
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
      await tx
        .update(matches)
        .set({ ...input, updatedAt: new Date() })
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
    });
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

  async addGuest(actorPlayerId: string, matchId: string, displayName: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireGroupCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "MATCH_MANAGE_GUESTS",
        true,
      );
      this.requireOpen(match);
      return this.admit(tx, match, {
        kind: "GUEST",
        guestDisplayName: displayName,
        guestCreatedByPlayerId: actorPlayerId,
      });
    });
  }

  async cancelGuest(actorPlayerId: string, matchId: string, guestId: string) {
    return this.database.transaction(async (tx) => {
      const match = await this.lockMatch(tx, matchId);
      await this.requireGroupCapability(
        tx,
        actorPlayerId,
        match.groupId,
        "MATCH_MANAGE_GUESTS",
        true,
      );
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
        playerName: players.displayName,
        guestName: matchParticipants.guestDisplayName,
        joinedAt: matchParticipants.joinedAt,
        admissionOrder: matchParticipants.admissionOrder,
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
    const mapRow = (row: (typeof rows)[number]) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      playerId: row.playerId,
      displayName: row.kind === "PLAYER" ? row.playerName : row.guestName,
      joinedAt: row.joinedAt.toISOString(),
    });
    const confirmed = rows
      .filter((row) => row.status === "CONFIRMED")
      .map(mapRow);
    const waitlist = rows
      .filter((row) => row.status === "WAITLISTED")
      .map(mapRow);
    return {
      capacity: match.capacity,
      confirmedCount: confirmed.length,
      waitlistCount: waitlist.length,
      availableSpots: Math.max(0, match.capacity - confirmed.length),
      confirmed,
      waitlist,
    };
  }

  private async admit(
    tx: Transaction,
    match: MatchRow,
    identity:
      | { kind: "PLAYER"; playerId: string }
      | {
          kind: "GUEST";
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

  private async summary(match: MatchRow) {
    const [counts] = await this.database
      .select({
        confirmed: sql<number>`count(*) filter (where ${matchParticipants.status} = 'CONFIRMED')::int`,
        waitlisted: sql<number>`count(*) filter (where ${matchParticipants.status} = 'WAITLISTED')::int`,
      })
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, match.id));
    const confirmedCount = counts?.confirmed ?? 0;
    return {
      ...this.baseSummary(match),
      confirmedCount,
      waitlistCount: counts?.waitlisted ?? 0,
      availableSpots: Math.max(0, match.capacity - confirmedCount),
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
      rosterLockedAt: match.rosterLockedAt?.toISOString() ?? null,
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
