import { Button } from "@football/ui";

import type {
  EvaluationDraft,
  VotingAttribute,
  VotingParticipantView,
} from "./voting-types";
import { PlayerEvaluation } from "./player-evaluation";
import styles from "./voting.module.css";

export function FullVoting({
  currentIndex,
  drafts,
  finishAttempted,
  onAttributeToggle,
  onNavigate,
  onNext,
  onRatingChange,
  onSkip,
  participants,
}: Readonly<{
  currentIndex: number;
  drafts: Record<string, EvaluationDraft>;
  finishAttempted: boolean;
  onAttributeToggle: (
    group: "strengths" | "improvements",
    attribute: VotingAttribute,
  ) => void;
  onNavigate: (index: number) => void;
  onNext: () => void;
  onRatingChange: (rating: number) => void;
  onSkip: () => void;
  participants: readonly VotingParticipantView[];
}>) {
  const participant = participants[currentIndex]!;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === participants.length - 1;
  return (
    <div className={styles.fullVoting}>
      <PlayerEvaluation
        draft={drafts[participant.id]!}
        onAttributeToggle={onAttributeToggle}
        onRatingChange={onRatingChange}
        participant={participant}
        position={currentIndex + 1}
        total={participants.length}
      />
      <div className={styles.evaluationActions}>
        <Button
          disabled={isFirst}
          onClick={() => onNavigate(currentIndex - 1)}
          variant="quiet"
        >
          Anterior
        </Button>
        <Button onClick={onSkip} variant="secondary">
          Saltear
        </Button>
        <Button onClick={onNext}>{isLast ? "Finalizar" : "Siguiente"}</Button>
      </div>
      {finishAttempted ? (
        <span className={styles.finishError}>
          Evaluá al menos a un jugador para finalizar.
        </span>
      ) : null}
    </div>
  );
}
