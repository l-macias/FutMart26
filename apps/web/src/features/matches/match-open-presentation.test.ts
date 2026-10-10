import assert from "node:assert/strict";
import test from "node:test";

import {
  canShowJoinAction,
  matchJoinLabel,
  matchRecruitmentCopy,
  matchRecruitmentStripCopy,
} from "./match-open-presentation";

void test("join action follows the authoritative effective phase", () => {
  assert.equal(canShowJoinAction("OPEN", false), true);
  assert.equal(canShowJoinAction("OPEN", true), false);

  for (const phase of [
    "DRAFT",
    "IN_PROGRESS",
    "AWAITING_RESULT",
    "VOTING_OPEN",
    "FINISHED",
    "CANCELLED",
  ] as const) {
    assert.equal(canShowJoinAction(phase, false), false);
  }
});

void test("recruitment copy never describes open admission as closed", () => {
  assert.equal(matchRecruitmentCopy("OPEN"), "Búsqueda de jugadores activa");
  assert.equal(
    matchRecruitmentCopy("FULL"),
    "Cupo completo · lista de espera disponible",
  );
  assert.equal(matchRecruitmentCopy("CLOSED"), "Búsqueda de jugadores pausada");
  assert.equal(matchRecruitmentStripCopy("CLOSED"), "PAUSADA");
});

void test("a full open Match exposes its waitlist action explicitly", () => {
  assert.equal(matchJoinLabel("FULL"), "Sumarme a la lista de espera");
  assert.equal(matchJoinLabel("OPEN"), "Anotarme");
  assert.equal(matchJoinLabel("CLOSED"), "Anotarme");
});
