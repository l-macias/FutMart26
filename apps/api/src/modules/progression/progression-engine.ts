import { Decimal } from "decimal.js";

import {
  ATTRIBUTES,
  type Attribute,
  type ProgressionConfig,
  type RatingProfile,
  progressionConfigSchema,
} from "./progression-config.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
type Streak = { direction: "POSITIVE" | "NEGATIVE" | "NONE"; count: number };
export type ProgressionState = {
  attributes: Record<Attribute, string>;
  ratingProfile: RatingProfile;
  streak: Streak;
};
export type MatchEvidence = {
  ratings: number[];
  eligibleEvaluatorsForTarget: number;
  strengthTags: Attribute[][];
  improvementTags: Attribute[][];
};
export type ProgressionCalculation = {
  processingOutcome: "APPLIED" | "NEUTRAL" | "NO_EVIDENCE";
  beforeAttributes: Record<Attribute, string>;
  afterAttributes: Record<Attribute, string>;
  attributeDeltas: Record<Attribute, string>;
  beforeOvr: string;
  afterOvr: string;
  ovrDelta: string;
  evaluationsReceived: number;
  eligibleEvaluatorsForTarget: number;
  aggregatedRating: string | null;
  participationRatio: string;
  confidenceMultiplier: string;
  rawPerformanceSignal: string | null;
  effectivePerformanceSignal: string | null;
  streakBefore: Streak;
  streakAfter: Streak;
  streakMultiplier: string;
  progressionBudget: string;
  baseDistribution: Record<Attribute, string>;
  tagCoverage: string;
  tagDistribution: Record<Attribute, string>;
  finalDistribution: Record<Attribute, string>;
};

const decimal = (value: Decimal.Value) => new Decimal(value);
const stored = (value: Decimal.Value) =>
  decimal(value).toDecimalPlaces(12, Decimal.ROUND_HALF_UP).toFixed(12);
const zeroMap = () =>
  Object.fromEntries(
    ATTRIBUTES.map((attribute) => [attribute, stored(0)]),
  ) as Record<Attribute, string>;
const decimalMap = (values: Record<Attribute, string>) =>
  Object.fromEntries(
    ATTRIBUTES.map((attribute) => [attribute, decimal(values[attribute])]),
  ) as Record<Attribute, Decimal>;
const storedMap = (values: Record<Attribute, Decimal>) =>
  Object.fromEntries(
    ATTRIBUTES.map((attribute) => [attribute, stored(values[attribute])]),
  ) as Record<Attribute, string>;
const sum = (values: Decimal[]) =>
  values.reduce((total, value) => total.plus(value), decimal(0));

function interpolate(points: [string, string][], input: Decimal) {
  if (input.lte(points[0]![0])) return decimal(points[0]![1]);
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index]!;
    if (input.lte(x1)) {
      const [x0, y0] = points[index - 1]!;
      return decimal(y0).plus(
        decimal(y1).minus(y0).times(input.minus(x0)).div(decimal(x1).minus(x0)),
      );
    }
  }
  return decimal(points.at(-1)![1]);
}

function deriveOvr(
  attributes: Record<Attribute, Decimal>,
  weights: Record<Attribute, string>,
) {
  return sum(
    ATTRIBUTES.map((attribute) =>
      attributes[attribute].times(weights[attribute]),
    ),
  );
}

function distributionToStored(values: Record<Attribute, Decimal>) {
  return storedMap(values);
}

