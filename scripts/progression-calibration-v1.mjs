/**
 * Exploratory calibration only. Not a production engine or persistence contract.
 * Mirrors the accepted V1 model and compares parameter candidates without
 * activating or silently changing its defaults.
 */

const ATTRIBUTES = [
  "VELOCIDAD",
  "PASE",
  "REGATE",
  "REMATE",
  "DEFENSA",
  "FISICO",
];
const PROFILES = {
  LIBRE: [0.166667, 0.166667, 0.166667, 0.166667, 0.166666, 0.166666],
  DEFENSIVO: [0.15, 0.18, 0.1, 0.07, 0.3, 0.2],
  MEDIO: [0.15, 0.25, 0.2, 0.12, 0.18, 0.1],
  OFENSIVO: [0.2, 0.12, 0.25, 0.25, 0.06, 0.12],
};
const RATING_CURVE = [
  [1, -1],
  [2, -0.9],
  [3, -0.75],
  [4, -0.5],
  [5, -0.2],
  [6, 0],
  [7, 0.2],
  [8, 0.5],
  [9, 0.8],
  [10, 1],
];
const CONFIDENCE_CURVES = {
  CURRENT: [
    [0, 0],
    [0.25, 0.45],
    [0.5, 0.75],
    [0.75, 1],
    [1, 1.2],
  ],
  MODERATE: [
    [0, 0],
    [0.125, 0.1],
    [0.25, 0.25],
    [0.5, 0.7],
    [0.75, 1],
    [1, 1.2],
  ],
  CONSERVATIVE: [
    [0, 0],
    [0.125, 0.05],
    [0.25, 0.2],
    [0.5, 0.65],
    [0.75, 1],
    [1, 1.2],
  ],
};
const POSITIVE_DIFFICULTY = [
  [1, 1],
  [69, 1],
  [79, 0.85],
  [89, 0.65],
  [94, 0.4],
  [99, 0.2],
];
const NEGATIVE_DIFFICULTY = [
  [1, 0.35],
  [60, 0.55],
  [70, 0.7],
  [80, 0.85],
  [90, 1],
  [99, 1],
];
const BANDS = [
  {
    max: 70,
    positive: 1.4,
    negative: 0.6,
    ovrPositiveCap: 1.2,
    ovrNegativeCap: 0.6,
    attributePositiveCap: 1.5,
    attributeNegativeCap: 0.8,
  },
  {
    max: 80,
    positive: 1.1,
    negative: 0.8,
    ovrPositiveCap: 0.9,
    ovrNegativeCap: 0.7,
    attributePositiveCap: 1.2,
    attributeNegativeCap: 0.9,
  },
  {
    max: 90,
    positive: 0.8,
    negative: 0.8,
    ovrPositiveCap: 0.6,
    ovrNegativeCap: 0.7,
    attributePositiveCap: 0.9,
    attributeNegativeCap: 0.9,
  },
  {
    max: Infinity,
    positive: 0.45,
    negative: 0.8,
    ovrPositiveCap: 0.35,
    ovrNegativeCap: 0.7,
    attributePositiveCap: 0.6,
    attributeNegativeCap: 0.9,
  },
];
const BASE_SCALE = 0.8;
const DEFAULT_CONFIG = {
  confidenceCurve: CONFIDENCE_CURVES.CURRENT,
  maxTagBlend: 0.75,
  streaksEnabled: true,
};

const interpolate = (points, value) => {
  if (value <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; index += 1) {
    if (value <= points[index][0]) {
      const [x0, y0] = points[index - 1];
      const [x1, y1] = points[index];
      return y0 + ((y1 - y0) * (value - x0)) / (x1 - x0);
    }
  }
  return points.at(-1)[1];
};
const dot = (left, right) =>
  left.reduce((sum, value, index) => sum + value * right[index], 0);
const normalize = (values) => {
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.map((value) => value / total);
};
const round = (value) => Number(value.toFixed(6));
const ovr = (state) => dot(state.attributes, PROFILES[state.ratingProfile]);
const bandFor = (value) => BANDS.find((band) => value < band.max);
const factorForStreak = (count) =>
  count >= 5 ? 1.2 : count === 4 ? 1.15 : count === 3 ? 1.1 : 1;

function initialState(value = 60, ratingProfile = "LIBRE") {
  return {
    attributes: ATTRIBUTES.map(() => value),
    ratingProfile,
    streak: { direction: "NONE", count: 0 },
  };
}

