import Link from "next/link";

import type { PersonalMatch } from "@football/contracts";
import { MatchStateMark } from "@football/football-ui";
import { Surface, Text } from "@football/ui";

import styles from "./compact-match.module.css";

export function CompactMatch({ match }: Readonly<{ match: PersonalMatch }>) {
  const location = [
    match.venue?.displayName ?? match.locationText,
    match.court?.displayName,
    match.venue?.city,
  ]
    .filter(Boolean)
    .join(" · ");
  const missing = Math.max(match.capacity - match.confirmedCount, 0);

  return (
    <Surface as="section" className={styles.match} elevation="feature">
      <div className={styles.topline}>
        <Text as="span" tone="accent" variant="label">
          {match.effectivePhase === "IN_PROGRESS"
            ? "EN JUEGO"
            : "PRÓXIMO PARTIDO"}
        </Text>
        {match.participation ? (
          <MatchStateMark
            tone={
              match.participation.status === "CONFIRMED"
                ? "positive"
                : "warning"
            }
          >
            {match.participation.status === "CONFIRMED"
              ? "Estás anotado"
              : `En espera${match.participation.waitlistPosition ? ` · #${match.participation.waitlistPosition}` : ""}`}
          </MatchStateMark>
        ) : null}
      </div>

      <div className={styles.heading}>
        <Text as="h2" className={styles.group} variant="display-lg">
          {match.group.name}
        </Text>
        <Text as="p" className={styles.date} variant="heading-lg">
          {formatMatchDate(new Date(match.scheduledAt))}
        </Text>
        <Text tone="muted" variant="metadata">
          {location || "Ubicación a confirmar"}
        </Text>
      </div>

      <div className={styles.status}>
        <div className={styles.capacity}>
          <strong>
            {match.confirmedCount} / {match.capacity}
          </strong>
          <span>JUGADORES</span>
        </div>
        <span className={missing === 0 ? styles.complete : styles.missing}>
          {missing === 0 ? "COMPLETO" : `FALTAN ${missing}`}
        </span>
      </div>

      <Link
        className={`${styles.action} ui-button ui-button--primary`}
        href={`/play/matches/${match.id}`}
      >
        VER PARTIDO <span aria-hidden="true">→</span>
      </Link>
    </Surface>
  );
}

export function formatMatchDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