export function calculateProgression(
  before: ProgressionState,
  evidence: MatchEvidence,
  rawConfig: ProgressionConfig,
): ProgressionCalculation {
  const config = progressionConfigSchema.parse(rawConfig);
  if (evidence.eligibleEvaluatorsForTarget < evidence.ratings.length)
    throw new Error("Evaluations exceed eligible evaluators");
  const beforeAttributesDecimal = decimalMap(before.attributes);
  const weights = config.profileWeights[before.ratingProfile];
  const baseDistributionDecimal = decimalMap(weights);
  const beforeOvrDecimal = deriveOvr(beforeAttributesDecimal, weights);
  const unchanged = (
    outcome: "NEUTRAL" | "NO_EVIDENCE",
    streakAfter: Streak,
    aggregatedRating: Decimal | null,
    participation: Decimal,
    confidence: Decimal,
    rawSignal: Decimal | null,
    effective: Decimal | null,
  ): ProgressionCalculation => ({
    processingOutcome: outcome,
    beforeAttributes: storedMap(beforeAttributesDecimal),
    afterAttributes: storedMap(beforeAttributesDecimal),
    attributeDeltas: zeroMap(),
    beforeOvr: stored(beforeOvrDecimal),
    afterOvr: stored(beforeOvrDecimal),
    ovrDelta: stored(0),
    evaluationsReceived: evidence.ratings.length,
    eligibleEvaluatorsForTarget: evidence.eligibleEvaluatorsForTarget,
    aggregatedRating: aggregatedRating ? stored(aggregatedRating) : null,
    participationRatio: stored(participation),
    confidenceMultiplier: stored(confidence),
    rawPerformanceSignal: rawSignal ? stored(rawSignal) : null,
    effectivePerformanceSignal: effective ? stored(effective) : null,
    streakBefore: structuredClone(before.streak),
    streakAfter,
    streakMultiplier: stored(1),
    progressionBudget: stored(0),
    baseDistribution: distributionToStored(baseDistributionDecimal),
    tagCoverage: stored(0),
    tagDistribution: zeroMap(),
    finalDistribution: distributionToStored(baseDistributionDecimal),
  });
  if (evidence.ratings.length === 0)
    return unchanged(
      "NO_EVIDENCE",
      structuredClone(before.streak),
      null,
      decimal(0),
      decimal(0),
      null,
      null,
    );

  const average = sum(evidence.ratings.map(decimal)).div(
    evidence.ratings.length,
  );
  const participation = decimal(evidence.ratings.length).div(
    evidence.eligibleEvaluatorsForTarget,
  );
  const confidence = interpolate(
    config.confidenceCurve,
    Decimal.min(1, Decimal.max(0, participation)),
  );
  const rawSignal = interpolate(config.ratingCurve, average);
  const effective = rawSignal.times(confidence);
  const qualifier: Streak["direction"] = effective.gte(
    config.positiveStreakThreshold,
  )
    ? "POSITIVE"
    : effective.lte(config.negativeStreakThreshold)
      ? "NEGATIVE"
      : "NONE";
  const streakAfter: Streak =
    qualifier === "NONE"
      ? { direction: "NONE", count: 0 }
      : qualifier === before.streak.direction
        ? { direction: qualifier, count: before.streak.count + 1 }
        : { direction: qualifier, count: 1 };
  if (effective.isZero())
    return unchanged(
      "NEUTRAL",
      streakAfter,
      average,
      participation,
      confidence,
      rawSignal,
      effective,
    );

  const streakMultiplier =
    streakAfter.count >= 5
      ? decimal(config.streakMultipliers.fifthAndAbove)
      : streakAfter.count === 4
        ? decimal(config.streakMultipliers.fourth)
        : streakAfter.count === 3
          ? decimal(config.streakMultipliers.third)
          : decimal(1);
  const band = config.ovrBands.find(
    (candidate) =>
      beforeOvrDecimal.gte(candidate.minOvr) &&
      (candidate.maxOvrExclusive === null ||
        beforeOvrDecimal.lt(candidate.maxOvrExclusive)),
  );
  if (!band) throw new Error("No OVR band for before state");
  const positive = effective.isPositive();
  const progressionBudget = effective
    .times(config.baseOvrEquivalentScale)
    .times(positive ? band.positiveMultiplier : band.negativeMultiplier)
    .times(streakMultiplier);
  const applicableTags = positive
    ? evidence.strengthTags
    : evidence.improvementTags;
  const evaluationsWithTags = applicableTags.filter(
    (tags) => tags.length > 0,
  ).length;
  const tagCoverage = decimal(evaluationsWithTags).div(evidence.ratings.length);
  const tagCounts = Object.fromEntries(
    ATTRIBUTES.map((attribute) => [attribute, decimal(0)]),
  ) as Record<Attribute, Decimal>;
  for (const tags of applicableTags)
    for (const attribute of new Set(tags))
      tagCounts[attribute] = tagCounts[attribute].plus(1);
  const totalTags = sum(ATTRIBUTES.map((attribute) => tagCounts[attribute]));
  const tagDistributionDecimal = Object.fromEntries(
    ATTRIBUTES.map((attribute) => [
      attribute,
      totalTags.isZero() ? decimal(0) : tagCounts[attribute].div(totalTags),
    ]),
  ) as Record<Attribute, Decimal>;
  const tagBlend = Decimal.min(
    config.maxTagBlend,
    tagCoverage.times(config.maxTagBlend),
  );
  const blended = Object.fromEntries(
    ATTRIBUTES.map((attribute) => [
      attribute,
      baseDistributionDecimal[attribute]
        .times(decimal(1).minus(tagBlend))
        .plus(tagDistributionDecimal[attribute].times(tagBlend)),
    ]),
  ) as Record<Attribute, Decimal>;
  const distributionTotal = sum(
    ATTRIBUTES.map((attribute) => blended[attribute]),
  );
  const finalDistributionDecimal = Object.fromEntries(
    ATTRIBUTES.map((attribute) => [
      attribute,
      blended[attribute].div(distributionTotal),
    ]),
  ) as Record<Attribute, Decimal>;
  const difficultyCurve = positive
    ? config.positiveDifficulty
    : config.negativeDifficulty;
  const sensitivity = sum(
    ATTRIBUTES.map((attribute) =>
      decimal(weights[attribute]).times(finalDistributionDecimal[attribute]),
    ),
  );
  let deltas = Object.fromEntries(
    ATTRIBUTES.map((attribute) => {
      const candidate = progressionBudget
        .times(finalDistributionDecimal[attribute])
        .times(interpolate(difficultyCurve, beforeAttributesDecimal[attribute]))
        .div(sensitivity);
      const cap = decimal(
        positive
          ? band.maxPositiveAttributeDelta
          : band.maxNegativeAttributeDelta,
      );
      const signCapped = Decimal.max(cap.neg(), Decimal.min(cap, candidate));
      const rangeCapped = Decimal.max(
        decimal(config.attributeMin).minus(beforeAttributesDecimal[attribute]),
        Decimal.min(
          decimal(config.attributeMax).minus(
            beforeAttributesDecimal[attribute],
          ),
          signCapped,
        ),
      );
      return [attribute, rangeCapped];
    }),
  ) as Record<Attribute, Decimal>;
  const candidateAttributes = Object.fromEntries(
    ATTRIBUTES.map((attribute) => [
      attribute,
      beforeAttributesDecimal[attribute].plus(deltas[attribute]),
    ]),
  ) as Record<Attribute, Decimal>;
  const candidateOvrDelta = deriveOvr(candidateAttributes, weights).minus(
    beforeOvrDecimal,
  );
  const ovrCap = decimal(
    positive ? band.maxPositiveOvrDelta : band.maxNegativeOvrDelta,
  );
  if (candidateOvrDelta.abs().gt(ovrCap)) {
    const scale = ovrCap.div(candidateOvrDelta.abs());
    deltas = Object.fromEntries(
      ATTRIBUTES.map((attribute) => [
        attribute,
        deltas[attribute].times(scale),
      ]),
    ) as Record<Attribute, Decimal>;
  }
  const afterAttributes = Object.fromEntries(
    ATTRIBUTES.map((attribute) => [
      attribute,
      decimal(
        stored(beforeAttributesDecimal[attribute].plus(deltas[attribute])),
      ),
    ]),
  ) as Record<Attribute, Decimal>;
  const storedBeforeOvr = decimal(stored(beforeOvrDecimal));
  const afterOvr = deriveOvr(afterAttributes, weights);
  return {
    processingOutcome: "APPLIED",
    beforeAttributes: storedMap(beforeAttributesDecimal),
    afterAttributes: storedMap(afterAttributes),
    attributeDeltas: Object.fromEntries(
      ATTRIBUTES.map((attribute) => [
        attribute,
        stored(
          afterAttributes[attribute].minus(beforeAttributesDecimal[attribute]),
        ),
      ]),
    ) as Record<Attribute, string>,
    beforeOvr: storedBeforeOvr.toFixed(12),
    afterOvr: stored(afterOvr),
    ovrDelta: stored(afterOvr.minus(storedBeforeOvr)),
    evaluationsReceived: evidence.ratings.length,
    eligibleEvaluatorsForTarget: evidence.eligibleEvaluatorsForTarget,
    aggregatedRating: stored(average),
    participationRatio: stored(participation),
    confidenceMultiplier: stored(confidence),
    rawPerformanceSignal: stored(rawSignal),
    effectivePerformanceSignal: stored(effective),
    streakBefore: structuredClone(before.streak),
    streakAfter,
    streakMultiplier: stored(streakMultiplier),
    progressionBudget: stored(progressionBudget),
    baseDistribution: distributionToStored(baseDistributionDecimal),
    tagCoverage: stored(tagCoverage),
    tagDistribution: distributionToStored(tagDistributionDecimal),
    finalDistribution: distributionToStored(finalDistributionDecimal),
  };
}

export function initialPerformanceState(): ProgressionState {
  return {
    attributes: Object.fromEntries(
      ATTRIBUTES.map((attribute) => [attribute, stored(60)]),
    ) as Record<Attribute, string>,
    ratingProfile: "LIBRE",
    streak: { direction: "NONE", count: 0 },
  };
}
