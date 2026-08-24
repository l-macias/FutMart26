import { Text } from "@football/ui";

import {
  type EvaluationDraft,
  type VotingAttribute,
  type VotingParticipantView,
  votingAttributes,
} from "./voting-mock-content";
import styles from "./voting.module.css";

function AttributeSelector({
  label,
  onToggle,
  selected,
}: Readonly<{
  label: string;
  onToggle: (attribute: VotingAttribute) => void;
  selected: VotingAttribute[];
}>) {
  const atLimit = selected.length === 3;
  return (
    <fieldset className={styles.attributeGroup}>
      <legend>
        {label} <span>{selected.length}/3</span>
      </legend>
      <div>
        {votingAttributes.map((attribute) => {
          const isSelected = selected.includes(attribute);
          return (
            <button
              aria-pressed={isSelected}
              disabled={atLimit && !isSelected}
              key={attribute}
              onClick={() => onToggle(attribute)}
              type="button"
            >
              {attribute}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function PlayerEvaluation({
  draft,
  onAttributeToggle,
  onRatingChange,
  participant,
  position,
  total,
}: Readonly<{
  draft: EvaluationDraft;
  onAttributeToggle: (
    group: "strengths" | "improvements",
    attribute: VotingAttribute,
  ) => void;
  onRatingChange: (rating: number) => void;
  participant: VotingParticipantView;
  position: number;
  total: number;
}>) {
  const rating = draft.rating;
  return (
    <section
      aria-labelledby="current-player-name"
      className={styles.evaluation}
    >
      <div className={styles.playerHeader}>
        <div>
          {participant.guest ? (
            <Text as="span" tone="accent" variant="metadata">
              Guest
            </Text>
          ) : null}
          <Text as="h2" id="current-player-name" variant="display-lg">
            {participant.name}
          </Text>
        </div>
        <Text as="span" tone="muted" variant="label">
          {position} / {total}
        </Text>
      </div>
      <fieldset className={styles.ratingGroup}>
        <legend>¿Cómo jugó?</legend>
        <div className={styles.ratingScale}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <button
              aria-label={`Puntuar ${value} a ${participant.name}`}
              aria-pressed={rating === value}
              key={value}
              onClick={() => onRatingChange(value)}
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
      </fieldset>
      {rating !== undefined && rating <= 5 ? (
        <AttributeSelector
          label="A mejorar"
          onToggle={(attribute) => onAttributeToggle("improvements", attribute)}
          selected={draft.improvements}
        />
      ) : null}
      {rating === 6 ? (
        <Text className={styles.neutralSignal} variant="label">
          Correcto
        </Text>
      ) : null}
      {rating !== undefined && rating >= 7 ? (
        <AttributeSelector
          label="Destacó en"
          onToggle={(attribute) => onAttributeToggle("strengths", attribute)}
          selected={draft.strengths}
        />
      ) : null}
      {rating === undefined ? (
        <Text tone="muted" variant="metadata">
          Elegí un rating para continuar.
        </Text>
      ) : null}
    </section>
  );
}
