import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import {
  createDrizzleAuth,
  InMemoryAuthMailService,
} from "../../packages/auth/dist/index.js";
import {
  createDatabase,
  REQUIRED_MIGRATION_TIMESTAMP,
} from "../../packages/database/dist/index.js";
import {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "../../packages/database/dist/schema.js";
import postgres from "postgres";

import { ProgressionService } from "../../apps/api/dist/modules/progression/progression-service.js";
import { RewardService } from "../../apps/api/dist/modules/rewards/reward-service.js";
import {
  deterministicUuid,
  SANDBOX_PASSWORD,
  sandboxDatabaseUrl,
} from "./config.mjs";

const startedAt = Date.now();
const { databaseName, url } = sandboxDatabaseUrl();
const seed = Number.parseInt(process.env.SANDBOX_SEED ?? "20260902", 10);
if (!Number.isSafeInteger(seed))
  throw new Error("SANDBOX_SEED must be an integer");

const now = new Date();
now.setMilliseconds(0);
const sql = postgres(url.toString(), { max: 1 });
const database = createDatabase(url.toString(), { max: 2 });

const id = (scope, index) => deterministicUuid(seed, scope, index);
const atDays = (days, hours = 0) =>
  new Date(now.getTime() + days * 86_400_000 + hours * 3_600_000);

const qaAccounts = [
  ["owner@sandbox.local", "Santiago Ferreyra"],
  ["moderator@sandbox.local", "Malena Quiroga"],
  ["player@sandbox.local", "Tomás Benítez"],
  ["private@sandbox.local", "Josefina Núñez"],
  ["admin@sandbox.local", "Valentín Acosta"],
];
const names = [
  ...qaAccounts.map(([, name]) => name),
  "Agustín Sosa",
  "Camila Roldán",
  "Facundo Pereyra",
  "Martina Villalba",
  "Joaquín Ledesma",
  "Lucía Fernández",
  "Bruno Almirón",
  "Milagros Cáceres",
  "Lautaro Mansilla",
  "Renata Ibáñez",
  "Thiago Bustamante",
  "Catalina Ocampo",
  "Benjamín Navarro",
  "Emilia Ponce",
  "Bautista Domínguez",
  "Delfina Figueroa",
  "Franco Coronel",
  "Victoria Giménez",
  "Matías Cabrera",
  "Julieta Santillán",
  "Ramiro Escudero",
  "Pilar Montenegro",
  "Nicolás De la Fuente",
  "Abril Rodríguez",
  "Gonzalo Méndez",
  "Sofía Álvarez",
  "Leandro Vera",
  "Paula Barreto",
  "Ignacio Salvatierra",
  "Florencia del Valle",
  "Máximo Aguirre",
  "Antonella Peralta",
  "Ezequiel Córdoba",
  "Maia Benavides",
  "Jerónimo Ruiz Díaz",
  "Candela Arce",
  "Simón Márquez",
  "Lola Acevedo",
  "Federico Gómez",
  "Noelia Suárez",
  "Lisandro Pérez",
  "Alma Vázquez",
  "Mariano del Río",
  "Bianca Toledo",
  "Kevin Andrada",
  "María Paz González Santamarina",
  "Ulises Farías",
  "Rocío Chávez",
  "Jugador eliminado 01",
  "Jugador eliminado 02",
];
const playerIds = names.map((_, index) => id("player", index));
const groupNames = [
  "Los del Parque",
  "Rosario Central de los Martes",
  "Barrio Norte F5",
  "La Banda del Río",
  "Córdoba Bajo las Luces",
  "Mendoza Tercer Tiempo",
  "Cuatro Amigos",
  "Históricos del Predio Sur",
];
const groupIds = groupNames.map((_, index) => id("group", index));
const venueData = [
  ["Complejo Norte", "Rosario", "rosario", "AR", "AR-S"],
  ["La Cancha Central", "Rosario", "rosario", "AR", "AR-S"],
  ["Predio Sur", "Santa Fe", "santa fe", "AR", "AR-S"],
  ["Estación Fútbol", "Córdoba", "cordoba", "AR", "AR-X"],
  ["Andes Cinco", "Mendoza", "mendoza", "AR", "AR-M"],
  ["Galpón del Litoral", "Paraná", "parana", "AR", "AR-E"],
];
const venueIds = venueData.map((_, index) => id("venue", index));
const courtIds = venueData.map((_, index) => id("court", index));
const matchIds = Array.from({ length: 45 }, (_, index) => id("match", index));
const guestNames = [
  "Pato (invitado)",
  "Nico del trabajo",
  "La Colo",
  "Fede arquero",
  "Marce",
  "Gabi del club",
  "Juan Cruz invitado del equipo visitante",
  "Coti",
  "Nacho suplente",
  "Meli",
  "Tucu",
  "Rama",
];
const guestIds = guestNames.map((_, index) => id("guest", index));

try {
  await requireMigratedEmptySandbox();
  const authUsers = await createQaAccounts();
  await seedPlayers(authUsers);
  const membershipsByGroup = await seedGroups();
  await seedVenues();
  await seedGuests();
  const matchContext = await seedMatches(membershipsByGroup);
  await seedSocialAndInvitations();
  await seedVoting(matchContext);
  await seedProgressionAndRewards(matchContext.closedMatchIndexes);
  const adminAuthId = authUsers.get("admin@sandbox.local");
  if (!adminAuthId) throw new Error("Sandbox admin account was not created");
  await seedNotificationsReportsAndAdmin(adminAuthId);
  const summary = await validateAndSummarize();
  await writeManifest(summary);
  printSummary(summary);
} finally {
  await database.close();
  await sql.end();
}

async function requireMigratedEmptySandbox() {
  const [migration] = await sql`
    select created_at::text as created_at
    from drizzle.__drizzle_migrations
    order by created_at desc limit 1
  `;
  if (migration?.created_at !== String(REQUIRED_MIGRATION_TIMESTAMP))
    throw new Error(
      "Sandbox migrations are not current; run sandbox:reset first",
    );
  const [content] = await sql`
    select
      (select count(*)::int from players) as players,
      (select count(*)::int from groups) as groups,
      (select count(*)::int from matches) as matches,
      (select count(*)::int from auth_user) as users
  `;
  if (Object.values(content).some((value) => Number(value) > 0))
    throw new Error(
      "Sandbox is not empty; run sandbox:reset before sandbox:seed",
    );
}

async function createQaAccounts() {
  const auth = createDrizzleAuth(
    database.db,
    {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
    {
      ADMIN_URL: "http://localhost:3001",
      AUTH_REQUIRE_EMAIL_VERIFICATION: "false",
      AUTH_RATE_LIMIT_TEST_SCALE: "100",
      BETTER_AUTH_SECRET: "sandbox-only-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost:4000",
      NODE_ENV: "test",
      WEB_URL: "http://localhost:3000",
    },
    new InMemoryAuthMailService(),
  );
  const users = new Map();
  for (const [index, [email, name]] of qaAccounts.entries()) {
    const response = await auth.handler(
      new Request("http://localhost:4000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, password: SANDBOX_PASSWORD }),
      }),
    );
    if (!response.ok)
      throw new Error(`Unable to create ${email}: ${await response.text()}`);
    const [user] = await sql`
      update auth_user set email_verified = true, updated_at = ${now}
      where email = ${email}
      returning id
    `;
    users.set(email, user.id);
    const signIn = await auth.handler(
      new Request("http://localhost:4000/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: SANDBOX_PASSWORD }),
      }),
    );
    if (!signIn.ok)
      throw new Error(`Known sandbox password failed for ${email}`);
    await sql`
      insert into players (
        id, auth_user_id, display_name, date_of_birth, profile_visibility,
        account_status, created_at, updated_at
      ) values (
        ${playerIds[index]}, ${user.id}, ${name}, ${`199${index}-0${index + 1}-15`},
        ${index === 3 ? "PRIVATE" : "PUBLIC"}, 'ACTIVE', ${now}, ${now}
      )
    `;
    await sql`
      insert into policy_acceptances (id, auth_user_id, type, version, accepted_at)
      values
        (${id("terms", index)}, ${user.id}, 'TERMS', 'v1', ${now}),
        (${id("privacy", index)}, ${user.id}, 'PRIVACY', 'v1', ${now})
    `;
  }
  return users;
}

