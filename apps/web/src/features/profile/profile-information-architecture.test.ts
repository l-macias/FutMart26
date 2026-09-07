import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ownProfile = readFileSync(
  new URL("./profile-screen.tsx", import.meta.url),
  "utf8",
);
const publicProfile = readFileSync(
  new URL(
    "../public-player-profile/public-player-profile-screen.tsx",
    import.meta.url,
  ),
  "utf8",
);

void test("My Profile keeps career primary and settings behind one destination", () => {
  assert.ok(
    ownProfile.indexOf("Tu carrera") < ownProfile.indexOf("Tus grupos"),
  );
  assert.ok(ownProfile.indexOf("Tus grupos") < ownProfile.indexOf("Tu red"));
  assert.ok(ownProfile.indexOf("Tu red") < ownProfile.indexOf("Configuración"));
  assert.equal(ownProfile.includes("api.ownProfile"), true);
  assert.equal(ownProfile.includes("api.progressionHistory"), false);
  assert.equal(ownProfile.includes('href="/profile/settings"'), true);
  assert.equal(ownProfile.includes("Conectar"), false);
  assert.equal(ownProfile.includes("ReportControl"), false);
});

void test("Public Profile renders authoritative award groups with stable keys", () => {
  assert.equal(publicProfile.includes("data.rewards.awardSummary.map"), true);
  assert.equal(publicProfile.includes("key={award.type}"), true);
  assert.equal(publicProfile.includes("award.awardedAt}:${award.type}"), false);
  assert.ok(
    publicProfile.indexOf("Resumen deportivo") <
      publicProfile.indexOf("Grupos"),
  );
  assert.equal(publicProfile.includes("data.isCurrentPlayer ?"), true);
});