function step(state, evidence, config = DEFAULT_CONFIG) {
  const beforeOVR = ovr(state);
  const streakBefore = structuredClone(state.streak);
  if (evidence.evaluationsReceived === 0) {
    return {
      state: structuredClone(state),
      beforeOVR,
      afterOVR: beforeOVR,
      ovrDelta: 0,
      outcome: "NO_EVIDENCE",
      rawSignal: null,
      effectiveSignal: null,
      streakBefore,
      streakAfter: streakBefore,
      streakMultiplier: 1,
      attributeCapHitCount: 0,
      ovrCapHitCount: 0,
      discardedBudget: 0,
    };
  }
  const rawSignal = interpolate(RATING_CURVE, evidence.rating);
  const participationMultiplier = interpolate(
    config.confidenceCurve,
    evidence.participation,
  );
  const effectiveSignal = rawSignal * participationMultiplier;
  const qualifier =
    effectiveSignal >= 0.35
      ? "POSITIVE"
      : effectiveSignal <= -0.35
        ? "NEGATIVE"
        : "NONE";
  let streak;
  if (qualifier === "NONE") streak = { direction: "NONE", count: 0 };
  else if (qualifier === state.streak.direction)
    streak = { direction: qualifier, count: state.streak.count + 1 };
  else streak = { direction: qualifier, count: 1 };
  const streakFactor = config.streaksEnabled
    ? factorForStreak(streak.count)
    : 1;
  const band = bandFor(beforeOVR);
  const progressionBudget =
    effectiveSignal *
    BASE_SCALE *
    (effectiveSignal >= 0 ? band.positive : band.negative) *
    streakFactor;
  if (progressionBudget === 0) {
    return {
      state: { ...structuredClone(state), streak },
      beforeOVR,
      afterOVR: beforeOVR,
      ovrDelta: 0,
      outcome: "NEUTRAL",
      rawSignal,
      participationMultiplier,
      effectiveSignal,
      progressionBudget,
      streakBefore,
      streakAfter: streak,
      streakMultiplier: streakFactor,
      attributeCapHitCount: 0,
      ovrCapHitCount: 0,
      discardedBudget: 0,
    };
  }
  const weights = PROFILES[state.ratingProfile];
  const tags = evidence.tagDistribution ?? ATTRIBUTES.map(() => 0);
  const tagBlend = Math.min(
    config.maxTagBlend,
    evidence.tagCoverage * config.maxTagBlend,
  );
  const distribution = normalize(
    weights.map(
      (value, index) => value * (1 - tagBlend) + tags[index] * tagBlend,
    ),
  );
  const difficultyCurve =
    progressionBudget > 0 ? POSITIVE_DIFFICULTY : NEGATIVE_DIFFICULTY;
  const profileSensitivity = dot(weights, distribution);
  const candidateDeltas = distribution.map(
    (allocation, index) =>
      (progressionBudget *
        allocation *
        interpolate(difficultyCurve, state.attributes[index])) /
      profileSensitivity,
  );
  const candidateOVRDelta = dot(candidateDeltas, weights);
  const attributeCap =
    progressionBudget > 0
      ? band.attributePositiveCap
      : band.attributeNegativeCap;
  let attributeCapHitCount = 0;
  let cappedDeltas = candidateDeltas.map((delta, index) => {
    const signCapped = Math.max(-attributeCap, Math.min(attributeCap, delta));
    const rangeCapped = Math.max(
      1 - state.attributes[index],
      Math.min(99 - state.attributes[index], signCapped),
    );
    if (Math.abs(rangeCapped - delta) > 1e-12) attributeCapHitCount += 1;
    return rangeCapped;
  });
  const afterAttributeCapsOVRDelta = dot(cappedDeltas, weights);
  const ovrCap =
    progressionBudget > 0 ? band.ovrPositiveCap : band.ovrNegativeCap;
  const ovrCapHitCount =
    Math.abs(afterAttributeCapsOVRDelta) > ovrCap + 1e-12 ? 1 : 0;
  if (ovrCapHitCount) {
    const scale = ovrCap / Math.abs(afterAttributeCapsOVRDelta);
    cappedDeltas = cappedDeltas.map((delta) => delta * scale);
  }
  const attributes = state.attributes.map(
    (value, index) => value + cappedDeltas[index],
  );
  const afterState = { attributes, ratingProfile: state.ratingProfile, streak };
  const afterOVR = ovr(afterState);
  return {
    state: afterState,
    beforeOVR,
    afterOVR,
    ovrDelta: afterOVR - beforeOVR,
    rawSignal,
    participationMultiplier,
    effectiveSignal,
    progressionBudget,
    outcome: "APPLIED",
    streakBefore,
    streakAfter: streak,
    streakMultiplier: streakFactor,
    distribution,
    attributeDeltas: cappedDeltas,
    attributeCapHitCount,
    ovrCapHitCount,
    discardedBudget: Math.max(
      0,
      Math.abs(candidateOVRDelta) - Math.abs(afterOVR - beforeOVR),
    ),
  };
}