async function seedPlayers(authUsers) {
  const rows = names.slice(5).map((displayName, offset) => {
    const index = offset + 5;
    const anonymized = index >= names.length - 2;
    return {
      id: playerIds[index],
      auth_user_id: null,
      display_name: displayName,
      date_of_birth: anonymized
        ? null
        : `${1984 + (index % 17)}-${String((index % 12) + 1).padStart(2, "0")}-15`,
      profile_visibility:
        anonymized || [18, 31, 46].includes(index) ? "PRIVATE" : "PUBLIC",
      account_status: anonymized ? "ANONYMIZED" : "ACTIVE",
      anonymized_at: anonymized ? atDays(-20) : null,
      created_at: atDays(-180 + index),
      updated_at: now,
    };
  });
  await sql`insert into players ${sql(
    rows,
    "id",
    "auth_user_id",
    "display_name",
    "date_of_birth",
    "profile_visibility",
    "account_status",
    "anonymized_at",
    "created_at",
    "updated_at",
  )}`;

  const roles = ["LIBRE", "DEFENSIVO", "MEDIO", "OFENSIVO", "PORTERO"];
  const strengths = [
    "VELOCIDAD",
    "PASE",
    "REGATE",
    "REMATE",
    "DEFENSA",
    "FISICO",
  ];
  const preferences = playerIds.slice(0, -2).map((playerId, index) => ({
    id: id("preference", index),
    player_id: playerId,
    discipline: "F5",
    preferred_roles:
      index % 9 === 0
        ? ["PORTERO"]
        : [roles[index % 4], roles[(index + 1) % 4]],
    willing_to_play_goalkeeper: index % 9 === 0 || index % 5 === 0,
    strengths: [strengths[index % 6], strengths[(index + 2) % 6]],
    created_at: atDays(-120),
    updated_at: now,
  }));
  await sql`insert into player_football_preferences ${sql(
    preferences,
    "id",
    "player_id",
    "discipline",
    "preferred_roles",
    "willing_to_play_goalkeeper",
    "strengths",
    "created_at",
    "updated_at",
  )}`;

  const bands = [60, 64, 68, 72, 76, 82, 90];
  const performances = playerIds.slice(0, -2).map((playerId, index) => {
    const band = bands[index % bands.length];
    return {
      id: id("performance", index),
      player_id: playerId,
      discipline: "F5",
      rating_profile: ["LIBRE", "DEFENSIVO", "MEDIO", "OFENSIVO"][index % 4],
      velocidad: band,
      pase: band,
      regate: band,
      remate: band,
      defensa: band,
      fisico: band,
      internal_ovr: band,
      streak_direction: "NONE",
      streak_count: 0,
      processed_match_count: 0,
      created_at: atDays(-120),
      updated_at: now,
    };
  });
  await sql`insert into player_performances ${sql(
    performances,
    "id",
    "player_id",
    "discipline",
    "rating_profile",
    "velocidad",
    "pase",
    "regate",
    "remate",
    "defensa",
    "fisico",
    "internal_ovr",
    "streak_direction",
    "streak_count",
    "processed_match_count",
    "created_at",
    "updated_at",
  )}`;
  void authUsers;
}

