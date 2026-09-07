import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const groupSettings = readFileSync(
  new URL("./group-settings/group-settings-screen.tsx", import.meta.url),
  "utf8",
);
const matchManagement = readFileSync(
  new URL("./matches/real-match-screen.tsx", import.meta.url),
  "utf8",
);
const profileSettings = readFileSync(
  new URL("./profile-settings/profile-settings-screen.tsx", import.meta.url),
  "utf8",
);
const accountSecurity = readFileSync(
  new URL("./account/account-security-screen.tsx", import.meta.url),
  "utf8",
);

void test("Group Settings separates intent, authority and dangerous actions", () => {
  for (const section of [
    'eyebrow="GENERAL"',
    'eyebrow="MIEMBROS"',
    'eyebrow="INVITACIONES"',
    'eyebrow="INVITADOS"',
    'eyebrow="PROPIEDAD"',
    'eyebrow="ZONA DE RIESGO"',
  ])
    assert.equal(groupSettings.includes(section), true);

  assert.equal(groupSettings.includes("<SettingsSection"), true);
  assert.equal(groupSettings.includes("canManageModerators"), true);
  assert.equal(groupSettings.includes("canManageInvitations"), true);
  assert.equal(groupSettings.includes("capabilityLabels"), true);
  assert.equal(groupSettings.includes("InviteConnectionControl"), true);
  assert.equal(groupSettings.includes('type: "SINGLE_USE"'), true);
  assert.equal(groupSettings.includes('item.status === "ACTIVE"'), true);
  assert.equal(groupSettings.includes('item.status === "PENDING"'), true);
  assert.equal(groupSettings.includes("api.archiveGroupGuest"), true);
  assert.equal(groupSettings.includes("api.restoreGroupGuest"), true);
  assert.equal(groupSettings.includes("api.removeGroupGuest"), false);
  assert.equal(groupSettings.includes("<ConfirmDialog"), true);
  assert.equal(groupSettings.includes("Group ID"), false);
  assert.equal(groupSettings.includes("Player ID"), false);
  assert.ok(
    groupSettings.indexOf('eyebrow="PROPIEDAD"') <
      groupSettings.indexOf('eyebrow="ZONA DE RIESGO"'),
  );
});

void test("Match management is lifecycle-aware and keeps risk separate", () => {
  for (const section of [
    'title="DATOS"',
    'title="CONVOCATORIA"',
    'title="PARTICIPANTES"',
    'title="EQUIPOS"',
    'title="ASISTENCIA"',
    'title="RESULTADO Y EVENTOS"',
    'title="CIERRE"',
    'title="REVISIÓN DEL CIERRE"',
    'title="ZONA DE RIESGO"',
  ])
    assert.equal(matchManagement.includes(section), true);

  assert.equal(
    matchManagement.includes("composition.showOrganizerTools"),
    true,
  );
  assert.equal(matchManagement.includes("isOpen &&"), true);
  assert.equal(matchManagement.includes("finalRoster?.closureEditable"), true);
  assert.equal(
    matchManagement.includes("setCancelMatchConfirmOpen(true)"),
    true,
  );
  assert.equal(matchManagement.includes("<ConfirmDialog"), true);
  assert.equal(matchManagement.includes("Match ID"), false);
});

void test("Profile Settings keeps sport, account, legal and deletion separate", () => {
  for (const section of [
    "PERFIL",
    "FÚTBOL F5",
    "CUENTA Y SEGURIDAD",
    "LEGAL Y PRIVACIDAD",
    "ZONA DE RIESGO",
  ])
    assert.equal(profileSettings.includes(section), true);

  assert.equal(
    profileSettings.includes('href="/profile/account#delete-account"'),
    true,
  );
  assert.equal(accountSecurity.includes('id="delete-account"'), true);
  assert.equal(accountSecurity.includes("ELIMINAR MI CUENTA"), true);
  assert.equal(
    accountSecurity.includes('name="delete-account-confirmation"'),
    true,
  );
  assert.equal(accountSecurity.includes('autoComplete="off"'), true);
  assert.equal(accountSecurity.includes("<ConfirmDialog"), true);
  assert.ok(
    accountSecurity.indexOf("Sesiones activas") <
      accountSecurity.indexOf("ZONA DE RIESGO"),
  );
});
