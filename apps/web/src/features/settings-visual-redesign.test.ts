import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const profileSettings = read("./profile-settings/profile-settings-screen.tsx");
const profileSettingsStyles = read(
  "./profile-settings/profile-settings.module.css",
);
const account = read("./account/account-security-screen.tsx");
const groupSettings = read("./group-settings/group-settings-screen.tsx");
const groupSettingsStyles = read("./group-settings/group-settings.module.css");
const match = read("./matches/real-match-screen.tsx");
const matchStyles = read("./matches/matches.module.css");
const closure = read("./matches/match-completion-screen.tsx");

void test("Profile Settings uses a compact form hierarchy and isolates account deletion", () => {
  assert.match(profileSettings, />\s*Configuración\s*</);
  assert.match(profileSettingsStyles, /var\(--content-settings\)/);
  assert.match(profileSettings, /ui-button ui-button--danger/);
  assert.match(account, /minLength=\{8\}/);
  assert.match(account, /maxLength=\{128\}/);
  assert.match(account, /autoComplete="off"/);
  assert.match(account, /aria-label="Lista de sesiones activas"/);
  assert.match(account, /tone="danger"/);
  assert.doesNotMatch(account, /window\.confirm/);
});

void test("Group Settings presents progressive sections as rows and keeps risk explicit", () => {
  assert.match(groupSettings, /<SettingsSection/);
  assert.match(groupSettings, /<Badge kind="role">/);
  assert.match(groupSettings, /<Badge kind="state">ARCHIVADO<\/Badge>/);
  assert.match(groupSettings, /tone=\{confirm\?\.tone\}/);
  assert.doesNotMatch(groupSettings, /CONFIGURACIÓN · \{group\.data\.status\}/);
  assert.match(
    groupSettingsStyles,
    /border-block-start: var\(--border-width-thin\)/,
  );
  assert.match(groupSettingsStyles, /var\(--row-min-height-default\)/);
  assert.doesNotMatch(groupSettings, /api\.removeGroupGuest/);
});

void test("Match Management keeps lifecycle tools compact and cancellation dangerous", () => {
  assert.match(match, /ADMINISTRAR PARTIDO ·\{" "\}/);
  assert.match(match, /awaitingResult \? "ESPERANDO RESULTADO" : "EN JUEGO"/);
  assert.match(match, /ADMINISTRAR PARTIDO · FINALIZADO/);
  assert.match(match, /title="ZONA DE RIESGO"/);
  assert.match(match, /tone="danger"/);
  assert.match(matchStyles, /\.managementSection[\s\S]*grid-template-columns/);
  assert.match(matchStyles, /var\(--state-negative\) 4%/);
});

void test("Closure controls preserve sports semantics and localized labels", () => {
  assert.match(closure, /<Badge kind="role">INVITADO<\/Badge>/);
  assert.match(closure, /"Asistencia", "Resultado", "Eventos", "Revisar"/);
  assert.doesNotMatch(closure, />NO-SHOW</);
  assert.doesNotMatch(closure, /window\.confirm/);
});
