import { Buffer } from "node:buffer";

import { and, avg, count, eq, max, min, sql, sum } from "drizzle-orm";
import { z } from "zod";

import type {
  GroupActivityResponse,
  GroupStatsResponse,
} from "@football/contracts";
import type { Database } from "@football/database";
import {
  groupMemberships,
  groups,
  matchAwards,
  matches,
  matchSportingResults,
  playerAchievements,
  playerPerformances,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import { hasGroupCapability } from "./capabilities.js";

const cursorSchema = z
  .object({
    version: z.literal(1),
    occurredAt: z.iso.datetime(),
    stableId: z.string().min(1).max(200),
  })
  .strict();
type ActivityCursor = z.infer<typeof cursorSchema>;

type ActivityRow = {
  event_type:
    | "MATCH_FINISHED"
    | "MATCH_CANCELLED"
    | "ACHIEVEMENT_EARNED"
    | "AWARD_EARNED"
    | "PROGRESSION_APPLIED";
  occurred_at: Date | string;
  stable_id: string;
  match_id: string;
  player_id: string | null;
  display_name: string | null;
  reward_type: string | null;
  team_a_goals: number | null;
  team_b_goals: number | null;
  ovr_delta: string | null;
};

type AchievementType =
  | "FIRST_MATCH"
  | "FIVE_MATCHES"
  | "TEN_MATCHES"
  | "FIRST_GOAL"
  | "HAT_TRICK"
  | "FIRST_ASSIST"
  | "HIGH_RATING";
type AwardType = "TOP_RATED" | "TOP_SCORER" | "TOP_ASSIST";

const achievementTitles: Record<AchievementType, string> = {
  FIRST_MATCH: "Primer partido",
  FIVE_MATCHES: "Cinco partidos",
  TEN_MATCHES: "Diez partidos",
  FIRST_GOAL: "Primer gol",
  HAT_TRICK: "Hat trick",
  FIRST_ASSIST: "Primera asistencia",
  HIGH_RATING: "Actuación destacada",
};
const awardTitles: Record<AwardType, string> = {
  TOP_RATED: "Top rated",
  TOP_SCORER: "Goleador del partido",
  TOP_ASSIST: "Asistidor del partido",
};

export class GroupInsightsService {
  constructor(private readonly database: Database) {}

  async activity(
    actorPlayerId: string,
    groupId: string,
    input: { limit: number; cursor?: string },
  ): Promise<GroupActivityResponse> {
    await this.requireRead(actorPlayerId, groupId);
    const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;
    const rows = await this.database.execute<ActivityRow>(sql`
      with activity as (
        select 'MATCH_FINISHED'::text as event_type,
          r.confirmed_at as occurred_at,
          ('MATCH_FINISHED:' || m.id::text) as stable_id,
          m.id as match_id, null::uuid as player_id, null::text as display_name,
          null::text as reward_type, r.team_a_goals, r.team_b_goals,
          null::numeric as ovr_delta
        from matches m
        join match_sporting_results r on r.match_id = m.id
        where m.group_id = ${groupId} and m.status = 'FINISHED'
          and r.status = 'CONFIRMED'
        union all
        select 'MATCH_CANCELLED', m.cancelled_at,
          ('MATCH_CANCELLED:' || m.id::text), m.id,
          null::uuid, null::text, null::text, null::integer, null::integer,
          null::numeric
        from matches m
        where m.group_id = ${groupId} and m.status = 'CANCELLED'
          and m.cancelled_at is not null
        union all
        select 'ACHIEVEMENT_EARNED', a.earned_at,
          ('ACHIEVEMENT_EARNED:' || a.id::text), m.id,
          p.id, p.display_name, a.type::text, null::integer, null::integer,
          null::numeric
        from player_achievements a
        join matches m on m.id = a.source_match_id
        join players p on p.id = a.player_id
        where m.group_id = ${groupId}
        union all
        select 'AWARD_EARNED', a.awarded_at,
          ('AWARD_EARNED:' || a.id::text), m.id,
          p.id, p.display_name, a.type::text, null::integer, null::integer,
          null::numeric
        from match_awards a
        join matches m on m.id = a.match_id
        join players p on p.id = a.player_id
        where m.group_id = ${groupId}
        union all
        select 'PROGRESSION_APPLIED', s.processed_at,
          ('PROGRESSION_APPLIED:' || s.id::text), m.id,
          p.id, p.display_name, null::text, null::integer, null::integer,
          s.ovr_delta
        from progression_snapshots s
        join matches m on m.id = s.match_id
        join players p on p.id = s.player_id
        where m.group_id = ${groupId} and s.processing_outcome = 'APPLIED'
          and s.ovr_delta <> 0
      )
      select * from activity
      where occurred_at is not null
        ${
          cursor
            ? sql`and (occurred_at < ${cursor.occurredAt}::timestamptz or
                (occurred_at = ${cursor.occurredAt}::timestamptz and stable_id < ${cursor.stableId}))`
            : sql``
        }
      order by occurred_at desc, stable_id desc
      limit ${input.limit + 1}
    `);
    const page = [...rows].slice(0, input.limit);
    return {
      items: page.map(activityEvent),
      nextCursor:
        rows.length > input.limit && page.length > 0
          ? encodeCursor({
              version: 1,
              occurredAt: new Date(page.at(-1)!.occurred_at).toISOString(),
              stableId: page.at(-1)!.stable_id,
            })
          : null,
    };
  }

  async stats(
    actorPlayerId: string,
    groupId: string,
  ): Promise<GroupStatsResponse> {
    await this.requireRead(actorPlayerId, groupId);
    const [matchStats, playerStats, awardStats, achievementStats] =
      await Promise.all([
        this.database
          .select({
            totalFinished: count(
              sql`case when ${matches.status} = 'FINISHED' then 1 end`,
            ),
            totalCancelled: count(
              sql`case when ${matches.status} = 'CANCELLED' then 1 end`,
            ),
            totalGoals: sum(
              sql`case when ${matchSportingResults.status} = 'CONFIRMED' then ${matchSportingResults.teamAGoals} + ${matchSportingResults.teamBGoals} else 0 end`,
            ),
            averageGoals: avg(
              sql`case when ${matchSportingResults.status} = 'CONFIRMED' then ${matchSportingResults.teamAGoals} + ${matchSportingResults.teamBGoals} end`,
            ),
            lastPlayedAt: max(
              sql<Date>`case when ${matchSportingResults.status} = 'CONFIRMED' then ${matchSportingResults.confirmedAt} end`,
            ),
          })
          .from(matches)
          .leftJoin(
            matchSportingResults,
            eq(matchSportingResults.matchId, matches.id),
          )
          .where(eq(matches.groupId, groupId)),
        this.database
          .select({
            activePlayerCount: count(groupMemberships.id),
            rankedPlayerCount: count(
              sql`case when ${playerPerformances.processedMatchCount} > 0 then 1 end`,
            ),
            averageProcessedMatches: avg(
              sql`case when ${playerPerformances.processedMatchCount} > 0 then ${playerPerformances.processedMatchCount} end`,
            ),
            averageOvr: avg(
              sql`case when ${playerPerformances.processedMatchCount} > 0 then ${playerPerformances.internalOvr} end`,
            ),
            highestOvr: max(
              sql`case when ${playerPerformances.processedMatchCount} > 0 then ${playerPerformances.internalOvr} end`,
            ),
            lowestOvr: min(
              sql`case when ${playerPerformances.processedMatchCount} > 0 then ${playerPerformances.internalOvr} end`,
            ),
          })
          .from(groupMemberships)
          .leftJoin(
            playerPerformances,
            and(
              eq(playerPerformances.playerId, groupMemberships.playerId),
              eq(playerPerformances.discipline, "F5"),
            ),
          )
          .where(
            and(
              eq(groupMemberships.groupId, groupId),
              eq(groupMemberships.status, "ACTIVE"),
            ),
          ),
        this.database
          .select({ value: count() })
          .from(matchAwards)
          .innerJoin(matches, eq(matches.id, matchAwards.matchId))
          .where(eq(matches.groupId, groupId)),
        this.database
          .select({ value: count() })
          .from(playerAchievements)
          .innerJoin(matches, eq(matches.id, playerAchievements.sourceMatchId))
          .where(eq(matches.groupId, groupId)),
      ]);
    const match = matchStats[0]!;
    const player = playerStats[0]!;
    const totalGoals = Number(match.totalGoals ?? 0);
    return {
      matches: {
        totalFinished: Number(match.totalFinished),
        totalCancelled: Number(match.totalCancelled),
        lastPlayedAt: match.lastPlayedAt
          ? new Date(match.lastPlayedAt).toISOString()
          : null,
      },
      goals: {
        total: totalGoals,
        averagePerPlayedMatch: match.averageGoals,
      },
      participation: {
        activePlayerCount: Number(player.activePlayerCount),
        rankedPlayerCount: Number(player.rankedPlayerCount),
        averageProcessedMatchesPerRankedPlayer: player.averageProcessedMatches,
      },
      performance: {
        averageOvr: player.averageOvr,
        highestOvr: player.highestOvr,
        lowestOvr: player.lowestOvr,
      },
      rewards: {
        totalAwardsEarned: Number(awardStats[0]?.value ?? 0),
        totalAchievementsEarnedFromGroupMatches: Number(
          achievementStats[0]?.value ?? 0,
        ),
      },
    };
  }

  private async requireRead(actorPlayerId: string, groupId: string) {
    const [membership] = await this.database
      .select({
        role: groupMemberships.role,
        capabilities: groupMemberships.capabilities,
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
        "GROUP_READ",
      )
    )
      throw new ApplicationError("forbidden", "Forbidden", 403);
  }
}

function activityEvent(
  row: ActivityRow,
): GroupActivityResponse["items"][number] {
  const common = {
    stableId: row.stable_id,
    occurredAt: new Date(row.occurred_at).toISOString(),
    matchId: row.match_id,
    target: { href: `/play/matches/${row.match_id}` },
  };
  if (row.event_type === "MATCH_FINISHED") {
    if (row.team_a_goals === null || row.team_b_goals === null)
      throw new Error("Finished activity is missing its score");
    return {
      ...common,
      eventType: "MATCH_FINISHED",
      title: `Partido finalizado · ${row.team_a_goals}–${row.team_b_goals}`,
      body: "El cierre deportivo quedó confirmado.",
      result: { teamAGoals: row.team_a_goals, teamBGoals: row.team_b_goals },
    };
  }
  if (row.event_type === "MATCH_CANCELLED")
    return {
      ...common,
      eventType: "MATCH_CANCELLED",
      title: "Partido cancelado",
      body: "La convocatoria quedó cerrada sin disputarse.",
    };
  if (!row.player_id || !row.display_name)
    throw new Error("Player activity is missing its identity");
  const player = { id: row.player_id, displayName: row.display_name };
  if (row.event_type === "ACHIEVEMENT_EARNED")
    return {
      ...common,
      eventType: "ACHIEVEMENT_EARNED",
      player,
      achievementType: row.reward_type as AchievementType,
      title: `${row.display_name} consiguió ${achievementTitles[row.reward_type as AchievementType]}`,
      body: "Nuevo logro deportivo dentro del grupo.",
    };
  if (row.event_type === "AWARD_EARNED")
    return {
      ...common,
      eventType: "AWARD_EARNED",
      player,
      awardType: row.reward_type as AwardType,
      title: `${row.display_name} fue ${awardTitles[row.reward_type as AwardType]}`,
      body: "Reconocimiento del último partido.",
    };
  if (row.ovr_delta === null)
    throw new Error("Progression activity is missing its delta");
  return {
    ...common,
    eventType: "PROGRESSION_APPLIED",
    player,
    ovrDelta: row.ovr_delta,
    title: `${row.display_name} actualizó su OVR`,
    body: `${Number(row.ovr_delta) > 0 ? "+" : ""}${Number(row.ovr_delta).toFixed(2)} OVR en este partido.`,
  };
}

function encodeCursor(cursor: ActivityCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): ActivityCursor {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url");
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    throw new ApplicationError(
      "invalid_cursor",
      "Invalid activity cursor",
      400,
    );
  }
}
