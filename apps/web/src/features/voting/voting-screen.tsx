"use client";

import Link from "next/link";
import { useState } from "react";

import { TacticalDivider } from "@football/football-ui";
import { Button, Surface, Text } from "@football/ui";

import { FullVoting } from "./full-voting";
import {
  type QuickCategory,
  QuickRating,
  QuickSelection,
} from "./quick-voting";
import {
  emptyEvaluation,
  type EvaluationDraft,
  type VotingAttribute,
  votingParticipants,
} from "./voting-mock-content";
import { VotingModeSelection } from "./voting-mode-selection";
import { VotingReview } from "./voting-review";
import styles from "./voting.module.css";

type VotingFlow =
  | "MODE_SELECTION"
  | "QUICK_SELECTION"
  | "QUICK_RATING"
  | "QUICK_REVIEW"
  | "FULL_RATING"
  | "FULL_REVIEW"
  | "SUBMITTED";

function createInitialDrafts() {
  return Object.fromEntries(
    votingParticipants.map((participant) => [
      participant.id,
      emptyEvaluation(),
    ]),
  ) as Record<string, EvaluationDraft>;
}

function ratingBand(rating: number | undefined) {
  if (rating === undefined) return null;
  if (rating >= 7) return "high";
  if (rating <= 5) return "low";
  return "neutral";
}

