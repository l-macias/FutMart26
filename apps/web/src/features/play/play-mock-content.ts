// UX-only fixture: these labels and shapes are not application or domain contracts.
export const playMockContent = {
  pendingActions: {
    voting: {
      eyebrow: "Votación abierta",
      title: "Los del viernes",
      detail: "Tenés hasta las 14:20 para votar.",
    },
    results: {
      eyebrow: "Resultados listos",
      title: "Los del martes",
      detail: "Tu progreso del último partido ya está disponible.",
    },
    promotion: {
      eyebrow: "Estás adentro",
      detail: "Pasaste de suplente a confirmado para el domingo.",
    },
  },
  upcomingMatches: [
    {
      time: "Vie 21:00",
      name: "Fútbol oficina",
      state: "Confirmado",
      tone: "positive",
    },
    {
      time: "Dom 18:30",
      name: "Los pibes",
      state: "Suplente #2",
      tone: "warning",
    },
    {
      time: "Mar 20:00",
      name: "Los del martes",
      state: "Abierto",
      tone: "neutral",
    },
  ],
} as const;