async function seedGroups() {
  const membershipCounts = [20, 18, 16, 16, 15, 15, 4, 14];
  const groups = groupNames.map((name, index) => ({
    id: groupIds[index],
    name,
    status: index === 7 ? "ARCHIVED" : "ACTIVE",
    visibility: [3, 7].includes(index) ? "PRIVATE" : "PUBLIC",
    created_by_player_id: index === 0 ? playerIds[0] : playerIds[index + 5],
    guests_enabled: true,
    default_guest_allowance_per_member: index % 3,
    created_at: atDays(-220 + index * 4),
    updated_at: now,
  }));
  await sql`insert into groups ${sql(
    groups,
    "id",
    "name",
    "status",
    "visibility",
    "created_by_player_id",
    "guests_enabled",
    "default_guest_allowance_per_member",
    "created_at",
    "updated_at",
  )}`;

  const byGroup = [];
  const memberships = [];
  for (let groupIndex = 0; groupIndex < groupIds.length; groupIndex += 1) {
    const ownerIndex = groupIndex === 0 ? 0 : groupIndex + 5;
    const indexes = ownerIndex === 0 ? [ownerIndex] : [ownerIndex, 0];
    for (
      let offset = 0;
      indexes.length < membershipCounts[groupIndex];
      offset += 1
    ) {
      const candidate = (groupIndex * 7 + offset + 1) % (playerIds.length - 2);
      if (!indexes.includes(candidate)) indexes.push(candidate);
    }
    byGroup.push(indexes.map((index) => playerIds[index]));
    indexes.forEach((playerIndex, position) => {
      const isOwner = playerIndex === ownerIndex;
      const moderator =
        !isOwner &&
        ((groupIndex === 0 && [1, 5].includes(playerIndex)) ||
          (groupIndex !== 0 && position === 2));
      memberships.push({
        id: id(`membership-${groupIndex}`, playerIndex),
        group_id: groupIds[groupIndex],
        player_id: playerIds[playerIndex],
        status: "ACTIVE",
        role: isOwner ? "OWNER" : moderator ? "MODERATOR" : "MEMBER",
        capabilities: moderator
          ? [
              "GROUP_MANAGE_MEMBERS",
              "GROUP_MANAGE_INVITATIONS",
              "MATCH_MANAGE_PARTICIPANTS",
            ]
          : [],
        joined_at: atDays(-200 + position),
        role_granted_at: atDays(-190 + position),
        created_at: atDays(-200 + position),
        updated_at: now,
      });
    });
  }
  await sql`insert into group_memberships ${sql(
    memberships,
    "id",
    "group_id",
    "player_id",
    "status",
    "role",
    "capabilities",
    "joined_at",
    "role_granted_at",
    "created_at",
    "updated_at",
  )}`;
  return byGroup;
}

async function seedVenues() {
  const venues = venueData.map(
    (
      [displayName, city, normalizedCity, countryCode, provinceCode],
      index,
    ) => ({
      id: venueIds[index],
      display_name: displayName,
      normalized_name: displayName.toLocaleLowerCase("es"),
      city,
      normalized_city: normalizedCity,
      country_code: countryCode,
      province_code: provinceCode,
      address: `Zona deportiva ${index + 1}`,
      status: "ACTIVE",
      provenance: "USER_CREATED",
      created_by_player_id: playerIds[0],
      created_at: atDays(-250 + index),
      updated_at: now,
    }),
  );
  await sql`insert into venues ${sql(
    venues,
    "id",
    "display_name",
    "normalized_name",
    "city",
    "normalized_city",
    "country_code",
    "province_code",
    "address",
    "status",
    "provenance",
    "created_by_player_id",
    "created_at",
    "updated_at",
  )}`;
  const courts = venueData.map((_, index) => ({
    id: courtIds[index],
    venue_id: venueIds[index],
    display_name: index % 2 ? "Cancha techada" : "Cancha principal",
    normalized_name: index % 2 ? "cancha techada" : "cancha principal",
    status: "ACTIVE",
    created_by_player_id: playerIds[0],
    created_at: atDays(-240),
    updated_at: now,
  }));
  await sql`insert into venue_courts ${sql(
    courts,
    "id",
    "venue_id",
    "display_name",
    "normalized_name",
    "status",
    "created_by_player_id",
    "created_at",
    "updated_at",
  )}`;
}

