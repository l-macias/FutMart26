import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { matchInformationArchitecture } from "./match-information-architecture";

void test("Match information architecture is lifecycle-specific and capability-aware", () => {
  const open = matchInformationArchitecture("OPEN", false);
  assert.equal(open.showAdmission, true);
  assert.equal(open.showOperationalRoster, true);
  assert.equal(open.showRecruitment, true);
  assert.equal(open.showStartedTeams, false);
  assert.equal(open.showFinishedSummary, false);
  assert.equal(open.showOrganizerTools, false);

  const openManager = matchInformationArchitecture("OPEN", true);
  assert.equal(openManager.showOrganizerTools, true);

  const started = matchInformationArchitecture("STARTED", false);
  assert.equal(started.showAdmission, false);
  assert.equal(started.showOperationalRoster, false);
  assert.equal(started.showRecruitment, false);
  assert.equal(started.showStartedTeams, true);

  const finished = matchInformationArchitecture("FINISHED", true);
  assert.equal(finished.showAdmission, false);
  assert.equal(finished.showOperationalRoster, false);
  assert.equal(finished.showRecruitment, false);
  assert.equal(finished.showStartedTeams, false);
  assert.equal(finished.showFinishedSummary, true);
  assert.equal(finished.showOrganizerTools, false);
});

void test("Match Detail keeps rankings out and groups organizer operations", () => {
  const source = readFileSync(
    new URL("./real-match-screen.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(source.includes("/rankings/"), false);
  assert.equal(source.includes("ADMINISTRAR PARTIDO"), true);
  assert.equal(source.includes("INVITADO"), true);
});

void test("Match visual composition gives each lifecycle a distinct sports hierarchy", () => {
  const screen = readFileSync(
    new URL("./real-match-screen.tsx", import.meta.url),
    "utf8",
  );
  const styles = readFileSync(
    new URL("./matches.module.css", import.meta.url),
    "utf8",
  );

  assert.equal(screen.includes("styles.openHero"), true);
  assert.equal(screen.includes("styles.startedMatchup"), true);
  assert.equal(screen.includes("styles.scoreValue"), true);
  assert.equal(screen.includes("styles.sheetNote"), true);
  assert.equal(screen.includes("styles.sheetOvr"), true);
  assert.equal(screen.includes('variant="danger"'), true);
  assert.equal(
    styles.includes("min-block-size: var(--row-min-height-compact)"),
    true,
  );
  assert.equal(
    styles.includes("grid-template-columns: minmax(0, 1fr) 2.75rem 3rem"),
    true,
  );
  assert.equal(styles.includes(".rosterRow > .rowActions"), true);
});
