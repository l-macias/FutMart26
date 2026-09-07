import type { NotificationListResponse } from "@football/contracts";

export type NotificationItem = NotificationListResponse["items"][number];

export function notificationEventLabel(type: NotificationItem["type"]) {
  return {
    VOTING_AVAILABLE: "Votación",
    PROGRESSION_AVAILABLE: "Progresión",
    MATCH_CANCELLED: "Partido",
    ACHIEVEMENT_EARNED: "Logro",
    AWARD_EARNED: "Premio",
    CONNECTION_REQUESTED: "Conexión",
    CONNECTION_ACCEPTED: "Conexión",
    GROUP_INVITATION_RECEIVED: "Invitación",
    MATCH_INVITATION_RECEIVED: "Invitación",
    GROUP_MODERATOR_GRANTED: "Grupo",
    GROUP_MODERATOR_REMOVED: "Grupo",
  }[type];
}

export function formatNotificationTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
