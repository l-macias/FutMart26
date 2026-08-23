import Link from "next/link";

import { MatchStateMark } from "@football/football-ui";
import { Button, Surface, Text } from "@football/ui";

import styles from "./play.module.css";

export function NextMatchPanel() {
  return (
    <Surface as="section" className={styles.nextMatch} elevation="raised">
      <span aria-hidden="true" className={styles.pitchStripe} />
      <div className={styles.matchHeading}>
        <Text as="span" tone="accent" variant="label">
          Próximo partido
        </Text>
        <Text as="p" className={styles.matchTime} variant="display-lg">
          Martes · 20:00
        </Text>
        <Text as="h2" variant="heading-lg">
          Los del martes
        </Text>
        <Text tone="muted" variant="metadata">
          F5 · 60 min · Rosario
        </Text>
      </div>

      <div className={styles.registrationState}>
        <Text as="span" variant="heading-md">
          8 / 10
        </Text>
        <MatchStateMark tone="positive">Confirmado</MatchStateMark>
      </div>

      <div className={styles.matchActions}>
        <Link className={styles.primaryLink} href="/play/match-demo">
          Ver partido <span aria-hidden="true">→</span>
        </Link>
        <Button
          disabled
          title="Acción no disponible en este mock"
          variant="secondary"
        >
          Bajarme
        </Button>
      </div>
    </Surface>
  );
}