function simulate({
  matches,
  initial = initialState(),
  evidence,
  config = DEFAULT_CONFIG,
}) {
  let state = structuredClone(initial);
  const rows = [{ match: 0, ovr: ovr(state), state, telemetry: null }];
  for (let match = 1; match <= matches; match += 1) {
    const result = step(
      state,
      typeof evidence === "function" ? evidence(match) : evidence,
      config,
    );
    state = result.state;
    rows.push({ match, ovr: result.afterOVR, state, telemetry: result });
  }
  return rows;
}

const uniformEvidence = (rating, participation, extra = {}) => ({
  rating,
  participation,
  evaluationsReceived: 1,
  tagCoverage: 0,
  ...extra,
});
const checkpoints = (rows, points) =>
  Object.fromEntries(
    points
      .filter((point) => point < rows.length)
      .map((point) => [point, round(rows[point].ovr)]),
  );
const telemetry = (rows) => {
  const matches = rows.length - 1;
  const attributeCapHitCount = rows
    .slice(1)
    .reduce((sum, row) => sum + row.telemetry.attributeCapHitCount, 0);
  const attributeCapMatches = rows
    .slice(1)
    .filter((row) => row.telemetry.attributeCapHitCount > 0).length;
  const ovrCapHitCount = rows
    .slice(1)
    .reduce((sum, row) => sum + row.telemetry.ovrCapHitCount, 0);
  return {
    matches,
    attributeCapHitCount,
    attributeCapMatchRate: round(attributeCapMatches / matches),
    ovrCapHitCount,
    ovrCapMatchRate: round(ovrCapHitCount / matches),
    discardedBudget: round(
      rows
        .slice(1)
        .reduce((sum, row) => sum + row.telemetry.discardedBudget, 0),
    ),
  };
};
const finalSummary = (rows) => ({
  initialOVR: round(rows[0].ovr),
  finalOVR: round(rows.at(-1).ovr),
  delta: round(rows.at(-1).ovr - rows[0].ovr),
  telemetry: telemetry(rows),
});
const attributeSummary = (rows) =>
  Object.fromEntries(
    ATTRIBUTES.map((attribute, index) => [
      attribute,
      round(rows.at(-1).state.attributes[index]),
    ]),
  );

const output = {
  confidence: {},
  tags: {},
  neutralDrift: {},
  consistency: {},
  negativeStress: {},
  reversibility: {},
  profiles: {},
};

for (const [curveName, confidenceCurve] of Object.entries(CONFIDENCE_CURVES)) {
  output.confidence[curveName] = {};
  for (const [caseName, rating, participation] of [
    ["rating10_1of8", 10, 0.125],
    ["rating9_2of8", 9, 0.25],
    ["rating8.5_25pct", 8.5, 0.25],
    ["rating8.5_50pct", 8.5, 0.5],
    ["rating8.5_75pct", 8.5, 0.75],
    ["rating8.5_100pct", 8.5, 1],
  ]) {
    const rows = simulate({
      matches: 20,
      evidence: uniformEvidence(rating, participation),
      config: { ...DEFAULT_CONFIG, confidenceCurve },
    });
    output.confidence[curveName][caseName] = {
      confidenceMultiplier: interpolate(confidenceCurve, participation),
      ...finalSummary(rows),
    };
  }
}

const tagDistributions = {
  concentrated: [0, 0, 0, 1, 0, 0],
  distributed: [0.2, 0, 0.3, 0.5, 0, 0],
};
for (const maxTagBlend of [0.75, 0.5]) {
  output.tags[maxTagBlend] = {};
  for (const [distributionName, tagDistribution] of Object.entries(
    tagDistributions,
  )) {
    output.tags[maxTagBlend][distributionName] = {};
    for (const coverage of [0, 0.25, 0.5, 0.75, 1]) {
      const rows = simulate({
        matches: 10,
        evidence: uniformEvidence(8.5, 0.75, {
          tagCoverage: coverage,
          tagDistribution,
        }),
        config: { ...DEFAULT_CONFIG, maxTagBlend },
      });
      output.tags[maxTagBlend][distributionName][coverage] = {
        finalAttributes: attributeSummary(rows),
        ...finalSummary(rows),
      };
    }
  }
}