async function seedGuests() {
  const rows = guestNames.map((displayName, index) => ({
    id: guestIds[index],
    group_id: groupIds[index % 6],
    display_name: displayName,
    normalized_display_name: displayName.toLocaleLowerCase("es"),
    status: index === 10 ? "ARCHIVED" : "ACTIVE",
    created_by_player_id: playerIds[index % 5],
    archived_at: index === 10 ? atDays(-5) : null,
    archived_by_player_id: index === 10 ? playerIds[0] : null,
    created_at: atDays(-90 + index),
    updated_at: now,
  }));
  await sql`insert into group_guests ${sql(
    rows,
    "id",
    "group_id",
    "display_name",
    "normalized_display_name",
    "status",
    "created_by_player_id",
    "archived_at",
    "archived_by_player_id",
    "created_at",
    "updated_at",
  )}`;
}

async function seedMatches(membershipsByGroup) {
  const statuses = [
    ...Array(3).fill("DRAFT"),
    ...Array(8).fill("OPEN"),
    ...Array(2).fill("STARTED"),
    ...Array(29).fill("FINISHED"),
    ...Array(3).fill("CANCELLED"),
  ];
  const matchGroups = statuses.map((status, index) =>
    status === "FINISHED" && index % 10 === 0 ? 7 : index % 6,
  );
  const capacities = [10, 12, 11, 9];
  const matchesRows = statuses.map((status, index) => {
    const groupIndex = matchGroups[index];
    const venueIndex = index % venueIds.length;
    const future = status === "DRAFT" || status === "OPEN";
    const scheduledAt = future
      ? atDays(index + 1, index % 4)
      : status === "FINISHED"
        ? atDays(index - 42, index % 4)
        : status === "STARTED" && index === 11
          ? new Date(now.getTime() - 30 * 60_000)
          : atDays(-1, index % 3);
    const locked = ["STARTED", "FINISHED"].includes(status);
    return {
      id: matchIds[index],
      group_id: groupIds[groupIndex],
      discipline: "F5",
      status,
      scheduled_at: scheduledAt,
      duration_minutes: index % 5 === 0 ? 75 : 60,
      capacity: capacities[index % capacities.length],
      recruitment_enabled: status === "OPEN" && index % 2 === 0,
      location_text: `${venueData[venueIndex][0]} · ${venueData[venueIndex][1]}`,
      venue_id: venueIds[venueIndex],
      court_id: courtIds[venueIndex],
      created_by_player_id: membershipsByGroup[groupIndex][0],
      roster_locked_at: locked
        ? new Date(scheduledAt.getTime() - 15 * 60_000)
        : null,
      published_at:
        status === "DRAFT"
          ? null
          : new Date(scheduledAt.getTime() - 7 * 86_400_000),
      cancelled_at: status === "CANCELLED" ? atDays(-1) : null,
      cancelled_by_player_id:
        status === "CANCELLED" ? membershipsByGroup[groupIndex][0] : null,
      roster_confirmed_at:
        status === "FINISHED"
          ? new Date(scheduledAt.getTime() + 90 * 60_000)
          : null,
      roster_confirmed_by_player_id:
        status === "FINISHED" ? membershipsByGroup[groupIndex][0] : null,
      next_admission_order: 1,
      created_at: new Date(scheduledAt.getTime() - 10 * 86_400_000),
      updated_at: now,
    };
  });
  await sql`insert into matches ${sql(
    matchesRows,
    "id",
    "group_id",
    "discipline",
    "status",
    "scheduled_at",
    "duration_minutes",
    "capacity",
    "recruitment_enabled",
    "location_text",
    "venue_id",
    "court_id",
    "created_by_player_id",
    "roster_locked_at",
    "published_at",
    "cancelled_at",
    "cancelled_by_player_id",
    "roster_confirmed_at",
    "roster_confirmed_by_player_id",
    "next_admission_order",
    "created_at",
    "updated_at",
  )}`;

  const participants = [];
  const assignments = [];
  const results = [];
  const stats = [];
  const participantsByMatch = new Map();
  for (let matchIndex = 0; matchIndex < statuses.length; matchIndex += 1) {
    const status = statuses[matchIndex];
    if (status === "DRAFT" || status === "CANCELLED") continue;
    const groupIndex = matchGroups[matchIndex];
    const pool = [...membershipsByGroup[groupIndex]];
    const capacity = capacities[matchIndex % capacities.length];
    const waitlisted = status === "OPEN" && matchIndex % 2 === 0 ? 2 : 0;
    const count = capacity + waitlisted;
    const selected = [];
    if (status === "FINISHED") selected.push(playerIds[0]);
    if (matchIndex === 20) selected.push(playerIds[2]);
    for (const playerId of pool) {
      if (selected.length >= count) break;
      if (
        !selected.includes(playerId) &&
        !(matchIndex === 21 && playerId === playerIds[2])
      )
        selected.push(playerId);
    }
    const matchParticipantsForContext = [];
    for (let position = 0; position < selected.length; position += 1) {
      const useGuest =
        status === "FINISHED" &&
        groupIndex < 6 &&
        matchIndex % 4 === 0 &&
        position === selected.length - 1;
      const participantId = id(`participant-${matchIndex}`, position);
      const participantStatus =
        position < capacity ? "CONFIRMED" : "WAITLISTED";
      const played = status === "FINISHED" && participantStatus === "CONFIRMED";
      const attendance = played
        ? matchIndex % 6 === 0 && position === capacity - 2
          ? "NO_SHOW"
          : "PLAYED"
        : null;
      const guestIndex = groupIndex + (matchIndex % 2) * 6;
      participants.push({
        id: participantId,
        match_id: matchIds[matchIndex],
        kind: useGuest ? "GUEST" : "PLAYER",
        player_id: useGuest ? null : selected[position],
        group_guest_id: useGuest ? guestIds[guestIndex] : null,
        guest_display_name: useGuest ? guestNames[guestIndex] : null,
        guest_created_by_player_id: useGuest
          ? membershipsByGroup[groupIndex][0]
          : null,
        status: participantStatus,
        admission_order: position + 1,
        joined_at: new Date(
          matchesRows[matchIndex].scheduled_at.getTime() -
            4 * 86_400_000 +
            position * 60_000,
        ),
        confirmed_at:
          participantStatus === "CONFIRMED"
            ? new Date(
                matchesRows[matchIndex].scheduled_at.getTime() - 3 * 86_400_000,
              )
            : null,
        attendance,
        attendance_confirmed_at: attendance
          ? new Date(
              matchesRows[matchIndex].scheduled_at.getTime() + 80 * 60_000,
            )
          : null,
        attendance_confirmed_by_player_id: attendance
          ? membershipsByGroup[groupIndex][0]
          : null,
        created_at: atDays(-80),
        updated_at: now,
      });
      matchParticipantsForContext.push({
        id: participantId,
        kind: useGuest ? "GUEST" : "PLAYER",
        playerId: useGuest ? null : selected[position],
        status: participantStatus,
        attendance,
      });
      if (
        ["STARTED", "FINISHED"].includes(status) &&
        participantStatus === "CONFIRMED"
      ) {
        assignments.push({
          id: id(`assignment-${matchIndex}`, position),
          match_id: matchIds[matchIndex],
          participant_id: participantId,
          side: position % 2 === 0 ? "TEAM_A" : "TEAM_B",
          source: "INTELLIGENT",
          algorithm_version: "sandbox-v1",
          updated_by_player_id: membershipsByGroup[groupIndex][0],
          created_at: atDays(-40),
          updated_at: now,
        });
      }
      if (status === "FINISHED" && attendance === "PLAYED") {
        stats.push({
          id: id(`stat-${matchIndex}`, position),
          match_id: matchIds[matchIndex],
          participant_id: participantId,
          goals:
            position === 0
              ? 1 + (matchIndex % 3)
              : position === 2 && matchIndex % 2 === 0
                ? 1
                : 0,
          assists:
            position === 1 || (position === 3 && matchIndex % 3 === 0) ? 1 : 0,
          updated_by_player_id: membershipsByGroup[groupIndex][0],
          created_at: now,
          updated_at: now,
        });
      }
    }
    participantsByMatch.set(matchIndex, matchParticipantsForContext);
    matchesRows[matchIndex].next_admission_order = selected.length + 1;
    if (status === "FINISHED") {
      const teamAGoals = 1 + (matchIndex % 6);
      const teamBGoals = matchIndex % 5;
      results.push({
        id: id("result", matchIndex),
        match_id: matchIds[matchIndex],
        status: "CONFIRMED",
        team_a_goals: teamAGoals,
        team_b_goals: teamBGoals,
        updated_by_player_id: membershipsByGroup[groupIndex][0],
        confirmed_at: new Date(
          matchesRows[matchIndex].scheduled_at.getTime() + 100 * 60_000,
        ),
        confirmed_by_player_id: membershipsByGroup[groupIndex][0],
        created_at: now,
        updated_at: now,
      });
    }
  }
  await sql`insert into match_participants ${sql(participants)}`;
  await sql`
    update matches
    set status = 'OPEN', roster_locked_at = null
    where status in ('STARTED', 'FINISHED')
  `;
  await sql`insert into match_team_assignments ${sql(assignments)}`;
  for (let index = 0; index < statuses.length; index += 1) {
    if (!["STARTED", "FINISHED"].includes(statuses[index])) continue;
    await sql`
      update matches
      set status = ${statuses[index]}, roster_locked_at = ${matchesRows[index].roster_locked_at}
      where id = ${matchIds[index]}
    `;
  }
  await sql`insert into match_sporting_results ${sql(results)}`;
  await sql`insert into match_participant_stats ${sql(stats)}`;
  for (let index = 0; index < matchesRows.length; index += 1)
    await sql`update matches set next_admission_order = ${matchesRows[index].next_admission_order} where id = ${matchIds[index]}`;

  const needs = [3, 5, 7, 9].flatMap((matchIndex) => [
    {
      id: id(`need-${matchIndex}`, 0),
      match_id: matchIds[matchIndex],
      role: "PORTERO",
      quantity: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: id(`need-${matchIndex}`, 1),
      match_id: matchIds[matchIndex],
      role: "DEFENSIVO",
      quantity: 1,
      created_at: now,
      updated_at: now,
    },
  ]);
  await sql`insert into match_recruitment_needs ${sql(needs)}`;
  return {
    statuses,
    participantsByMatch,
    matchesRows,
    closedMatchIndexes: Array.from({ length: 26 }, (_, offset) => offset + 13),
  };
}

