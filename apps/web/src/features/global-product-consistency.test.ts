import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const groupSettings = source("./group-settings/group-settings-screen.tsx");
const groupOverview = source("./groups/group-detail-screen.tsx");
const groups = source("./groups/groups-screen.tsx");
const matchCreation = source("./matches/match-creation-screen.tsx");
const matchDetail = source("./matches/real-match-screen.tsx");
const quickVoting = source("./voting/quick-voting.tsx");
const playerEvaluation = source("./voting/player-evaluation.tsx");
const progressionHistory = source(
  "./progression-history/progression-history-screen.tsx",
);
const progressionReveal = source(
  "./progression-reveal/progression-reveal-screen.tsx",
);
const publicProfile = source(
  "./public-player-profile/public-player-profile-screen.tsx",
);
const connections = source("./connections/connections-screen.tsx");
const connectionsStyles = source("./connections/connections.module.css");
const directedInvitations = source(
  "./directed-invitations/directed-invitations-screen.tsx",
);
const directedInvitationStyles = source(
  "./directed-invitations/directed-invitations.module.css",
);
const legalStyles = source("../app/legal.module.css");
const support = source("../app/support/page.tsx");
const apiClient = source("../lib/api/client.ts");

void test("roles, guests and lifecycle states use frozen Spanish product language", () => {
  assert.equal(groupSettings.includes('OWNER: "PROPIETARIO"'), true);
  assert.equal(groupSettings.includes('MODERATOR: "MOD"'), true);
  assert.equal(groupOverview.includes('return "PROPIETARIO"'), true);
  assert.equal(groupOverview.includes('return "MODERADOR"'), true);
  assert.equal(groups.includes("<small>{group.role}</small>"), false);
  assert.equal(groups.includes(" · ARCHIVED"), false);
  assert.equal(quickVoting.includes("<span>INVITADO</span>"), true);
  assert.equal(playerEvaluation.includes("INVITADO"), true);
  assert.equal(matchCreation.includes("Crear Draft"), false);
  assert.equal(matchCreation.includes("Revisar Draft"), false);
  assert.equal(apiClient.includes("Draft, Open o Started"), false);
});

void test("OVR remains distinct from the match note", () => {
  assert.equal(quickVoting.includes("<legend>Nota</legend>"), true);
  assert.equal(playerEvaluation.includes("Elegí una nota"), true);
  assert.equal(progressionReveal.includes("Nota del partido"), true);
  assert.equal(
    progressionHistory.includes(
      "Nota {Number(item.snapshot.aggregatedRating).toFixed(1)}",
    ),
    true,
  );
  assert.equal(
    matchDetail.includes("className={styles.actorNote}") &&
      matchDetail.includes("Number(actorTeamParticipant.rating).toFixed(1)") &&
      matchDetail.includes("className={styles.actorOvr}"),
    true,
  );
});

void test("canonical navigation keeps search, profile and match intentions separate", () => {
  assert.equal(publicProfile.includes('href="/search"'), true);
  assert.equal(publicProfile.includes('href="/players"'), false);
  assert.equal(matchDetail.includes("`/play/matches/${matchId}/voting`"), true);
  assert.equal(
    matchDetail.includes("`/play/matches/${matchId}/progression`"),
    true,
  );
});

void test("time-bearing primary surfaces explicitly use a 24-hour cycle", () => {
  for (const item of [groupOverview, matchCreation, matchDetail]) {
    assert.equal(item.includes('hourCycle: "h23"'), true);
  }
});

void test("secondary social collections use the shared compact row language", () => {
  for (const item of [connections, directedInvitations]) {
    assert.equal(item.includes("ui-list"), true);
    assert.equal(item.includes('className="ui-row"'), true);
  }
  for (const item of [connectionsStyles, directedInvitationStyles]) {
    assert.equal(item.includes("!important"), false);
  }
});

void test("directed invitations keep technical states and blocking feedback out of UI", () => {
  assert.equal(directedInvitations.includes("window.alert"), false);
  assert.equal(directedInvitations.includes('return "ACEPTADA"'), true);
  assert.equal(directedInvitations.includes('return "RECHAZADA"'), true);
  assert.equal(directedInvitations.includes('return "VENCIDA"'), true);
  assert.equal(directedInvitations.includes('return "REVOCADA"'), true);
  assert.equal(directedInvitations.includes('role="status"'), true);
});

void test("legal and support surfaces use shared layout tokens without technical copy", () => {
  assert.equal(legalStyles.includes("var(--content-reading)"), true);
  assert.equal(legalStyles.includes("var(--page-gutter)"), true);
  assert.equal(support.includes("<code>SUPPORT_EMAIL</code>"), false);
  assert.equal(
    support.includes(
      "El canal de soporte todavía no está disponible en este entorno.",
    ),
    true,
  );
});

void test("compact connection metrics keep the value before the OVR label", () => {
  assert.equal(
    connections.includes("`OVR ${Math.round(item.overall)}`"),
    false,
  );
  assert.equal(connections.includes("`${Math.round(item.overall)} OVR`"), true);
});
