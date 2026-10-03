import {
  V4GroupCrest,
  V4Portrait,
  V4RewardBadge,
} from "@/components/visual-v4/profile-assets";

import type { NotificationItem } from "./notification-copy";
import styles from "./notification-visual.module.css";

export type NotificationVisualKind = "player" | "group" | "match" | "reward";

export function notificationVisualKind(
  type: NotificationItem["type"],
): NotificationVisualKind {
  if (type === "CONNECTION_REQUESTED" || type === "CONNECTION_ACCEPTED")
    return "player";
  if (
    type === "GROUP_INVITATION_RECEIVED" ||
    type === "GROUP_MODERATOR_GRANTED" ||
    type === "GROUP_MODERATOR_REMOVED"
  )
    return "group";
  if (
    type === "ACHIEVEMENT_EARNED" ||
    type === "AWARD_EARNED" ||
    type === "PROGRESSION_AVAILABLE"
  )
    return "reward";
  return "match";
}

export function NotificationVisual({
  compact = false,
  item,
}: Readonly<{ compact?: boolean; item: NotificationItem }>) {
  const kind = notificationVisualKind(item.type);
  return (
    <span
      aria-hidden="true"
      className={`${styles.visual} ${compact ? styles.compact : ""}`}
      data-kind={kind}
    >
      <span className={styles.scene} />
      {kind === "player" ? (
        <V4Portrait name={`${item.body} ${item.id}`} />
      ) : null}
      {kind === "group" || kind === "match" ? (
        <V4GroupCrest name={item.title} seed={item.id} size="compact" />
      ) : null}
      {kind === "reward" ? (
        <V4RewardBadge label={item.title} seed={`${item.type}-${item.id}`} />
      ) : null}
      {kind === "match" ? <small>F5</small> : null}
    </span>
  );
}