async function seedSocialAndInvitations() {
  const connections = [];
  for (let index = 5; index < 26; index += 1) {
    const pair = [playerIds[0], playerIds[index]].sort();
    connections.push({
      id: id("connection", index),
      player_low_id: pair[0],
      player_high_id: pair[1],
      requester_player_id: playerIds[0],
      status: index < 23 ? "ACCEPTED" : "PENDING",
      requested_at: atDays(-30 + index),
      accepted_at: index < 23 ? atDays(-29 + index) : null,
      updated_at: now,
    });
  }
  await sql`insert into player_connections ${sql(connections)}`;
  await sql`
    insert into group_connection_invitations (
      id, group_id, invited_player_id, invited_by_player_id, invited_by_role,
      status, expires_at, responded_at, created_at, updated_at
    ) values
      (${id("group-directed", 0)}, ${groupIds[0]}, ${playerIds[30]}, ${playerIds[0]}, 'OWNER', 'PENDING', ${atDays(7)}, null, ${atDays(-1)}, ${now}),
      (${id("group-directed", 1)}, ${groupIds[0]}, ${playerIds[10]}, ${playerIds[0]}, 'OWNER', 'ACCEPTED', ${atDays(7)}, ${atDays(-3)}, ${atDays(-4)}, ${now})
  `;
  await sql`
    insert into match_player_invitations (
      id, match_id, invited_player_id, invited_by_player_id, status,
      responded_at, created_at, updated_at
    ) values
      (${id("match-directed", 0)}, ${matchIds[3]}, ${playerIds[31]}, ${playerIds[0]}, 'PENDING', null, ${atDays(-1)}, ${now})
  `;
  await sql`
    insert into group_invitations (
      id, group_id, type, token_hash, created_by_player_id, created_by_role,
      expires_at, max_uses, use_count, created_at, updated_at
    ) values (
      ${id("token-invite", 0)}, ${groupIds[0]}, 'TIME_LIMITED',
      ${createHash("sha256").update(`${seed}:sandbox-token`).digest("hex")},
      ${playerIds[0]}, 'OWNER', ${atDays(7)}, 20, 2, ${atDays(-2)}, ${now}
    )
  `;
}

