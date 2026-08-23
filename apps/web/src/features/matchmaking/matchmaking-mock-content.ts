// UX mock only: these roles, players, teams and scores are not domain contracts.
export const mockRoles = ["ARQ", "DEF", "MIX", "ATA", "LIBRE"] as const;

export type MockRole = (typeof mockRoles)[number];

export interface MockPlayer {
  canKeep?: boolean;
  guest?: boolean;
  id: string;
  name: string;
  role: MockRole;
}

export interface MockComposition {
  balance: string;
  balanceMessage: string;
  label: string;
  teams: [MockPlayer[], MockPlayer[]];
  warnings: readonly string[];
}

const players = {
  juan: { id: "juan", name: "Juan", role: "ARQ" },
  nico: { id: "nico", name: "Nico", role: "DEF" },
  lucas: { id: "lucas", name: "Lucas", role: "ATA" },
  sofi: { id: "sofi", name: "Sofi", role: "MIX" },
  fede: { id: "fede", name: "Fede", role: "DEF" },
  tomi: { id: "tomi", name: "Tomi", role: "ATA" },
  lean: { id: "lean", name: "Lean", role: "LIBRE" },
  mati: { id: "mati", name: "Mati", role: "MIX" },
  diego: {
    id: "diego",
    name: "Diego",
    role: "ARQ",
    guest: true,
    canKeep: true,
  },
} satisfies Record<string, MockPlayer>;

export const mockProposals = [
  {
    label: "Propuesta automática",
    balance: "94%",
    balanceMessage: "Equipos parejos",
    warnings: [],
    teams: [
      [players.juan, players.nico, players.lucas, players.sofi],
      [players.diego, players.fede, players.tomi, players.lean],
    ],
  },
  {
    label: "Propuesta automática",
    balance: "91%",
    balanceMessage: "Equipos parejos",
    warnings: [],
    teams: [
      [players.juan, players.fede, players.tomi, players.sofi],
      [players.diego, players.nico, players.lucas, players.lean],
    ],
  },
] satisfies readonly MockComposition[];

export const fiveVsFourMock = {
  label: "Propuesta automática · Escenario 5 vs 4",
  balance: "68%",
  balanceMessage: "Revisar balance",
  warnings: ["Equipo A · Sin arquero definido", "Revisar balance"],
  teams: [
    [players.nico, players.lucas, players.sofi, players.tomi, players.mati],
    [players.diego, players.juan, players.fede, players.lean],
  ],
} satisfies MockComposition;

export function cloneMockComposition(
  composition: MockComposition,
): MockComposition {
  return {
    ...composition,
    teams: [
      composition.teams[0].map((player) => ({ ...player })),
      composition.teams[1].map((player) => ({ ...player })),
    ],
    warnings: [...composition.warnings],
  };
}
