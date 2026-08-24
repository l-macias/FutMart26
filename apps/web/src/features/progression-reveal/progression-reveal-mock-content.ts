/** UX fixture for Progression Reveal Mock v1. This is not a domain or API contract. */
export const progressionScenarios = {
  normal: {
    attributes: [
      { after: 80, before: 78, delta: 2, label: "Velocidad" },
      { after: 72, before: 71, delta: 1, label: "Pase" },
      { after: 76, before: 75, delta: 1, label: "Regate" },
      { after: 62, before: 63, delta: -1, label: "Defensa" },
      { after: 69, before: 69, delta: 0, label: "Físico" },
    ],
    improvements: ["Defensa"],
    matchRating: "8.4",
    overall: { after: 74, before: 72, delta: 2 },
    strengths: ["Velocidad", "Regate", "Pase"],
  },
  tier: {
    matchRating: "8.4",
    overall: { after: 71, before: 69, delta: 2 },
    tier: { after: "Silver", before: "Bronze" },
  },
} as const;

export const progressionContext = {
  discipline: "F5",
  match: "Los del martes",
  player: "Lucas",
} as const;
