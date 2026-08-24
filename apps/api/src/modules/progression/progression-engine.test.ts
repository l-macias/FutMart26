import assert from "node:assert/strict";
import test from "node:test";

import {
  PROGRESSION_V1_1_CONFIG,
  type Attribute,
} from "./progression-config.js";
import {
  calculateProgression,
  initialPerformanceState,
} from "./progression-engine.js";

const evidence = (
  ratings: number[],
  eligible: number,
  strengthTags: Attribute[][] = ratings.map(() => []),
  improvementTags: Attribute[][] = ratings.map(() => []),
) => ({
  ratings,
  eligibleEvaluatorsForTarget: eligible,
  strengthTags,
  improvementTags,
});

void test("progression decimal golden vectors", () => {
  const ratingNine = calculateProgression(
    initialPerformanceState(),
    evidence([9, 9, 9], 4),
    PROGRESSION_V1_1_CONFIG,
  );
  assert.equal(ratingNine.aggregatedRating, "9.000000000000");
  assert.equal(ratingNine.confidenceMultiplier, "1.000000000000");
  assert.equal(ratingNine.afterOvr, "60.896000000000");

  const sparse = calculateProgression(
    initialPerformanceState(),
    evidence([10], 8),
    PROGRESSION_V1_1_CONFIG,
  );
  assert.equal(sparse.confidenceMultiplier, "0.050000000000");
  assert.equal(sparse.afterOvr, "60.056000000000");

  const neutral = calculateProgression(
    {
      ...initialPerformanceState(),
      streak: { direction: "POSITIVE", count: 2 },
    },
    evidence([6], 1),
    PROGRESSION_V1_1_CONFIG,
  );
  assert.equal(neutral.processingOutcome, "NEUTRAL");
  assert.deepEqual(neutral.streakAfter, { direction: "NONE", count: 0 });
  assert.equal(neutral.ovrDelta, "0.000000000000");

  const noEvidence = calculateProgression(
    {
      ...initialPerformanceState(),
      streak: { direction: "NEGATIVE", count: 4 },
    },
    evidence([], 7),
    PROGRESSION_V1_1_CONFIG,
  );
  assert.equal(noEvidence.processingOutcome, "NO_EVIDENCE");
  assert.deepEqual(noEvidence.streakAfter, {
    direction: "NEGATIVE",
    count: 4,
  });

  const thirdPositive = calculateProgression(
    {
      ...initialPerformanceState(),
      streak: { direction: "POSITIVE", count: 2 },
    },
    evidence([9, 9, 9], 4),
    PROGRESSION_V1_1_CONFIG,
  );
  assert.equal(thirdPositive.streakMultiplier, "1.100000000000");
  assert.equal(thirdPositive.afterOvr, "60.985600000000");

  const thirdNegative = calculateProgression(
    {
      ...initialPerformanceState(),
      streak: { direction: "NEGATIVE", count: 2 },
    },
    evidence([4, 4, 4], 4, [[], [], []], [[], [], []]),
    PROGRESSION_V1_1_CONFIG,
  );
  assert.equal(thirdNegative.streakMultiplier, "1.100000000000");
  assert.equal(thirdNegative.streakAfter.direction, "NEGATIVE");

  const noTags = calculateProgression(
    initialPerformanceState(),
    evidence([9, 9, 9], 4),
    PROGRESSION_V1_1_CONFIG,
  );
  assert.equal(noTags.tagCoverage, "0.000000000000");
  assert.deepEqual(noTags.finalDistribution, noTags.baseDistribution);

  const distributed = calculateProgression(
    initialPerformanceState(),
    evidence([9, 9, 9, 9], 4, [
      ["REMATE"],
      ["REMATE", "REGATE"],
      ["VELOCIDAD"],
      [],
    ]),
    PROGRESSION_V1_1_CONFIG,
  );
  assert.equal(distributed.tagCoverage, "0.750000000000");
  assert.equal(distributed.afterOvr, "61.011599884001");

  const concentrated = calculateProgression(
    {
      ...initialPerformanceState(),
      streak: { direction: "POSITIVE", count: 4 },
    },
    evidence([10], 1, [["REMATE"]]),
    PROGRESSION_V1_1_CONFIG,
  );
  assert.equal(concentrated.afterAttributes.REMATE, "61.500000000000");
  assert.equal(concentrated.progressionBudget, "1.612800000000");

  const ovrCapped = calculateProgression(
    {
      ...initialPerformanceState(),
      streak: { direction: "POSITIVE", count: 4 },
    },
    evidence([10], 1),
    PROGRESSION_V1_1_CONFIG,
  );
  assert.equal(ovrCapped.ovrDelta, "1.200000000000");

  const high = calculateProgression(
    {
      ...initialPerformanceState(),
      attributes: Object.fromEntries(
        Object.keys(initialPerformanceState().attributes).map((attribute) => [
          attribute,
          "95.000000000000",
        ]),
      ) as ReturnType<typeof initialPerformanceState>["attributes"],
    },
    evidence([9], 1),
    PROGRESSION_V1_1_CONFIG,
  );
  assert.equal(high.ovrDelta, "0.124416000000");
});
