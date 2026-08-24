import { Surface, Text } from "@football/ui";

import { CardPreview } from "./card-preview";
import {
  progressionContext,
  progressionScenarios,
} from "./progression-reveal-mock-content";
import styles from "./progression-reveal.module.css";

export function MatchRatingReveal() {
  return (
    <section className={styles.centerStage}>
      <Text as="span" tone="muted" variant="label">
        Tu partido
      </Text>
      <Text as="span" className={styles.matchRating} variant="score">
        8.4
      </Text>
      <Text as="span" className={styles.positive} variant="heading-md">
        Muy bueno
      </Text>
      <Text as="span" tone="muted" variant="metadata">
        Rating del partido
      </Text>
    </section>
  );
}

export function OverallReveal({
  scenario,
}: Readonly<{ scenario: "normal" | "tier" }>) {
  const overall = progressionScenarios[scenario].overall;
  return (
    <section className={styles.centerStage}>
      <Text as="span" tone="accent" variant="label">
        OVR
      </Text>
      <div
        aria-label={`Overall subió de ${overall.before} a ${overall.after}`}
        className={styles.overallChange}
      >
        <Text as="span" tone="muted" variant="score">
          {overall.before}
        </Text>
        <span aria-hidden="true" className={styles.progressArrow}>
          →
        </span>
        <Text as="span" className={styles.overallAfter} variant="score">
          {overall.after}
        </Text>
      </div>
      <Text as="span" className={styles.deltaPositive} variant="heading-lg">
        +{overall.delta}
      </Text>
    </section>
  );
}

export function AttributeChanges() {
  const fixture = progressionScenarios.normal;
  return (
    <section className={styles.attributeStage}>
      <div>
        <Text as="span" tone="accent" variant="label">
          Tu evolución
        </Text>
        <Text as="h2" variant="display-lg">
          Atributos
        </Text>
      </div>
      <ul className={styles.attributeList}>
        {fixture.attributes.map((attribute) => (
          <li key={attribute.label}>
            <Text as="span" variant="label">
              {attribute.label}
            </Text>
            <span className={styles.attributeValues}>
              <Text as="span" tone="muted" variant="heading-md">
                {attribute.before}
              </Text>
              <span aria-hidden="true">→</span>
              <Text
                as="span"
                className={styles.strongValue}
                variant="heading-md"
              >
                {attribute.after}
              </Text>
            </span>
            <Text
              as="span"
              className={
                attribute.delta > 0
                  ? styles.deltaPositive
                  : attribute.delta < 0
                    ? styles.deltaNegative
                    : styles.deltaNeutral
              }
              variant="label"
            >
              {attribute.delta > 0 ? `+${attribute.delta}` : attribute.delta}
            </Text>
          </li>
        ))}
      </ul>
      <div className={styles.signals}>
        <div>
          <Text as="span" className={styles.positive} variant="label">
            Destacaste en
          </Text>
          <Text>{fixture.strengths.join(" · ")}</Text>
        </div>
        <div>
          <Text as="span" className={styles.negative} variant="label">
            A mejorar
          </Text>
          <Text>{fixture.improvements.join(" · ")}</Text>
        </div>
      </div>
    </section>
  );
}

export function MilestoneReveal() {
  return (
    <Surface
      as="section"
      className={`${styles.centerStage} ${styles.milestone}`}
      elevation="raised"
    >
      <span aria-hidden="true" className={styles.celebrationLine} />
      <Text as="span" tone="accent" variant="label">
        Nuevo personal best
      </Text>
      <Text as="span" className={styles.milestoneValue} variant="score">
        74
      </Text>
      <Text as="span" variant="heading-md">
        OVR
      </Text>
    </Surface>
  );
}

export function TierReveal() {
  return (
    <section className={styles.centerStage}>
      <Text as="span" tone="accent" variant="label">
        Nuevo tier
      </Text>
      <div
        className={styles.tierChange}
        aria-label="Tier cambió de Bronze a Silver"
      >
        <Text as="span" tone="muted" variant="heading-lg">
          Bronze
        </Text>
        <span aria-hidden="true">→</span>
        <Text as="span" className={styles.strongValue} variant="display-lg">
          Silver
        </Text>
      </div>
      <Text as="span" tone="muted">
        Tu progreso desbloqueó una nueva card.
      </Text>
    </section>
  );
}

export function TierCardReveal() {
  return (
    <section className={styles.cardStage}>
      <div>
        <Text as="span" tone="accent" variant="label">
          Nueva card
        </Text>
        <Text as="h2" variant="display-lg">
          Silver
        </Text>
        <Text tone="muted">
          Preview conceptual. El artwork y la geometría final se diseñarán
          después.
        </Text>
      </div>
      <CardPreview />
    </section>
  );
}

export function RevealContext() {
  return (
    <div className={styles.revealContext}>
      <Text as="span" variant="label">
        {progressionContext.player}
      </Text>
      <Text as="span" tone="muted" variant="metadata">
        {progressionContext.discipline} · {progressionContext.match}
      </Text>
    </div>
  );
}
