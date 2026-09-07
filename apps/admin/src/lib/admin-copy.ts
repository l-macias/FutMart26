const reportReasonCopy: Record<string, string> = {
  HARASSMENT: "Acoso",
  INAPPROPRIATE_CONTENT: "Contenido inapropiado",
  IMPERSONATION: "Suplantación",
  SPAM: "Spam",
  SAFETY: "Seguridad",
  OTHER: "Otro",
};

const auditActionCopy: Record<string, string> = {
  ACCOUNT_SUSPENDED: "Cuenta suspendida",
  ACCOUNT_REACTIVATED: "Cuenta reactivada",
  PLAYER_NAME_MODERATED: "Nombre de jugador moderado",
  PLAYER_AVATAR_REMOVED: "Foto de jugador eliminada",
  GROUP_FORCED_PRIVATE: "Grupo convertido en privado",
  GROUP_NAME_MODERATED: "Nombre de grupo moderado",
  GROUP_ARCHIVED: "Grupo archivado",
  REPORT_RESOLVED: "Reporte resuelto",
  REPORT_DISMISSED: "Reporte descartado",
  BALLOT_VOIDED: "Boleta anulada",
  INVITATION_REVOKED: "Invitación revocada",
  MATCH_CANCELLED_BY_ADMIN: "Partido cancelado por administración",
};

const targetTypeCopy: Record<string, string> = {
  ACCOUNT: "Cuenta",
  PLAYER: "Jugador",
  GROUP: "Grupo",
  MATCH: "Partido",
  REPORT: "Reporte",
  BALLOT: "Boleta",
  INVITATION: "Invitación",
};

export function reportReasonLabel(value: string) {
  return reportReasonCopy[value] ?? "Motivo no disponible";
}

export function auditActionLabel(value: string) {
  return auditActionCopy[value] ?? "Acción administrativa";
}

export function targetTypeLabel(value: string) {
  return targetTypeCopy[value] ?? "Entidad";
}
