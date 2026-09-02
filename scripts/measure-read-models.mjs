import postgres from "postgres";

import { e2eDatabaseUrl } from "./e2e-database-url.mjs";

const databaseUrl = process.env.PERF_DATABASE_URL ?? e2eDatabaseUrl();
const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
if (!/(?:_e2e|_perf)(?:_[a-z0-9_-]+)?$/i.test(databaseName))
  throw new Error("Performance measurements require an _e2e or _perf database");

const sql = postgres(databaseUrl, { max: 1 });
const uuid = (prefix, expression) =>
  `(substr(md5('${prefix}' || (${expression})::text),1,8)||'-'||substr(md5('${prefix}' || (${expression})::text),9,4)||'-4'||substr(md5('${prefix}' || (${expression})::text),14,3)||'-a'||substr(md5('${prefix}' || (${expression})::text),18,3)||'-'||substr(md5('${prefix}' || (${expression})::text),21,12))::uuid`;

class RollbackMeasurement extends Error {}

try {
  await sql.begin(async (tx) => {
    await tx.unsafe(`
      insert into players (id, display_name, profile_visibility, account_status)
      select ${uuid("perf-player", "i")}, 'Perf Player ' || lpad(i::text, 4, '0'), 'PUBLIC', 'ACTIVE'
      from generate_series(1, 1000) i;

      insert into groups (id, name, created_by_player_id)
      select ${uuid("perf-group", "i")}, 'Perf Group ' || lpad(i::text, 3, '0'), ${uuid("perf-player", "i")}
      from generate_series(1, 100) i;

      insert into group_memberships (id, group_id, player_id, role, status)
      select ${uuid("perf-owner-membership", "i")}, ${uuid("perf-group", "i")}, ${uuid("perf-player", "i")}, 'OWNER', 'ACTIVE'
      from generate_series(1, 100) i;

      insert into group_memberships (id, group_id, player_id, role, status)
      select ${uuid("perf-reader-membership", "i")}, ${uuid("perf-group", "i")}, ${uuid("perf-player", "1")}, 'MEMBER', 'ACTIVE'
      from generate_series(2, 100) i;

      insert into matches (id, group_id, discipline, status, scheduled_at, duration_minutes, capacity, location_text, created_by_player_id)
      select ${uuid("perf-match", "i")}, ${uuid("perf-group", "((i - 1) % 100) + 1")}, 'F5',
        case when i % 3 = 0 then 'FINISHED'::match_status else 'OPEN'::match_status end,
        now() + ((i - 500) || ' hours')::interval, 60, 10, 'Perf pitch',
        ${uuid("perf-player", "((i - 1) % 100) + 1")}
      from generate_series(1, 1000) i;

      insert into match_participants (id, match_id, kind, player_id, status, admission_order)
      select ${uuid("perf-participant", "i")}, ${uuid("perf-match", "i")}, 'PLAYER', ${uuid("perf-player", "((i - 1) % 1000) + 1")}, 'CONFIRMED', 1
      from generate_series(1, 1000) i;

      insert into player_performances (id, player_id, discipline, velocidad, pase, regate, remate, defensa, fisico, internal_ovr, processed_match_count)
      select ${uuid("perf-performance", "i")}, ${uuid("perf-player", "i")}, 'F5', 60, 60, 60, 60, 60, 60,
        60 + (i % 30), 1 + (i % 40)
      from generate_series(1, 1000) i;
    `);

    const actor = `(${uuid("perf-player", "1")})`;
    const measurements = {};
    measurements.personalMatches = await explain(
      tx,
      `select m.id, g.name,
        (select count(*) from match_participants p where p.match_id=m.id and p.status='CONFIRMED') confirmed_count
       from matches m
       join group_memberships gm on gm.group_id=m.group_id and gm.player_id=${actor} and gm.status='ACTIVE'
       join groups g on g.id=m.group_id
       where m.status in ('DRAFT','OPEN') and m.scheduled_at >= now()
       order by m.scheduled_at, m.id limit 5`,
    );
    measurements.globalRanking = await explain(
      tx,
      `select p.id, p.display_name, pp.internal_ovr, pp.processed_match_count
       from player_performances pp join players p on p.id=pp.player_id
       where pp.discipline='F5' and pp.processed_match_count >= 1 and p.profile_visibility='PUBLIC'
       order by pp.internal_ovr desc, pp.processed_match_count desc, p.id asc limit 20`,
    );
    measurements.search = await explain(
      tx,
      `select id, display_name from players
       where account_status='ACTIVE' and profile_visibility='PUBLIC'
         and display_name ilike '%Player 09%'
       order by display_name, id limit 10`,
    );
    console.info(
      JSON.stringify(
        {
          dataset: { players: 1000, groups: 100, matches: 1000 },
          measurements,
        },
        null,
        2,
      ),
    );
    throw new RollbackMeasurement();
  });
} catch (error) {
  if (!(error instanceof RollbackMeasurement)) throw error;
} finally {
  await sql.end();
}

async function explain(tx, query) {
  const rows = await tx.unsafe(
    `explain (analyze, buffers, format json) ${query}`,
  );
  const plan = rows[0]["QUERY PLAN"][0];
  return {
    planningMs: plan["Planning Time"],
    executionMs: plan["Execution Time"],
    topNode: plan.Plan["Node Type"],
    sharedHitBlocks: plan.Plan["Shared Hit Blocks"],
    sharedReadBlocks: plan.Plan["Shared Read Blocks"],
  };
}
