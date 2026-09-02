import type { ProgressionHistoryEntry } from "@football/contracts";
import type { progressionSnapshots } from "@football/database/schema";

type SnapshotReadModel = ProgressionHistoryEntry["snapshot"];

export function progressionSnapshotReadModel(
  snapshot: typeof progressionSnapshots.$inferSelect,
  configVersion: string,
): SnapshotReadModel {
  return {
    processingOutcome: snapshot.processingOutcome,
    processedAt: snapshot.processedAt.toISOString(),
    configVersion,
    aggregatedRating: snapshot.aggregatedRating,
    eligibleEvaluationCount: snapshot.eligibleEvaluatorsForTarget,
    receivedEvaluationCount: snapshot.evaluationsReceived,
    participationRatio: snapshot.participationRatio,
    confidenceMultiplier: snapshot.confidenceMultiplier,
    overall: {
      before: snapshot.beforeOvr,
      after: snapshot.afterOvr,
      delta: snapshot.ovrDelta,
    },
    attributes: {
      before: attributes(snapshot.beforeAttributes),
      after: attributes(snapshot.afterAttributes),
      delta: attributes(snapshot.attributeDeltas),
    },
    streak: {
      before: streak(snapshot.streakBefore),
      after: streak(snapshot.streakAfter),
    },
  };
}

function attributes(value: Record<string, string>) {
  const keys = [
    "VELOCIDAD",
    "PASE",
    "REGATE",
    "REMATE",
    "DEFENSA",
    "FISICO",
  ] as const;
  return Object.fromEntries(
    keys.map((key) => {
      const attribute = value[key];
      if (attribute === undefined)
        throw new Error(`Progression snapshot is missing ${key}`);
      return [key, attribute];
    }),
  ) as Record<(typeof keys)[number], string>;
}

function streak(value: { direction: string; count: number }) {
  if (!["POSITIVE", "NEGATIVE", "NONE"].includes(value.direction))
    throw new Error("Progression snapshot has invalid streak");
  return value as {
    direction: "POSITIVE" | "NEGATIVE" | "NONE";
    count: number;
  };
}
