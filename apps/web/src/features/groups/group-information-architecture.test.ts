import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

void test("Group Overview keeps content primary and administration contextual", () => {
  const source = readFileSync(
    new URL("./group-detail-screen.tsx", import.meta.url),
    "utf8",
  );
  const nextMatch = source.indexOf("<NextMatch");
  const roster = source.indexOf("className={styles.rosterSection}");
  const matches = source.indexOf("className={styles.matchesSection}");
  const ranking = source.indexOf("TOP DEL GRUPO");
  const activity = source.indexOf("ACTIVIDAD RECIENTE");

  assert.ok(nextMatch >= 0 && nextMatch < roster);
  assert.ok(roster < matches && matches < ranking && ranking < activity);
  assert.equal(source.includes("InvitationManager"), false);
  assert.equal(source.includes("InviteConnectionControl"), false);
  assert.equal(source.includes("Administrar grupo"), true);
  assert.equal(source.includes("/rankings?scope=group&groupId="), true);
});

void test("Group Overview fetches the full roster only after explicit expansion", () => {
  const source = readFileSync(
    new URL("./group-detail-screen.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(
    source.includes("enabled: showFullRoster && overview.isSuccess"),
    true,
  );
  assert.equal(
    source.includes("api.groupActivity(groupId, undefined, 4)"),
    true,
  );
  assert.equal(source.includes("Ver plantel completo"), true);
});
