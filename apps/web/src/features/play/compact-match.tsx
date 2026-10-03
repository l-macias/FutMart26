import Link from "next/link";

import type { PersonalMatch } from "@football/contracts";
import { MatchStateMark } from "@football/football-ui";
import { Text } from "@football/ui";

import { V4GroupCrest } from "@/components/visual-v4/profile-assets";

import styles from "./compact-match.module.css";

export function CompactMatch({ match }: Readonly<{ match: PersonalMatch }>) {
  const date = new Date(match.scheduledAt);
  const location = [
    match.venue?.displayName ?? match.locationText,
    match.court?.displayName,
    match.venue?.city,
  ]
    .filter(Boolean)
    .join(" · ");
  const missing = Math.max(match.capacity - match.confirmedCount, 0);
  const current = match.effectivePhase === "IN_PROGRESS";

  return (
    <article className={styles.match} aria-labelledby="play-feature-title">
      <img
        alt=""
        className={styles.scene}
        src="/fifar-v4/match-scenes/home-feature-night.webp"
      />
      <span className={styles.atmosphere} aria-hidden="true" />

      <header className={styles.topline}>
        <span>{current ? "PARTIDO EN JUEGO" : "TU PRÓXIMO PARTIDO"}</span>
        <time dateTime={match.scheduledAt}>{formatMatchDate(date)}</time>
      </header>

      <div className={styles.identity}>
        <div className={styles.crestStage}>
          <V4GroupCrest
            name={match.group.name}
            seed={match.group.id}
            size="large"
          />
          <span aria-hidden="true">F5</span>
        </div>
        <div className={styles.heading}>
          <Text tone="accent" variant="label">
            {current ? "AHORA" : formatLongDay(date)}
          </Text>
          <Text as="h2" id="play-feature-title" variant="display-lg">
            {match.group.name}
          </Text>
          <strong className={styles.kickoff}>{formatKickoff(date)} HS</strong>
          <Text className={styles.location} tone="muted" variant="metadata">
            {location || "Ubicación a confirmar"}
          </Text>
        </div>
      </div>

      <footer className={styles.statusDeck}>
        <div className={styles.capacity}>
          <small>CUPO</small>
          <strong>
            {match.confirmedCount}
            <span>/{match.capacity}</span>
          </strong>
        </div>
        <div className={styles.matchState}>
          <small>ESTADO</small>
          <strong>{missing === 0 ? "COMPLETO" : `FALTAN ${missing}`}</strong>
        </div>
        {match.participation ? (
          <MatchStateMark
            tone={
              match.participation.status === "CONFIRMED"
                ? "positive"
                : "warning"
            }
          >
            {match.participation.status === "CONFIRMED"
              ? "ESTÁS ANOTADO"
              : `EN ESPERA${match.participation.waitlistPosition ? ` · #${match.participation.waitlistPosition}` : ""}`}
          </MatchStateMark>
        ) : null}
        <Link
          className={`${styles.action} ui-button ui-button--primary`}
          href={`/play/matches/${match.id}`}
        >
          VER PARTIDO <span aria-hidden="true">→</span>
        </Link>
      </footer>
    </article>
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

function formatLongDay(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(date)
    .toUpperCase();
}

function formatKickoff(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
