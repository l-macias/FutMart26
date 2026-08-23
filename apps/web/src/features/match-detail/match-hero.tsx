import { MatchStateMark } from "@football/football-ui";
import { Button, Surface, Text } from "@football/ui";

import styles from "./match-detail.module.css";

export function MatchHero() {
  return (
    <Surface as="section" className={styles.hero} elevation="raised">
      <span aria-hidden="true" className={styles.pitchStripe} />
      <div className={styles.heroStatus}>
        <MatchStateMark tone="warning">Convocatoria abierta</MatchStateMark>
        <MatchStateMark tone="positive">Estás confirmado</MatchStateMark>
      </div>

      <div className={styles.heroHeading}>
        <Text as="p" tone="accent" variant="display-lg">
          Martes · 20:00
        </Text>
        <Text as="h1" variant="heading-lg">
          Los del martes
        </Text>
        <Text tone="muted" variant="metadata">
          F5 · 60 min · Rosario
        </Text>
      </div>

      <div className={styles.heroActions}>
        <Button disabled title="Acción no disponible en este mock">
          Bajarme
        </Button>
        <Button
          disabled
          title="Administración no disponible en este mock"
          variant="secondary"
        >
          Administrar
        </Button>
      </div>
    </Surface>
  );
}
