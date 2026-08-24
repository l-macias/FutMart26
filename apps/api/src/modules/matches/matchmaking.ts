import { Decimal } from "decimal.js";

export const MATCHMAKING_V1_ALGORITHM = "f5-lexicographic-v1";
export const MATCHMAKING_V1_CONFIG = {
  algorithmVersion: MATCHMAKING_V1_ALGORITHM,
  maxParticipants: 12,
  defaultInternalOvr: "60.000000000000",
} as const;

export type MatchmakingParticipant = {
  participantId: string;
  internalOvr: string;
  ratingProfile: "LIBRE" | "DEFENSIVO" | "MEDIO" | "OFENSIVO";
  willingToPlayGoalkeeper: boolean;
};

export type MatchmakingDiagnostic =
  "BALANCED" | "INCOMPLETE_KEEPER_COVERAGE" | "NO_KEEPER_COVERAGE";

type Side = "TEAM_A" | "TEAM_B";

type Candidate = {
  assignments: { participantId: string; side: Side }[];
  score: readonly [number, number, Decimal, number, string];
};

export function proposeMatchTeams(
  participants: MatchmakingParticipant[],
  config: typeof MATCHMAKING_V1_CONFIG = MATCHMAKING_V1_CONFIG,
) {
  if (participants.length === 0) return emptyProposal(config);
  if (participants.length > config.maxParticipants)
    throw new Error("Matchmaking roster exceeds the V1 bound");
  const ordered = [...participants].sort((a, b) =>
    a.participantId.localeCompare(b.participantId),
  );
  const sizeA = Math.ceil(ordered.length / 2);
  let best: Candidate | undefined;
  for (const indexes of combinations(ordered.length, sizeA)) {
    const inA = new Set(indexes);
    const teamA = ordered.filter((_, index) => inA.has(index));
    const teamB = ordered.filter((_, index) => !inA.has(index));
    const candidate = scoreCandidate(teamA, teamB);
    if (!best || compareScore(candidate.score, best.score) < 0)
      best = candidate;
  }
  const keepers = ordered.filter(
    (participant) => participant.willingToPlayGoalkeeper,
  );
  return {
    assignments: best!.assignments,
    diagnostics: [
      keepers.length === 0
        ? "NO_KEEPER_COVERAGE"
        : keepers.length === 1
          ? "INCOMPLETE_KEEPER_COVERAGE"
          : "BALANCED",
    ] satisfies MatchmakingDiagnostic[],
    algorithmVersion: config.algorithmVersion,
  };
}

function emptyProposal(config: typeof MATCHMAKING_V1_CONFIG) {
  return {
    assignments: [] as { participantId: string; side: Side }[],
    diagnostics: ["NO_KEEPER_COVERAGE"] as MatchmakingDiagnostic[],
    algorithmVersion: config.algorithmVersion,
  };
}

function scoreCandidate(
  teamA: MatchmakingParticipant[],
  teamB: MatchmakingParticipant[],
): Candidate {
  const keepersA = teamA.filter((item) => item.willingToPlayGoalkeeper).length;
  const keepersB = teamB.filter((item) => item.willingToPlayGoalkeeper).length;
  const totalKeepers = keepersA + keepersB;
  const keeperPenalty =
    totalKeepers >= 2
      ? Number(keepersA === 0) + Number(keepersB === 0)
      : totalKeepers === 1
        ? Number(keepersA + keepersB !== 1)
        : 0;
  const averageA = average(teamA);
  const averageB = average(teamB);
  const smallerUnderpowered =
    teamA.length === teamB.length
      ? 0
      : teamA.length < teamB.length
        ? Number(averageA.lessThan(averageB))
        : Number(averageB.lessThan(averageA));
  const averageDifference = averageA.minus(averageB).abs();
  const roleDifference = rolePenalty(teamA, teamB);
  const tieBreak = teamA.map((item) => item.participantId).join(":");
  return {
    assignments: [
      ...teamA.map((item) => ({
        participantId: item.participantId,
        side: "TEAM_A" as const,
      })),
      ...teamB.map((item) => ({
        participantId: item.participantId,
        side: "TEAM_B" as const,
      })),
    ],
    score: [
      keeperPenalty,
      smallerUnderpowered,
      averageDifference,
      roleDifference,
      tieBreak,
    ],
  };
}

function average(team: MatchmakingParticipant[]) {
  if (team.length === 0) return new Decimal(0);
  return team
    .reduce((sum, item) => sum.plus(item.internalOvr), new Decimal(0))
    .dividedBy(team.length);
}

function rolePenalty(a: MatchmakingParticipant[], b: MatchmakingParticipant[]) {
  const profiles: MatchmakingParticipant["ratingProfile"][] = [
    "DEFENSIVO",
    "MEDIO",
    "OFENSIVO",
    "LIBRE",
  ];
  return profiles.reduce(
    (penalty, profile) =>
      penalty +
      Math.abs(
        a.filter((item) => item.ratingProfile === profile).length -
          b.filter((item) => item.ratingProfile === profile).length,
      ),
    0,
  );
}

function compareScore(a: Candidate["score"], b: Candidate["score"]) {
  const keeperDifference = a[0] - b[0];
  if (keeperDifference !== 0) return keeperDifference;
  const smallerSideDifference = a[1] - b[1];
  if (smallerSideDifference !== 0) return smallerSideDifference;
  const averageDifference = a[2].cmp(b[2]);
  if (averageDifference !== 0) return averageDifference;
  const roleDifference = a[3] - b[3];
  if (roleDifference !== 0) return roleDifference;
  return a[4].localeCompare(b[4]);
}

function* combinations(total: number, choose: number) {
  function* visit(start: number, selected: number[]): Generator<number[]> {
    if (selected.length === choose) {
      yield selected;
      return;
    }
    for (
      let index = start;
      index <= total - (choose - selected.length);
      index += 1
    )
      yield* visit(index + 1, [...selected, index]);
  }
  yield* visit(0, []);
}
