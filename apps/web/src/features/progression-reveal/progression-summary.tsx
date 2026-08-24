import Link from "next/link";

import { Button, Surface, Text } from "@football/ui";

import { progressionScenarios } from "./progression-reveal-mock-content";
import styles from "./progression-reveal.module.css";

export function ProgressionSummary({
  onReplay,
  scenario,
}: Readonly<{ onReplay: () => void; scenario: "normal" | "tier" }>) {
  const fixture = progressionScenarios[scenario];
  return (
    <Surface as="section" className={styles.summary} elevation="raised">
      <Text as="span" tone="accent" variant="label">
        Partido completado
      </Text>
      <Text as="h1" variant="display-lg">
        Tu resultado
      </Text>
      <dl className={styles.summaryList}>
        <div>
          <dt>Rating</dt>
          <dd>{fixture.matchRating}</dd>
        </div>
        <div>
          <dt>OVR</dt>
          <dd>
            {fixture.overall.before} → {fixture.overall.after}
          </dd>
        </div>
        {scenario === "normal" ? (
          <div>
            <dt>Personal best</dt>
            <dd>74</dd>
          </div>
        ) : (
          <div>
            <dt>Nueva card</dt>
            <dd>Silver</dd>
          </div>
        )}
      </dl>
      <div className={styles.summaryActions}>
        <Link className="ui-button ui-button--primary" href="/profile">
          Ver mi perfil
        </Link>
        <Link className="ui-button ui-button--secondary" href="/play">
          Volver a jugar
        </Link>
        <Button onClick={onReplay} variant="quiet">
          Ver de nuevo
        </Button>
      </div>
    </Surface>
  );
}
