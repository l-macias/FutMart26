// Visual-only fixture: this shape is not an application or domain contract.
export const homeMockContent = {
  ranking: [
    { name: "Martín", overall: 87 },
    { name: "Nico", overall: 82 },
    { name: "Juan", overall: 80 },
    { name: "Tomi", overall: 79 },
    { name: "Lucas", overall: 74 },
  ],
  rising: [
    { name: "Juan", delta: "+6 OVR", period: "Últimos 4 partidos" },
    { name: "Sofi", delta: "+4 OVR", period: "Últimos 3 partidos" },
  ],
  activity: [
    { value: "243", label: "Partidos" },
    { value: "1.842", label: "Goles" },
    { value: "37", label: "Nuevas cards" },
  ],
  milestones: [
    { mark: "Gold", detail: "Martín alcanzó 80 OVR" },
    { mark: "Personal best", detail: "Lucas llegó a 74 OVR" },
    { mark: "Silver", detail: "Nico alcanzó 70" },
  ],
} as const;
