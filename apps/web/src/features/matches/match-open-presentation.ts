import type { EffectiveMatchPhase } from "@football/contracts";

type RecruitmentEffectiveStatus = "CLOSED" | "OPEN" | "FULL";

export function canShowJoinAction(
  phase: EffectiveMatchPhase,
  hasCurrentParticipation: boolean,
) {
  return phase === "OPEN" && !hasCurrentParticipation;
}

export function matchJoinLabel(status: RecruitmentEffectiveStatus) {
  return status === "FULL" ? "Sumarme a la lista de espera" : "Anotarme";
}

export function matchRecruitmentCopy(status: RecruitmentEffectiveStatus) {
  if (status === "OPEN") return "Búsqueda de jugadores activa";
  if (status === "FULL") return "Cupo completo · lista de espera disponible";
  return "Búsqueda de jugadores pausada";
}

export function matchRecruitmentStripCopy(status: RecruitmentEffectiveStatus) {
  if (status === "OPEN") return "ACTIVA";
  if (status === "FULL") return "COMPLETA";
  return "PAUSADA";
}
