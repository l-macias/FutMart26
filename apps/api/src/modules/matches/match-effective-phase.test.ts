import assert from "node:assert/strict";
import test from "node:test";

import { effectiveMatchPhase, matchEndsAt } from "./match-effective-phase.js";

const startsAt = new Date("2026-09-08T20:00:00.000Z");
const base = {
  status: "OPEN" as const,
  scheduledAt: startsAt,
  durationMinutes: 60,
};

void test("effective Match phase respects exact temporal boundaries", () => {
  assert.equal(
    effectiveMatchPhase(base, new Date(startsAt.getTime() - 1_000)),
    "OPEN",
  );
  assert.equal(effectiveMatchPhase(base, startsAt), "IN_PROGRESS");
  assert.equal(
    effectiveMatchPhase(
      base,
      new Date(matchEndsAt(startsAt, 60).getTime() - 1_000),
    ),
    "IN_PROGRESS",
  );
  assert.equal(
    effectiveMatchPhase(base, matchEndsAt(startsAt, 60)),
    "AWAITING_RESULT",
  );
});

void test("persisted STARTED uses the same end boundary as OPEN", () => {
  const started = { ...base, status: "STARTED" as const };
  assert.equal(
    effectiveMatchPhase(started, new Date(startsAt.getTime() - 1_000)),
    "IN_PROGRESS",
  );
  assert.equal(
    effectiveMatchPhase(
      started,
      new Date(matchEndsAt(startsAt, 60).getTime() - 1_000),
    ),
    "IN_PROGRESS",
  );
  assert.equal(
    effectiveMatchPhase(started, matchEndsAt(startsAt, 60)),
    "AWAITING_RESULT",
  );
  assert.equal(
    effectiveMatchPhase(
      started,
      new Date(matchEndsAt(startsAt, 60).getTime() + 1_000),
    ),
    "AWAITING_RESULT",
  );
});

void test("persisted terminal states and Voting remain authoritative", () => {
  const now = new Date("2026-09-08T21:00:00.000Z");
  assert.equal(
    effectiveMatchPhase({ ...base, status: "CANCELLED" }, now),
    "CANCELLED",
  );
  assert.equal(effectiveMatchPhase({ ...base, status: "DRAFT" }, now), "DRAFT");
  assert.equal(
    effectiveMatchPhase({ ...base, status: "FINISHED" }, now),
    "FINISHED",
  );
  assert.equal(
    effectiveMatchPhase(
      {
        ...base,
        status: "FINISHED",
        voting: {
          status: "OPEN",
          opensAt: new Date("2026-09-08T20:30:00.000Z"),
          closesAt: new Date("2026-09-09T14:30:00.000Z"),
        },
      },
      now,
    ),
    "VOTING_OPEN",
  );
  assert.equal(
    effectiveMatchPhase(
      {
        ...base,
        status: "FINISHED",
        voting: {
          status: "CLOSED",
          opensAt: new Date("2026-09-08T20:30:00.000Z"),
          closesAt: new Date("2026-09-09T14:30:00.000Z"),
        },
      },
      now,
    ),
    "FINISHED",
  );
});