for (const rating of [6, 6.1, 6.25, 6.5, 6.75, 7]) {
  const rows = simulate({
    matches: 100,
    evidence: uniformEvidence(rating, 0.75),
  });
  output.neutralDrift[rating] = {
    checkpoints: checkpoints(rows, [10, 25, 50, 100]),
    positiveStreakActivated: rows.some(
      (row) =>
        row.telemetry?.streakAfter.direction === "POSITIVE" &&
        row.telemetry.streakAfter.count >= 3,
    ),
    maxStreak: Math.max(
      ...rows.slice(1).map((row) => row.telemetry.streakAfter.count),
    ),
    telemetry: telemetry(rows),
  };
}

const consistencySequences = {
  constant8: Array(50).fill(8),
  periodic_9_7_8_8: Array.from(
    { length: 50 },
    (_, index) => [9, 7, 8, 8][index % 4],
  ),
  wideVariance: [...Array(6).fill([10, 6, 9, 7, 10, 5, 9, 8]).flat(), 8, 8],
};
for (const [name, sequence] of Object.entries(consistencySequences)) {
  const rows = simulate({
    matches: 50,
    evidence: (match) => uniformEvidence(sequence[match - 1], 0.75),
  });
  const noStreakRows = simulate({
    matches: 50,
    evidence: (match) => uniformEvidence(sequence[match - 1], 0.75),
    config: { ...DEFAULT_CONFIG, streaksEnabled: false },
  });
  output.consistency[name] = {
    averageRating: round(
      sequence.reduce((sum, rating) => sum + rating, 0) / sequence.length,
    ),
    positiveStreakMatches: rows
      .slice(1)
      .filter(
        (row) =>
          row.telemetry.streakMultiplier > 1 &&
          row.telemetry.streakAfter.direction === "POSITIVE",
      ).length,
    maxStreak: Math.max(
      ...rows.slice(1).map((row) => row.telemetry.streakAfter.count),
    ),
    streakOVRUplift: round(rows.at(-1).ovr - noStreakRows.at(-1).ovr),
    ...finalSummary(rows),
  };
}

const detailedTrajectory = (ratings, start = 85) => {
  const rows = simulate({
    matches: ratings.length,
    initial: initialState(start),
    evidence: (match) => uniformEvidence(ratings[match - 1], 0.75),
  });
  return {
    rows: rows.slice(1).map((row, index) => ({
      match: row.match,
      rating: ratings[index],
      rawSignal: round(row.telemetry.rawSignal),
      effectiveSignal: round(row.telemetry.effectiveSignal),
      streakBefore: `${row.telemetry.streakBefore.direction}/${row.telemetry.streakBefore.count}`,
      streakAfter: `${row.telemetry.streakAfter.direction}/${row.telemetry.streakAfter.count}`,
      streakMultiplier: row.telemetry.streakMultiplier,
      ovrDelta: round(row.telemetry.ovrDelta),
      ovr: round(row.ovr),
    })),
    ...finalSummary(rows),
  };
};
output.negativeStress.badRun = detailedTrajectory([
  8, 8, 7, 8, 4, 4, 4, 4, 8, 8, 8, 7,
]);
output.negativeStress.isolatedBad = detailedTrajectory([4, 8, 4, 8, 4, 8, 4]);

for (const [name, sequence] of [
  ["upThenDown", [9, 9, 9, 9, 9, 4, 4, 4, 4, 4]],
  ["downThenUp", [4, 4, 4, 4, 4, 9, 9, 9, 9, 9]],
]) {
  const rows = simulate({
    matches: sequence.length,
    initial: initialState(80),
    evidence: (match) => uniformEvidence(sequence[match - 1], 0.75),
  });
  output.reversibility[name] = {
    trajectory: rows.map((row) => round(row.ovr)),
    peak: round(Math.max(...rows.map((row) => row.ovr))),
    trough: round(Math.min(...rows.map((row) => row.ovr))),
    ...finalSummary(rows),
  };
}

const profileSets = {
  attacker: [95, 85, 95, 99, 24, 63],
  defender: [78, 82, 55, 52, 94, 90],
  midfielder: [80, 93, 90, 76, 80, 78],
};
for (const [name, attributes] of Object.entries(profileSets)) {
  output.profiles[name] = {
    attributes: Object.fromEntries(
      ATTRIBUTES.map((attribute, index) => [attribute, attributes[index]]),
    ),
    ovrs: Object.fromEntries(
      Object.entries(PROFILES).map(([profile, weights]) => [
        profile,
        round(dot(attributes, weights)),
      ]),
    ),
  };
}

console.log(JSON.stringify(output, null, 2));