async function seedVoting(context) {
  const sessions = [];
  const ballots = [];
  const evaluations = [];
  const evidence = [];
  const noEvidence = new Set([18, 25, 33, 38]);
  for (let matchIndex = 13; matchIndex <= 41; matchIndex += 1) {
    const open = matchIndex >= 39;
    const scheduledAt = context.matchesRows[matchIndex].scheduled_at;
    const sessionId = id("voting-session", matchIndex);
    sessions.push({
      id: sessionId,
      match_id: matchIds[matchIndex],
      status: open ? "OPEN" : "CLOSED",
      opened_at: new Date(scheduledAt.getTime() + 100 * 60_000),
      closes_at: open
        ? atDays(2)
        : new Date(scheduledAt.getTime() + 73 * 3_600_000),
      closed_at: open ? null : new Date(scheduledAt.getTime() + 73 * 3_600_000),
      close_reason: open ? null : "DEADLINE",
      created_at: now,
      updated_at: now,
    });
    if (open || noEvidence.has(matchIndex)) continue;
    const playable = context.participantsByMatch
      .get(matchIndex)
      .filter(
        (participant) =>
          participant.kind === "PLAYER" && participant.attendance === "PLAYED",
      );
    const voters = playable.slice(0, Math.min(5, playable.length));
    voters.forEach((voter, voterIndex) => {
      const ballotId = id(`ballot-${matchIndex}`, voterIndex);
      const mode = (matchIndex + voterIndex) % 2 === 0 ? "QUICK" : "FULL";
      const voided = matchIndex === 17 && voterIndex === 0;
      ballots.push({
        id: ballotId,
        session_id: sessionId,
        voter_player_id: voter.playerId,
        mode,
        status: voided ? "VOIDED" : "VALID",
        submitted_at: new Date(
          scheduledAt.getTime() + (110 + voterIndex) * 60_000,
        ),
        voided_at: voided ? atDays(-10) : null,
        voided_by_player_id: voided ? playerIds[0] : null,
        created_at: now,
        updated_at: now,
      });
      const target = playable.find(
        (candidate) =>
          candidate.playerId !== voter.playerId && candidate.id !== voter.id,
      );
      if (!target) return;
      const evaluationId = id(`evaluation-${matchIndex}`, voterIndex);
      const rating = 5 + ((matchIndex + voterIndex) % 6);
      evaluations.push({
        id: evaluationId,
        ballot_id: ballotId,
        target_participant_id: target.id,
        rating,
        quick_signal:
          mode === "QUICK" ? (rating >= 7 ? "POSITIVE" : "IMPROVEMENT") : null,
        created_at: now,
        updated_at: now,
      });
      if (mode === "FULL" && rating !== 6)
        evidence.push({
          id: id(`evidence-${matchIndex}`, voterIndex),
          evaluation_id: evaluationId,
          type: rating >= 7 ? "STRENGTH" : "IMPROVEMENT",
          attribute: [
            "PASE",
            "REGATE",
            "REMATE",
            "DEFENSA",
            "VELOCIDAD",
            "FISICO",
          ][(matchIndex + voterIndex) % 6],
          created_at: now,
          updated_at: now,
        });
    });
  }
  await sql`insert into voting_sessions ${sql(sessions)}`;
  await sql`insert into voting_ballots ${sql(ballots)}`;
  await sql`insert into player_evaluations ${sql(evaluations)}`;
  if (evidence.length)
    await sql`insert into evaluation_evidence ${sql(evidence)}`;
}

