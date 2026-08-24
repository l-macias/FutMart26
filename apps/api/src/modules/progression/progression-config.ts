import { z } from "zod";

export const ATTRIBUTES = [
  "VELOCIDAD",
  "PASE",
  "REGATE",
  "REMATE",
  "DEFENSA",
  "FISICO",
] as const;
export const RATING_PROFILES = [
  "LIBRE",
  "DEFENSIVO",
  "MEDIO",
  "OFENSIVO",
] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
export type RatingProfile = (typeof RATING_PROFILES)[number];

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/);
const point = z.tuple([decimalString, decimalString]);
const attributeMap = z.object(
  Object.fromEntries(
    ATTRIBUTES.map((attribute) => [attribute, decimalString]),
  ) as Record<Attribute, typeof decimalString>,
);
const band = z.object({
  minOvr: decimalString,
  maxOvrExclusive: decimalString.nullable(),
  positiveMultiplier: decimalString,
  negativeMultiplier: decimalString,
  maxPositiveOvrDelta: decimalString,
  maxNegativeOvrDelta: decimalString,
  maxPositiveAttributeDelta: decimalString,
  maxNegativeAttributeDelta: decimalString,
});

export const progressionConfigSchema = z
  .object({
    model: z.literal("F5_PROGRESSION_V1"),
    calculationPrecision: z.literal(40),
    storageScale: z.literal(12),
    rounding: z.literal("ROUND_HALF_UP"),
    attributes: z.tuple([
      z.literal("VELOCIDAD"),
      z.literal("PASE"),
      z.literal("REGATE"),
      z.literal("REMATE"),
      z.literal("DEFENSA"),
      z.literal("FISICO"),
    ]),
    attributeMin: decimalString,
    attributeMax: decimalString,
    ratingCurve: z.array(point).min(2),
    confidenceCurve: z.array(point).min(2),
    ovrBands: z.array(band).min(1),
    positiveStreakThreshold: decimalString,
    negativeStreakThreshold: decimalString,
    streakMultipliers: z.object({
      third: decimalString,
      fourth: decimalString,
      fifthAndAbove: decimalString,
    }),
    baseOvrEquivalentScale: decimalString,
    maxTagBlend: decimalString,
    positiveDifficulty: z.array(point).min(2),
    negativeDifficulty: z.array(point).min(2),
    profileWeights: z.object(
      Object.fromEntries(
        RATING_PROFILES.map((profile) => [profile, attributeMap]),
      ) as Record<RatingProfile, typeof attributeMap>,
    ),
  })
  .superRefine((config, context) => {
    for (const [name, points] of [
      ["ratingCurve", config.ratingCurve],
      ["confidenceCurve", config.confidenceCurve],
      ["positiveDifficulty", config.positiveDifficulty],
      ["negativeDifficulty", config.negativeDifficulty],
    ] as const) {
      for (let index = 1; index < points.length; index += 1)
        if (Number(points[index]![0]) <= Number(points[index - 1]![0]))
          context.addIssue({
            code: "custom",
            message: `${name} inputs must be strictly increasing`,
          });
    }
    for (const profile of RATING_PROFILES) {
      const total = ATTRIBUTES.reduce(
        (sum, attribute) =>
          sum + Number(config.profileWeights[profile][attribute]),
        0,
      );
      if (Math.abs(total - 1) > 0.0000001)
        context.addIssue({
          code: "custom",
          message: `${profile} weights must sum to 1`,
        });
    }
    for (let index = 1; index < config.ovrBands.length; index += 1)
      if (
        config.ovrBands[index - 1]!.maxOvrExclusive !==
        config.ovrBands[index]!.minOvr
      )
        context.addIssue({
          code: "custom",
          message: "OVR bands must be contiguous",
        });
  });

export type ProgressionConfig = z.infer<typeof progressionConfigSchema>;

