/** UX fixture for Profile + Card Mock v1. This is not a domain or API contract. */
export const profileMock = {
  achievements: [
    { label: "Primer partido", status: "earned" },
    { label: "10 partidos", status: "earned" },
    { label: "10 goles", status: "earned" },
    { label: "25 partidos", status: "locked" },
  ],
  attributes: [
    { code: "VEL", label: "Velocidad", value: 80 },
    { code: "PAS", label: "Pase", value: 72 },
    { code: "REG", label: "Regate", value: 76 },
    { code: "REM", label: "Remate", value: 73 },
    { code: "DEF", label: "Defensa", value: 62 },
    { code: "FIS", label: "Físico", value: 69 },
  ],
  awards: ["Figura", "Máquina de goles"],
  currentFocus: "Defensa",
  discipline: "F5",
  groups: [
    { matches: 10, name: "Los del martes" },
    { matches: 5, name: "Fútbol oficina" },
    { matches: 3, name: "Los pibes" },
  ],
  lastMatch: "Hace 2 días",
  name: "Lucas",
  overall: 74,
  personalBest: 74,
  progression: [
    { date: "03 Jun", detail: "60 OVR", label: "Comenzaste" },
    { date: "18 Jun", detail: "70 OVR", label: "Silver" },
    { date: "02 Jul", detail: "72 OVR", label: "Personal best" },
    { date: "10 Ago", detail: "74 OVR", label: "Personal best" },
  ],
  recentRating: "8.1",
  stats: { assists: 9, goals: 12, matches: 18 },
  strengths: ["Velocidad", "Regate", "Pase"],
  tier: "Silver",
} as const;
