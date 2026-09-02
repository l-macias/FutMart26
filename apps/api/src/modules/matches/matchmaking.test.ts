import assert from "node:assert/strict";
import test from "node:test";

import {
  proposeMatchTeams,
  type MatchmakingParticipant,
} from "./matchmaking.js";

function roster(
  count: number,
  keepers: number[] = [],
  strengths: number[] = [],
): MatchmakingParticipant[] {
  return Array.from({ length: count }, (_, index) => ({
    participantId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    internalOvr: String(strengths[index] ?? 60),
    preferredRoles: ["LIBRE"],
    willingToPlayGoalkeeper: keepers.includes(index),
  }));
}

void test("matchmaking is deterministic and balances even/odd F5 sides", () => {
  const even = roster(10, [0, 1], [80, 78, 75, 72, 70, 68, 65, 62, 60, 58]);
  const first = proposeMatchTeams(even);
  assert.deepEqual(proposeMatchTeams([...even].reverse()), first);
  const a = first.assignments.filter((item) => item.side === "TEAM_A");
  const b = first.assignments.filter((item) => item.side === "TEAM_B");
  assert.equal(a.length, 5);
  assert.equal(b.length, 5);
  assert.ok(a.some((item) => keepers(even).has(item.participantId)));
  assert.ok(b.some((item) => keepers(even).has(item.participantId)));

  const odd = proposeMatchTeams(
    roster(9, [], [95, 80, 75, 70, 65, 60, 60, 55, 50]),
  );
  const oddA = odd.assignments.filter((item) => item.side === "TEAM_A");
  const oddB = odd.assignments.filter((item) => item.side === "TEAM_B");
  assert.equal(Math.abs(oddA.length - oddB.length), 1);
  const strength = new Map(
    roster(9, [], [95, 80, 75, 70, 65, 60, 60, 55, 50]).map((item) => [
      item.participantId,
      Number(item.internalOvr),
    ]),
  );
  const average = (items: typeof oddA) =>
    items.reduce((sum, item) => sum + strength.get(item.participantId)!, 0) /
    items.length;
  const smaller = oddA.length < oddB.length ? oddA : oddB;
  const larger = oddA.length < oddB.length ? oddB : oddA;
  assert.ok(average(smaller) >= average(larger));
});

void test("keeper diagnostics and stable tie breaking are explicit", () => {
  assert.deepEqual(proposeMatchTeams(roster(8)).diagnostics, [
    "NO_KEEPER_COVERAGE",
  ]);
  assert.deepEqual(proposeMatchTeams(roster(8, [0])).diagnostics, [
    "INCOMPLETE_KEEPER_COVERAGE",
  ]);
  assert.deepEqual(proposeMatchTeams(roster(8, [0, 1])).diagnostics, [
    "BALANCED",
  ]);
});

for (const [count, expectedA, expectedB] of [
  [12, 6, 6],
  [11, 6, 5],
  [10, 5, 5],
  [9, 5, 4],
] as const) {
  void test(`F5 proposes deterministic ${expectedA}v${expectedB} teams from ${count} confirmed participants`, () => {
    const participants = roster(count, [0, 1]);
    const proposal = proposeMatchTeams(participants);
    assert.deepEqual(proposeMatchTeams(participants), proposal);
    assert.equal(
      proposal.assignments.filter((item) => item.side === "TEAM_A").length,
      expectedA,
    );
    assert.equal(
      proposal.assignments.filter((item) => item.side === "TEAM_B").length,
      expectedB,
    );
  });
}

function keepers(participants: MatchmakingParticipant[]) {
  return new Set(
    participants
      .filter((participant) => participant.willingToPlayGoalkeeper)
      .map((participant) => participant.participantId),
  );
}
