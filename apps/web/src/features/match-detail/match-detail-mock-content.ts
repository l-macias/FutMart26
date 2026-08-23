// UX fixture only: these shapes are not future Match, Player, or Team contracts.
export const matchDetailMockContent = {
  confirmed: [
    { name: "Lucas", initials: "LU", role: "Ofensivo" },
    { name: "Martín", initials: "MA", role: "Mixto" },
    { name: "Nico", initials: "NI", role: "Defensivo" },
    { name: "Juan", initials: "JU", role: "Arquero" },
    { name: "Sofi", initials: "SO", role: "Mixto" },
    { name: "Tomi", initials: "TO", role: "Ofensivo" },
    { name: "Fede", initials: "FE", role: "Defensivo" },
    { name: "Lean", initials: "LE", role: "Libre" },
  ],
  waitlist: [
    { order: "#1", name: "Pablo" },
    { order: "#2", name: "Mati" },
  ],
  guest: { name: "Diego", initials: "DI" },
  teams: [
    {
      name: "Equipo A",
      members: [
        { name: "Juan", position: "ARQ" },
        { name: "Nico", position: "DEF" },
        { name: "Lucas", position: "ATA" },
        { name: "Sofi", position: "MIX" },
      ],
    },
    {
      name: "Equipo B",
      members: [
        { name: "Guest Diego", position: "ARQ · Puede atajar" },
        { name: "Fede", position: "DEF" },
        { name: "Tomi", position: "ATA" },
        { name: "Lean", position: "Libre" },
      ],
    },
  ],
  lifecycle: [
    "Convocatoria",
    "Partido",
    "Confirmar jugadores",
    "Votación",
    "Resultados",
  ],
} as const;
