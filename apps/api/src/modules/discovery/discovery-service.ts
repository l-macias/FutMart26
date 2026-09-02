import { asc, sql } from "drizzle-orm";

import type {
  DiscoveryPeriod,
  FeaturedGroupsResponse,
  FeaturedPlayersResponse,
  GlobalSearchResponse,
  RisingPlayersResponse,
} from "@football/contracts";
import type { Database } from "@football/database";
import {
  accountSuspensions,
  groups,
  matches,
  matchAwards,
  matchParticipants,
  matchParticipantStats,
  matchSportingResults,
  playerPerformances,
  players,
  progressionSnapshots,
} from "@football/database/schema";

import { PublicPlayerProfileService } from "../identity/public-player-profile-service.js";

type PlayerMetricRow = {
  player_id: string;
  display_name: string;
  overall: string;
  metric_value: number | string;
};
type RisingRow = {
  player_id: string;
  display_name: string;
  current_overall: string;
  start_overall: string;
  net_ovr_gain: string;
  matches_processed: number | string;
};
type GroupMetricRow = {
  group_id: string;
  group_name: string;
  matches_played: number | string;
  active_players: number | string;
  goals: number | string;
};

export class DiscoveryService {
  constructor(
    private readonly database: Database,
    private readonly playerProfiles: PublicPlayerProfileService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async featuredPlayers(
    period: DiscoveryPeriod,
    limit: number,
  ): Promise<FeaturedPlayersResponse> {
    const currentTopOvr = await this.database.execute<PlayerMetricRow>(sql`
      select ${players.id} as player_id,
        ${players.displayName} as display_name,
        ${playerPerformances.internalOvr} as overall,
        ${playerPerformances.internalOvr} as metric_value
      from ${players}
      inner join ${playerPerformances}
        on ${playerPerformances.playerId} = ${players.id}
        and ${playerPerformances.discipline} = 'F5'
        and ${playerPerformances.processedMatchCount} > 0
      where ${players.profileVisibility} = 'PUBLIC'
        and ${players.accountStatus} = 'ACTIVE'
        and not exists (select 1 from ${accountSuspensions} where ${accountSuspensions.authUserId} = ${players.authUserId} and ${accountSuspensions.reactivatedAt} is null)
      order by ${playerPerformances.internalOvr} desc, ${players.id} asc
      limit ${limit}
    `);
    const { start, end } = periodBounds(period, this.now());
    const [topScorers, topAssists, mostAwarded] = await Promise.all([
      this.statLeaders("goals", start, end, limit),
      this.statLeaders("assists", start, end, limit),
      this.awardLeaders(start, end, limit),
    ]);
    return {
      period,
      currentTopOvr: mapPlayerMetric(currentTopOvr, "TOP_OVR"),
      topScorers: mapPlayerMetric(topScorers, "TOP_SCORERS"),
      topAssists: mapPlayerMetric(topAssists, "TOP_ASSISTS"),
      mostAwarded: mapPlayerMetric(mostAwarded, "MOST_AWARDED"),
    };
  }

  async risingPlayers(
    period: DiscoveryPeriod,
    limit: number,
  ): Promise<RisingPlayersResponse> {
    const { start, end } = periodBounds(period, this.now());
    const result = await this.database.execute<RisingRow>(sql`
      with period_snapshots as (
        select
          ${progressionSnapshots.playerId} as player_id,
          ${progressionSnapshots.beforeOvr} as before_ovr,
          ${progressionSnapshots.afterOvr} as after_ovr,
          row_number() over (
            partition by ${progressionSnapshots.playerId}
            order by ${progressionSnapshots.processedAt} asc, ${progressionSnapshots.id} asc
          ) as first_position,
          row_number() over (
            partition by ${progressionSnapshots.playerId}
            order by ${progressionSnapshots.processedAt} desc, ${progressionSnapshots.id} desc
          ) as last_position,
          count(*) over (partition by ${progressionSnapshots.playerId}) as matches_processed
        from ${progressionSnapshots}
        where ${progressionSnapshots.discipline} = 'F5'
          and ${progressionSnapshots.processedAt} >= ${start}::timestamptz
          and ${progressionSnapshots.processedAt} <= ${end}::timestamptz
      ), rising as (
        select
          period_snapshots.player_id,
          max(period_snapshots.before_ovr) filter (where period_snapshots.first_position = 1) as start_overall,
          max(period_snapshots.after_ovr) filter (where period_snapshots.last_position = 1) as end_overall,
          max(period_snapshots.matches_processed) as matches_processed
        from period_snapshots
        group by period_snapshots.player_id
        having max(period_snapshots.matches_processed) >= 2
      )
      select
        ${players.id} as player_id,
        ${players.displayName} as display_name,
        ${playerPerformances.internalOvr} as current_overall,
        rising.start_overall,
        (rising.end_overall - rising.start_overall) as net_ovr_gain,
        rising.matches_processed
      from rising
      inner join ${players} on ${players.id} = rising.player_id
      inner join ${playerPerformances}
        on ${playerPerformances.playerId} = rising.player_id
        and ${playerPerformances.discipline} = 'F5'
        and ${playerPerformances.processedMatchCount} > 0
      where rising.end_overall > rising.start_overall
        and ${players.profileVisibility} = 'PUBLIC'
        and ${players.accountStatus} = 'ACTIVE'
        and not exists (select 1 from ${accountSuspensions} where ${accountSuspensions.authUserId} = ${players.authUserId} and ${accountSuspensions.reactivatedAt} is null)
      order by net_ovr_gain desc,
        rising.matches_processed desc,
        ${playerPerformances.internalOvr} desc,
        ${players.id} asc
      limit ${limit}
    `);
    return {
      period,
      items: Array.from(result).map((row) => ({
        player: { id: row.player_id, displayName: row.display_name },
        currentOverall: row.current_overall,
        startOverall: row.start_overall,
        netOvrGain: row.net_ovr_gain,
        matchesProcessedInPeriod: Number(row.matches_processed),
      })),
    };
  }

  async featuredGroups(
    period: DiscoveryPeriod,
    limit: number,
  ): Promise<FeaturedGroupsResponse> {
    const { start, end } = periodBounds(period, this.now());
    const base = sql`
      with valid_matches as (
        select
          ${groups.id} as group_id,
          ${groups.name} as group_name,
          ${matches.id} as match_id,
          (${matchSportingResults.teamAGoals} + ${matchSportingResults.teamBGoals})::int as match_goals
        from ${groups}
        inner join ${matches} on ${matches.groupId} = ${groups.id}
          and ${matches.discipline} = 'F5'
          and ${matches.status} = 'FINISHED'
          and ${matches.scheduledAt} >= ${start}::timestamptz
          and ${matches.scheduledAt} <= ${end}::timestamptz
        inner join ${matchSportingResults}
          on ${matchSportingResults.matchId} = ${matches.id}
          and ${matchSportingResults.status} = 'CONFIRMED'
        where ${groups.status} = 'ACTIVE'
          and ${groups.visibility} = 'PUBLIC'
      ), match_metrics as (
        select group_id, group_name,
          count(*)::int as matches_played,
          sum(match_goals)::int as goals
        from valid_matches
        group by group_id, group_name
      ), player_metrics as (
        select valid_matches.group_id,
          count(distinct ${matchParticipants.playerId})::int as active_players
        from valid_matches
        inner join ${matchParticipants}
          on ${matchParticipants.matchId} = valid_matches.match_id
          and ${matchParticipants.kind} = 'PLAYER'
          and ${matchParticipants.status} = 'CONFIRMED'
          and ${matchParticipants.attendance} = 'PLAYED'
        group by valid_matches.group_id
      ), group_metrics as (
        select match_metrics.group_id, match_metrics.group_name,
          match_metrics.matches_played,
          coalesce(player_metrics.active_players, 0)::int as active_players,
          match_metrics.goals
        from match_metrics
        left join player_metrics on player_metrics.group_id = match_metrics.group_id
      )
    `;
    const [mostActive, mostActivePlayers, mostGoals] = await Promise.all([
      this.database.execute<GroupMetricRow>(sql`
        ${base}
        select * from group_metrics where matches_played > 0
        order by matches_played desc, group_id asc limit ${limit}
      `),
      this.database.execute<GroupMetricRow>(sql`
        ${base}
        select * from group_metrics where active_players > 0
        order by active_players desc, matches_played desc, group_id asc limit ${limit}
      `),
      this.database.execute<GroupMetricRow>(sql`
        ${base}
        select * from group_metrics where goals > 0
        order by goals desc, matches_played desc, group_id asc limit ${limit}
      `),
    ]);
    return {
      period,
      mostActive: mapGroupMetric(mostActive, "MOST_ACTIVE", "matches_played"),
      mostActivePlayers: mapGroupMetric(
        mostActivePlayers,
        "MOST_ACTIVE_PLAYERS",
        "active_players",
      ),
      mostGoals: mapGroupMetric(mostGoals, "MOST_GOALS", "goals"),
    };
  }

  async search(
    actorPlayerId: string,
    input: { q: string; limit: number },
  ): Promise<GlobalSearchResponse> {
    const normalized = input.q.normalize("NFKC").trim().replace(/\s+/g, " ");
    const escaped = normalized.replace(/[\\%_]/g, "\\$&");
    const [playerResults, groupRows] = await Promise.all([
      this.playerProfiles.search(actorPlayerId, input),
      this.database
        .select({ id: groups.id, name: groups.name })
        .from(groups)
        .where(
          sql`${groups.status} = 'ACTIVE' and ${groups.visibility} = 'PUBLIC' and ${groups.name} ilike ${`%${escaped}%`} escape '\\'`,
        )
        .orderBy(asc(sql`lower(${groups.name})`), asc(groups.id))
        .limit(input.limit),
    ]);
    return { players: playerResults.items, groups: groupRows };
  }

  private statLeaders(
    metric: "goals" | "assists",
    start: string,
    end: string,
    limit: number,
  ) {
    const value =
      metric === "goals"
        ? matchParticipantStats.goals
        : matchParticipantStats.assists;
    return this.database.execute<PlayerMetricRow>(sql`
      select
        ${players.id} as player_id,
        ${players.displayName} as display_name,
        ${playerPerformances.internalOvr} as overall,
        sum(${value})::int as metric_value
      from ${matchParticipantStats}
      inner join ${matchParticipants}
        on ${matchParticipants.id} = ${matchParticipantStats.participantId}
        and ${matchParticipants.kind} = 'PLAYER'
        and ${matchParticipants.status} = 'CONFIRMED'
        and ${matchParticipants.attendance} = 'PLAYED'
      inner join ${matches}
        on ${matches.id} = ${matchParticipantStats.matchId}
        and ${matches.discipline} = 'F5'
        and ${matches.status} = 'FINISHED'
        and ${matches.scheduledAt} >= ${start}::timestamptz
        and ${matches.scheduledAt} <= ${end}::timestamptz
      inner join ${matchSportingResults}
        on ${matchSportingResults.matchId} = ${matches.id}
        and ${matchSportingResults.status} = 'CONFIRMED'
      inner join ${players} on ${players.id} = ${matchParticipants.playerId}
      inner join ${playerPerformances}
        on ${playerPerformances.playerId} = ${players.id}
        and ${playerPerformances.discipline} = 'F5'
      where ${players.profileVisibility} = 'PUBLIC'
        and ${players.accountStatus} = 'ACTIVE'
        and not exists (select 1 from ${accountSuspensions} where ${accountSuspensions.authUserId} = ${players.authUserId} and ${accountSuspensions.reactivatedAt} is null)
      group by ${players.id}, ${players.displayName}, ${playerPerformances.internalOvr}
      having sum(${value}) > 0
      order by metric_value desc, ${playerPerformances.internalOvr} desc, ${players.id} asc
      limit ${limit}
    `);
  }

  private awardLeaders(start: string, end: string, limit: number) {
    return this.database.execute<PlayerMetricRow>(sql`
      select
        ${players.id} as player_id,
        ${players.displayName} as display_name,
        ${playerPerformances.internalOvr} as overall,
        count(${matchAwards.id})::int as metric_value
      from ${matchAwards}
      inner join ${players} on ${players.id} = ${matchAwards.playerId}
      inner join ${playerPerformances}
        on ${playerPerformances.playerId} = ${players.id}
        and ${playerPerformances.discipline} = 'F5'
      where ${matchAwards.awardedAt} >= ${start}::timestamptz
        and ${matchAwards.awardedAt} <= ${end}::timestamptz
        and ${players.profileVisibility} = 'PUBLIC'
        and ${players.accountStatus} = 'ACTIVE'
        and not exists (select 1 from ${accountSuspensions} where ${accountSuspensions.authUserId} = ${players.authUserId} and ${accountSuspensions.reactivatedAt} is null)
      group by ${players.id}, ${players.displayName}, ${playerPerformances.internalOvr}
      having count(${matchAwards.id}) > 0
      order by metric_value desc, ${playerPerformances.internalOvr} desc, ${players.id} asc
      limit ${limit}
    `);
  }
}

function periodBounds(period: DiscoveryPeriod, now: Date) {
  const days = period === "7d" ? 7 : 30;
  return {
    start: new Date(now.getTime() - days * 86_400_000).toISOString(),
    end: now.toISOString(),
  };
}

function mapPlayerMetric<T extends string>(
  rows: Iterable<PlayerMetricRow>,
  type: T,
) {
  return Array.from(rows).map((row) => ({
    player: { id: row.player_id, displayName: row.display_name },
    overall: row.overall,
    metric: { type, value: Number(row.metric_value) },
  }));
}

function mapGroupMetric<T extends string>(
  rows: Iterable<GroupMetricRow>,
  type: T,
  field: "matches_played" | "active_players" | "goals",
) {
  return Array.from(rows).map((row) => ({
    group: { id: row.group_id, name: row.group_name },
    metric: { type, value: Number(row[field]) },
  }));
}