export function VotingScreen() {
  const [flow, setFlow] = useState<VotingFlow>("MODE_SELECTION");
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [standouts, setStandouts] = useState<string[]>([]);
  const [quickImprovements, setQuickImprovements] = useState<string[]>([]);
  const [quickRatings, setQuickRatings] = useState<Record<string, number>>({});
  const [quickIndex, setQuickIndex] = useState(0);
  const [drafts, setDrafts] = useState(createInitialDrafts);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fullFinishAttempted, setFullFinishAttempted] = useState(false);

  const quickChoices = [
    ...standouts.map((id) => ({
      category: "standout" as const,
      participant: votingParticipants.find((item) => item.id === id)!,
    })),
    ...quickImprovements.map((id) => ({
      category: "improvement" as const,
      participant: votingParticipants.find((item) => item.id === id)!,
    })),
  ];
  const fullEvaluatedCount = Object.values(drafts).filter(
    (draft) => draft.rating !== undefined,
  ).length;

  function resetBallot() {
    setStandouts([]);
    setQuickImprovements([]);
    setQuickRatings({});
    setQuickIndex(0);
    setDrafts(createInitialDrafts());
    setCurrentIndex(0);
    setFullFinishAttempted(false);
    setDiscardPrompt(false);
  }

  function discardAndChangeMode() {
    resetBallot();
    setFlow("MODE_SELECTION");
  }

  function toggleQuickChoice(id: string, category: QuickCategory) {
    const selected = category === "standout" ? standouts : quickImprovements;
    const nextSelected = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : selected.length < 3
        ? [...selected, id]
        : selected;

    if (category === "standout") {
      setStandouts(nextSelected);
      setQuickImprovements((current) => current.filter((item) => item !== id));
    } else {
      setQuickImprovements(nextSelected);
      setStandouts((current) => current.filter((item) => item !== id));
    }
    setQuickRatings((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([participantId]) => participantId !== id,
        ),
      ),
    );
  }

  function startQuickRating() {
    if (quickChoices.length === 0) return;
    setQuickIndex(0);
    setFlow("QUICK_RATING");
  }

  function rateQuickPlayer(rating: number) {
    const choice = quickChoices[quickIndex];
    if (!choice) return;
    const allowed =
      choice.category === "standout"
        ? rating >= 7 && rating <= 10
        : rating >= 1 && rating <= 5;
    if (!allowed) return;
    setQuickRatings((current) => ({
      ...current,
      [choice.participant.id]: rating,
    }));
  }

  function advanceQuickRating() {
    const choice = quickChoices[quickIndex];
    if (!choice || quickRatings[choice.participant.id] === undefined) return;
    if (quickIndex === quickChoices.length - 1) {
      setFlow("QUICK_REVIEW");
      return;
    }
    setQuickIndex((current) => current + 1);
  }

  function updateCurrent(
    update: (current: EvaluationDraft) => EvaluationDraft,
  ) {
    const participant = votingParticipants[currentIndex]!;
    setDrafts((current) => ({
      ...current,
      [participant.id]: update(current[participant.id]!),
    }));
  }

  function rateFullPlayer(rating: number) {
    updateCurrent((current) => {
      const crossedBand = ratingBand(current.rating) !== ratingBand(rating);
      return {
        ...current,
        improvements: crossedBand || rating >= 6 ? [] : current.improvements,
        rating,
        skipped: false,
        strengths: crossedBand || rating <= 6 ? [] : current.strengths,
      };
    });
    setFullFinishAttempted(false);
  }

  function toggleFullAttribute(
    group: "strengths" | "improvements",
    attribute: VotingAttribute,
  ) {
    updateCurrent((current) => ({
      ...current,
      [group]: current[group].includes(attribute)
        ? current[group].filter((item) => item !== attribute)
        : current[group].length < 3
          ? [...current[group], attribute]
          : current[group],
    }));
  }

  function finishFullVoting(evaluatedCount: number) {
    if (evaluatedCount === 0) {
      setFullFinishAttempted(true);
      return;
    }
    setFlow("FULL_REVIEW");
  }

  function advanceFullVoting() {
    if (currentIndex === votingParticipants.length - 1) {
      finishFullVoting(fullEvaluatedCount);
      return;
    }
    setCurrentIndex((current) => current + 1);
    setFullFinishAttempted(false);
  }

  function skipFullPlayer() {
    const participant = votingParticipants[currentIndex]!;
    const currentWasEvaluated = drafts[participant.id]?.rating !== undefined;
    setDrafts((current) => ({
      ...current,
      [participant.id]: { ...emptyEvaluation(), skipped: true },
    }));

    if (currentIndex === votingParticipants.length - 1) {
      finishFullVoting(fullEvaluatedCount - (currentWasEvaluated ? 1 : 0));
      return;
    }
    setCurrentIndex((current) => current + 1);
    setFullFinishAttempted(false);
  }

  function renderFlow() {
    if (discardPrompt) {
      return (
        <Surface
          aria-labelledby="discard-vote-title"
          as="section"
          className={styles.modeConfirmation}
          elevation="raised"
          role="alertdialog"
        >
          <Text as="h2" id="discard-vote-title" variant="heading-lg">
            ¿Descartar este voto?
          </Text>
          <Text tone="muted">
            Se eliminará todo lo que completaste en este modo.
          </Text>
          <div className={styles.modeConfirmationActions}>
            <Button onClick={() => setDiscardPrompt(false)} variant="quiet">
              Seguir votando
            </Button>
            <Button onClick={discardAndChangeMode} variant="secondary">
              Descartar y cambiar
            </Button>
          </div>
        </Surface>
      );
    }

    switch (flow) {
      case "MODE_SELECTION":
        return (
          <VotingModeSelection
            onSelect={(mode) =>
              setFlow(mode === "quick" ? "QUICK_SELECTION" : "FULL_RATING")
            }
          />
        );
      case "QUICK_SELECTION":
        return (
          <QuickSelection
            improvements={quickImprovements}
            onContinue={startQuickRating}
            onToggle={toggleQuickChoice}
            participants={votingParticipants}
            standouts={standouts}
          />
        );
      case "QUICK_RATING": {
        const choice = quickChoices[quickIndex]!;
        return (
          <QuickRating
            choice={choice}
            index={quickIndex}
            onBack={() => {
              if (quickIndex === 0) setFlow("QUICK_SELECTION");
              else setQuickIndex((current) => current - 1);
            }}
            onNext={advanceQuickRating}
            onRatingChange={rateQuickPlayer}
            rating={quickRatings[choice.participant.id]}
            total={quickChoices.length}
          />
        );
      }
      case "QUICK_REVIEW":
        return (
          <VotingReview
            evaluatedCount={quickChoices.length}
            improvementCount={quickImprovements.length}
            mode="quick"
            omittedCount={votingParticipants.length - quickChoices.length}
            onBack={() => {
              setQuickIndex(Math.max(quickChoices.length - 1, 0));
              setFlow("QUICK_RATING");
            }}
            onSubmit={() => setFlow("SUBMITTED")}
            quickChoices={quickChoices.map((choice) => ({
              ...choice,
              rating: quickRatings[choice.participant.id]!,
            }))}
            standoutCount={standouts.length}
          />
        );
      case "FULL_RATING":
        return (
          <FullVoting
            currentIndex={currentIndex}
            drafts={drafts}
            finishAttempted={fullFinishAttempted}
            onAttributeToggle={toggleFullAttribute}
            onNavigate={(index) => {
              setCurrentIndex(index);
              setFullFinishAttempted(false);
            }}
            onNext={advanceFullVoting}
            onRatingChange={rateFullPlayer}
            onSkip={skipFullPlayer}
            participants={votingParticipants}
          />
        );
      case "FULL_REVIEW":
        return (
          <VotingReview
            evaluatedCount={fullEvaluatedCount}
            improvementCount={0}
            mode="full"
            omittedCount={votingParticipants.length - fullEvaluatedCount}
            onBack={() => setFlow("FULL_RATING")}
            onSubmit={() => setFlow("SUBMITTED")}
            standoutCount={0}
          />
        );
      case "SUBMITTED":
        return (
          <Surface as="section" className={styles.submitted} elevation="raised">
            <Text as="span" className={styles.positiveText} variant="label">
              Voto enviado
            </Text>
            <Text as="h1" variant="display-lg">
              Gracias.
            </Text>
            <Text tone="muted">
              Los resultados estarán disponibles cuando cierre la votación.
            </Text>
            <Link className="ui-button ui-button--primary" href="/play">
              Volver a jugar
            </Link>
          </Surface>
        );
    }
  }

  if (flow === "SUBMITTED") return renderFlow();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/play">
          ← Jugar
        </Link>
        <div className={styles.matchHeading}>
          <div>
            <Text as="span" tone="accent" variant="label">
              Votación abierta
            </Text>
            <Text as="h1" variant="display-lg">
              Los del viernes
            </Text>
          </div>
          <div className={styles.deadline}>
            <Text
              as="span"
              className={styles.deadlineValue}
              variant="heading-lg"
            >
              17:42
            </Text>
            <Text as="span" tone="muted" variant="metadata">
              Restantes
            </Text>
          </div>
        </div>
      </header>

      {flow !== "MODE_SELECTION" ? (
        <button
          className={styles.changeModeButton}
          onClick={() => setDiscardPrompt(true)}
          type="button"
        >
          ← Cambiar modo
        </button>
      ) : null}
      <TacticalDivider />
      {renderFlow()}
    </div>
  );
}
