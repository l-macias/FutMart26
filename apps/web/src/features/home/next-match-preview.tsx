import Link from "next/link";

import { MatchStateMark } from "@football/football-ui";
import { Surface, Text } from "@football/ui";

import styles from "./home.module.css";

export function NextMatchPreview() {
  return (
    <Surface as="section" className={styles.nextMatch} elevation="raised">
      <span aria-hidden="true" className={styles.pitchStripe} />
      <div className={styles.matchHeading}>
        <Text as="span" tone="accent" variant="label">
          Próximo
        </Text>
        <Text as="p" className={styles.matchTime} variant="display-lg">
          Martes · 20:00
        </Text>
        <Text as="h2" variant="heading-lg">
          Los del martes
        </Text>
      </div>
      <div className={styles.matchMeta}>
        <Text as="span" tone="muted" variant="metadata">
          F5 · 60 min
        </Text>
        <div className={styles.matchAttendance}>
          <Text as="span" variant="heading-md">
            8 / 10
          </Text>
          <MatchStateMark tone="positive">Confirmado</MatchStateMark>
        </div>
      </div>
      <Link className={styles.primaryLink} href="/play">
        Ver partido <span aria-hidden="true">→</span>
      </Link>
    </Surface>
  );
}
