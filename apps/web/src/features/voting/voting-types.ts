export type VotingParticipantView = {
  id: string;
  name: string;
  guest?: boolean;
};

export const votingAttributes = [
  "Pase",
  "Regate",
  "Remate",
  "Defensa",
  "Velocidad",
  "Físico",
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

export const votingAttributeToApi = {
  Pase: "PASE",
  Regate: "REGATE",
  Remate: "REMATE",
  Defensa: "DEFENSA",
  Velocidad: "VELOCIDAD",
  Físico: "FISICO",
} as const;
