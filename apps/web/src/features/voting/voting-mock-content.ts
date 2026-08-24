/** UX fixture for Voting Mock v1. This is not a domain or API contract. */
// Tags are raw UX evidence. They do not imply direct attribute deltas.
export type VotingParticipantView = {
  id: string;
  name: string;
  guest?: boolean;
};

export const votingParticipants = [
  { id: "martin", name: "Martín" },
  { id: "nico", name: "Nico" },
  { id: "juan", name: "Juan" },
  { id: "sofi", name: "Sofi" },
  { id: "tomi", name: "Tomi" },
  { id: "fede", name: "Fede" },
  { id: "lean", name: "Lean" },
  { id: "diego", name: "Diego", guest: true },
  { id: "pablo", name: "Pablo" },
] as const satisfies readonly VotingParticipantView[];

export const votingAttributes = [
  "Pase",
  "Regate",
  "Remate",
  "Defensa",
  "Velocidad",
  "Físico",
  "Visión",
] as const;

export type VotingAttribute = (typeof votingAttributes)[number];

export type EvaluationDraft = {
  rating?: number;
  strengths: VotingAttribute[];
  improvements: VotingAttribute[];
  skipped: boolean;
};

export function emptyEvaluation(): EvaluationDraft {
  return { improvements: [], skipped: false, strengths: [] };
}