async function seedProgressionAndRewards(closedMatchIndexes) {
  const progression = new ProgressionService(database.db, () => now);
  const rewards = new RewardService(database.db);
  for (const matchIndex of closedMatchIndexes) {
    await progression.processMatch(matchIds[matchIndex]);
    await rewards.reconcileMatches([matchIds[matchIndex]]);
  }
  for (const playerId of playerIds.slice(0, -2))
    await rewards.reconcilePlayer(playerId);
}

async function seedNotificationsReportsAndAdmin(adminAuthId) {
  const notificationTypes = [
    "VOTING_AVAILABLE",
    "PROGRESSION_AVAILABLE",
    "MATCH_CANCELLED",
    "ACHIEVEMENT_EARNED",
    "AWARD_EARNED",
    "CONNECTION_REQUESTED",
    "CONNECTION_ACCEPTED",
    "GROUP_INVITATION_RECEIVED",
    "MATCH_INVITATION_RECEIVED",
    "GROUP_MODERATOR_GRANTED",
    "GROUP_MODERATOR_REMOVED",
  ];
  const notificationRows = Array.from({ length: 16 }, (_, index) => ({
    id: id("notification", index),
    recipient_player_id: playerIds[0],
    type: notificationTypes[index % notificationTypes.length],
    match_id: [
      "VOTING_AVAILABLE",
      "PROGRESSION_AVAILABLE",
      "MATCH_CANCELLED",
    ].includes(notificationTypes[index % notificationTypes.length])
      ? matchIds[index % matchIds.length]
      : null,
    related_player_id: notificationTypes[
      index % notificationTypes.length
    ].startsWith("CONNECTION")
      ? playerIds[10 + index]
      : null,
    group_id:
      notificationTypes[index % notificationTypes.length].includes("GROUP") ||
      notificationTypes[index % notificationTypes.length].includes("MODERATOR")
        ? groupIds[index % groupIds.length]
        : null,
    deduplication_key: `sandbox:${seed}:notification:${index}`,
    read_at: index % 3 === 0 ? atDays(-1) : null,
    created_at: new Date(now.getTime() - index * 3_600_000),
  }));
  await sql`insert into notifications ${sql(notificationRows)}`;
  await sql`insert into admin_grants (auth_user_id, role, granted_at) values (${adminAuthId}, 'SUPERADMIN', ${now})`;
  const reports = [
    ["PLAYER", playerIds[18], "OPEN", null],
    [
      "GROUP",
      groupIds[2],
      "RESOLVED",
      "Contenido revisado y resuelto en sandbox",
    ],
    [
      "MATCH",
      matchIds[44],
      "DISMISSED",
      "Sin infracción después de revisión sandbox",
    ],
  ];
  for (const [
    index,
    [targetType, targetId, status, resolutionNote],
  ] of reports.entries()) {
    await sql`
      insert into abuse_reports (
        id, reporter_player_id, target_type, target_id, reason, comment,
        status, created_at, resolved_at, handled_by_auth_user_id, resolution_note
      ) values (
        ${id("report", index)}, ${playerIds[index + 1]}, ${targetType}, ${targetId},
        ${index === 0 ? "OTHER" : index === 1 ? "INAPPROPRIATE_CONTENT" : "SPAM"},
        ${`Caso ficticio de QA ${index + 1}`}, ${status}, ${atDays(-5 + index)},
        ${status === "OPEN" ? null : atDays(-1)},
        ${status === "OPEN" ? null : adminAuthId}, ${resolutionNote}
      )
    `;
    if (status !== "OPEN")
      await sql`
        insert into admin_audit_events (
          id, actor_auth_user_id, action, target_type, target_id, reason,
          metadata, request_id, created_at
        ) values (
          ${id("audit", index)}, ${adminAuthId},
          ${status === "RESOLVED" ? "REPORT_RESOLVED" : "REPORT_DISMISSED"},
          'REPORT', ${id("report", index)}, ${resolutionNote},
          ${sql.json({ sandbox: true })}, ${`sandbox-seed-${seed}-${index}`}, ${atDays(-1)}
        )
      `;
  }
}

