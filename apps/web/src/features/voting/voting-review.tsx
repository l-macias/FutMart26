import { Button, Surface, Text } from "@football/ui";

import type { QuickChoice } from "./quick-voting";
import styles from "./voting.module.css";

type RatedQuickChoice = QuickChoice & { rating: number };

export function VotingReview({
  evaluatedCount,
  improvementCount,
  mode,
  omittedCount,
  onBack,
  onSubmit,
  quickChoices = [],
  standoutCount,
}: Readonly<{
  evaluatedCount: number;
  improvementCount: number;
  mode: "quick" | "full";
  omittedCount: number;
  onBack: () => void;
  onSubmit: () => void;
  quickChoices?: RatedQuickChoice[];
  standoutCount: number;
}>) {
  return (
    <Surface as="section" className={styles.review} elevation="raised">
      <Text as="span" tone="accent" variant="label">
        Revisar voto
      </Text>
      <Text as="h2" variant="display-lg">
        Tu boleta
      </Text>
      {mode === "quick" ? (
        <ul className={styles.quickReviewList}>
          {quickChoices.map(({ category, participant, rating }) => (
            <li key={participant.id}>
              <Text as="span" className={styles.reviewPlayer} variant="label">
                {participant.name}
              </Text>
              <Text
                as="span"
                className={
                  category === "standout"
                    ? styles.categoryPositive
                    : styles.categoryNegative
                }
                variant="metadata"
              >
                {category === "standout" ? "Destacado" : "A mejorar"}
              </Text>
              <Text
                as="span"
                className={styles.reviewRating}
                variant="heading-md"
              >
                {rating}
              </Text>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.reviewNumbers}>
        <div>
          <Text as="span" className={styles.reviewValue} variant="display-lg">
            {evaluatedCount}
          </Text>
          <Text as="span" tone="muted" variant="metadata">
            Evaluados
          </Text>
        </div>
        <div>
          <Text as="span" className={styles.reviewValue} variant="display-lg">
            {omittedCount}
          </Text>
          <Text as="span" tone="muted" variant="metadata">
            Omitidos
          </Text>
        </div>
      </div>
      {mode === "quick" ? (
        <Text tone="muted" variant="metadata">
          {standoutCount} destacados · {improvementCount} a mejorar
        </Text>
      ) : null}
      <div className={styles.reviewActions}>
        <Button onClick={onBack} variant="quiet">
          Volver a corregir
        </Button>
        <Button onClick={onSubmit}>Enviar voto</Button>
      </div>
    </Surface>
  );
}
