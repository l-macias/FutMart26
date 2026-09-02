import { Button, Text } from "@football/ui";

import type { VotingParticipantView } from "./voting-types";
import styles from "./voting.module.css";

export type QuickCategory = "standout" | "improvement";
export type QuickChoice = {
  category: QuickCategory;
  participant: VotingParticipantView;
};

function SelectionGroup({
  category,
  label,
  onToggle,
  participants,
  selected,
}: Readonly<{
  category: QuickCategory;
  label: string;
  onToggle: (id: string, category: QuickCategory) => void;
  participants: readonly VotingParticipantView[];
  selected: string[];
}>) {
  const atLimit = selected.length === 3;
  return (
    <fieldset
      className={`${styles.quickGroup} ${
        category === "standout"
          ? styles.quickGroupPositive
          : styles.quickGroupNegative
      }`}
    >
      <legend>{label} · hasta 3</legend>
      <div className={styles.playerChoices}>
        {participants.map((participant) => {
          const isSelected = selected.includes(participant.id);
          return (
            <button
              aria-pressed={isSelected}
              disabled={atLimit && !isSelected}
              key={participant.id}
              onClick={() => onToggle(participant.id, category)}
              type="button"
            >
              {participant.guest ? <span>Guest</span> : null}
              {participant.name}
              {isSelected ? <strong>Seleccionado</strong> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function QuickSelection({
  improvements,
  onContinue,
  onToggle,
  participants,
  standouts,
}: Readonly<{
  improvements: string[];
  onContinue: () => void;
  onToggle: (id: string, category: QuickCategory) => void;
  participants: readonly VotingParticipantView[];
  standouts: string[];
}>) {
  const selectedCount = standouts.length + improvements.length;
  return (
    <div className={styles.quickVoting}>
      <SelectionGroup
        category="standout"
        label="Se destacaron"
        onToggle={onToggle}
        participants={participants}
        selected={standouts}
      />
      <SelectionGroup
        category="improvement"
        label="A mejorar"
        onToggle={onToggle}
        participants={participants}
        selected={improvements}
      />
      <Button disabled={selectedCount === 0} onClick={onContinue}>
        Puntuar elegidos
      </Button>
    </div>
  );
}

export function QuickRating({
  choice,
  index,
  onBack,
  onNext,
  onRatingChange,
  rating,
  total,
}: Readonly<{
  choice: QuickChoice;
  index: number;
  onBack: () => void;
  onNext: () => void;
  onRatingChange: (rating: number) => void;
  rating: number | undefined;
  total: number;
}>) {
  const isStandout = choice.category === "standout";
  return (
    <section
      aria-labelledby="quick-player-name"
      className={`${styles.quickRating} ${
        isStandout ? styles.quickRatingPositive : styles.quickRatingNegative
      }`}
    >
      <div className={styles.playerHeader}>
        <div>
          <Text as="h2" id="quick-player-name" variant="display-lg">
            {choice.participant.name}
          </Text>
          <Text
            as="span"
            className={
              isStandout ? styles.categoryPositive : styles.categoryNegative
            }
            variant="label"
          >
            {isStandout ? "Destacado" : "A mejorar"}
          </Text>
        </div>
        <Text as="span" tone="muted" variant="label">
          {index + 1} / {total}
        </Text>
      </div>
      <fieldset className={styles.ratingGroup}>
        <legend>Rating</legend>
        <div className={styles.ratingScale}>
          {Array.from({ length: 10 }, (_, ratingIndex) => ratingIndex + 1).map(
            (value) => {
              const allowed = isStandout ? value >= 7 : value <= 5;
              return (
                <button
                  aria-label={`Puntuar ${value} a ${choice.participant.name}`}
                  aria-pressed={rating === value}
                  disabled={!allowed}
                  key={value}
                  onClick={() => onRatingChange(value)}
                  type="button"
                >
                  {value}
                </button>
              );
            },
          )}
        </div>
      </fieldset>
      <div className={styles.quickRatingActions}>
        <Button onClick={onBack} variant="quiet">
          Anterior
        </Button>
        <Button disabled={rating === undefined} onClick={onNext}>
          {index === total - 1 ? "Finalizar" : "Siguiente"}
        </Button>
      </div>
    </section>
  );
}