async function validateAndSummarize() {
  const [counts] = await sql`
    select
      (select count(*)::int from players) as players,
      (select count(*)::int from groups) as groups,
      (select count(*)::int from group_guests) as guests,
      (select count(*)::int from matches) as matches,
      (select count(*)::int from voting_ballots) as ballots,
      (select count(*)::int from progression_snapshots) as snapshots,
      (select count(*)::int from notifications where recipient_player_id = ${playerIds[0]}) as owner_notifications,
      (select count(*)::int from abuse_reports) as reports
  `;
  const statusRows =
    await sql`select status, count(*)::int as count from matches group by status order by status`;
  const readyAccounts = await sql`
    select au.email
    from auth_user au
    join players p on p.auth_user_id = au.id
    join player_football_preferences pref on pref.player_id = p.id and pref.discipline = 'F5'
    where au.email = any(${qaAccounts.map(([email]) => email)})
      and au.email_verified and p.date_of_birth is not null
      and (select count(*) from policy_acceptances pa where pa.auth_user_id = au.id and pa.version = 'v1') = 2
  `;
  const [admin] =
    await sql`select role from admin_grants where auth_user_id = (select id from auth_user where email = 'admin@sandbox.local')`;
  const [progression] =
    await sql`select count(*)::int as count from progression_snapshots where match_id = ${matchIds[20]}`;
  const [nonParticipant] =
    await sql`select count(*)::int as count from match_participants where match_id = ${matchIds[21]} and player_id = ${playerIds[2]}`;
  const [privatePlayer] =
    await sql`select profile_visibility from players where id = ${playerIds[3]}`;
  const [privateGroup] =
    await sql`select visibility from groups where id = ${groupIds[3]}`;
  const [progressionDiscontinuities] = await sql`
    with ordered as (
      select snapshot.player_id, snapshot.before_ovr,
        lag(snapshot.after_ovr) over (
          partition by snapshot.player_id
          order by match.scheduled_at, match.id
        ) as previous_after
      from progression_snapshots snapshot
      join matches match on match.id = snapshot.match_id
      where snapshot.player_id = any(${[playerIds[0], playerIds[2]]})
        and snapshot.discipline = 'F5'
    )
    select count(*)::int as count
    from ordered
    where previous_after is not null and before_ovr <> previous_after
  `;
  if (
    counts.players !== 55 ||
    counts.groups !== 8 ||
    counts.matches !== 45 ||
    readyAccounts.length !== qaAccounts.length ||
    admin?.role !== "SUPERADMIN" ||
    progression.count < 1 ||
    nonParticipant.count !== 0 ||
    privatePlayer?.profile_visibility !== "PRIVATE" ||
    privateGroup?.visibility !== "PRIVATE" ||
    progressionDiscontinuities.count !== 0
  )
    throw new Error("Sandbox validation failed; dataset was not marked ready");
  return {
    seed,
    database: databaseName,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    accounts: qaAccounts.map(([email]) => email),
    password: SANDBOX_PASSWORD,
    counts,
    matchesByStatus: Object.fromEntries(
      statusRows.map((row) => [row.status, row.count]),
    ),
    scenarios: {
      openMatch: matchIds[3],
      fullWaitlistMatch: matchIds[4],
      finishedVotingOpen: matchIds[39],
      finishedProgressionReady: matchIds[20],
      finishedNonParticipant: matchIds[21],
      privatePlayer: { id: playerIds[3], name: names[3] },
      privateGroup: { id: groupIds[3], name: groupNames[3] },
      openReport: id("report", 0),
    },
  };
}

async function writeManifest(summary) {
  await mkdir(".runtime", { recursive: true });
  await writeFile(
    ".runtime/sandbox-manifest.json",
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
}

function printSummary(summary) {
  console.info("\nSANDBOX READY\n");
  console.info(`Database: ${summary.database}`);
  console.info(`Seed: ${summary.seed}`);
  console.info(
    `Accounts:\n${summary.accounts.map((email) => `- ${email}`).join("\n")}`,
  );
  console.info(`Password: ${summary.password}`);
  console.info("Scenarios:");
  for (const [name, value] of Object.entries(summary.scenarios))
    console.info(
      `- ${name}: ${typeof value === "string" ? value : `${value.name} (${value.id})`}`,
    );
  console.info(`Manifest: .runtime/sandbox-manifest.json`);
  console.info(`Seed time: ${(summary.durationMs / 1000).toFixed(1)}s`);
}