const weights = (values: string[]) =>
  Object.fromEntries(
    ATTRIBUTES.map((attribute, index) => [attribute, values[index]!]),
  ) as Record<Attribute, string>;

export const PROGRESSION_V1_1_VERSION = "f5-v1.1";
export const PROGRESSION_V1_1_CONFIG: ProgressionConfig =
  progressionConfigSchema.parse({
    model: "F5_PROGRESSION_V1",
    calculationPrecision: 40,
    storageScale: 12,
    rounding: "ROUND_HALF_UP",
    attributes: ATTRIBUTES,
    attributeMin: "1",
    attributeMax: "99",
    ratingCurve: [
      ["1", "-1"],
      ["2", "-0.9"],
      ["3", "-0.75"],
      ["4", "-0.5"],
      ["5", "-0.2"],
      ["6", "0"],
      ["7", "0.2"],
      ["8", "0.5"],
      ["9", "0.8"],
      ["10", "1"],
    ],
    confidenceCurve: [
      ["0", "0"],
      ["0.125", "0.05"],
      ["0.25", "0.20"],
      ["0.50", "0.65"],
      ["0.75", "1.00"],
      ["1", "1.20"],
    ],
    ovrBands: [
      {
        minOvr: "1",
        maxOvrExclusive: "70",
        positiveMultiplier: "1.40",
        negativeMultiplier: "0.60",
        maxPositiveOvrDelta: "1.20",
        maxNegativeOvrDelta: "0.60",
        maxPositiveAttributeDelta: "1.50",
        maxNegativeAttributeDelta: "0.80",
      },
      {
        minOvr: "70",
        maxOvrExclusive: "80",
        positiveMultiplier: "1.10",
        negativeMultiplier: "0.80",
        maxPositiveOvrDelta: "0.90",
        maxNegativeOvrDelta: "0.70",
        maxPositiveAttributeDelta: "1.20",
        maxNegativeAttributeDelta: "0.90",
      },
      {
        minOvr: "80",
        maxOvrExclusive: "90",
        positiveMultiplier: "0.80",
        negativeMultiplier: "0.80",
        maxPositiveOvrDelta: "0.60",
        maxNegativeOvrDelta: "0.70",
        maxPositiveAttributeDelta: "0.90",
        maxNegativeAttributeDelta: "0.90",
      },
      {
        minOvr: "90",
        maxOvrExclusive: null,
        positiveMultiplier: "0.45",
        negativeMultiplier: "0.80",
        maxPositiveOvrDelta: "0.35",
        maxNegativeOvrDelta: "0.70",
        maxPositiveAttributeDelta: "0.60",
        maxNegativeAttributeDelta: "0.90",
      },
    ],
    positiveStreakThreshold: "0.35",
    negativeStreakThreshold: "-0.35",
    streakMultipliers: { third: "1.10", fourth: "1.15", fifthAndAbove: "1.20" },
    baseOvrEquivalentScale: "0.80",
    maxTagBlend: "0.50",
    positiveDifficulty: [
      ["1", "1"],
      ["69", "1"],
      ["79", "0.85"],
      ["89", "0.65"],
      ["94", "0.40"],
      ["99", "0.20"],
    ],
    negativeDifficulty: [
      ["1", "0.35"],
      ["60", "0.55"],
      ["70", "0.70"],
      ["80", "0.85"],
      ["90", "1"],
      ["99", "1"],
    ],
    profileWeights: {
      LIBRE: weights([
        "0.166667",
        "0.166667",
        "0.166667",
        "0.166667",
        "0.166666",
        "0.166666",
      ]),
      DEFENSIVO: weights(["0.15", "0.18", "0.10", "0.07", "0.30", "0.20"]),
      MEDIO: weights(["0.15", "0.25", "0.20", "0.12", "0.18", "0.10"]),
      OFENSIVO: weights(["0.20", "0.12", "0.25", "0.25", "0.06", "0.12"]),
    },
  });
