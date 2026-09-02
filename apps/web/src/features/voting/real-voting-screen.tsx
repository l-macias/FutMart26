"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { TacticalDivider } from "@football/football-ui";
import { Surface, Text } from "@football/ui";

import { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import { FullVoting } from "./full-voting";
import {
  type QuickCategory,
  QuickRating,
  QuickSelection,
} from "./quick-voting";
import { VotingModeSelection } from "./voting-mode-selection";
import { VotingReview } from "./voting-review";
import {
  emptyEvaluation,
  type EvaluationDraft,
  type VotingAttribute,
  type VotingParticipantView,
  votingAttributeToApi,
} from "./voting-types";
import styles from "./voting.module.css";

type VotingFlow =
  | "MODE_SELECTION"
  | "QUICK_SELECTION"
  | "QUICK_RATING"
  | "QUICK_REVIEW"
  | "FULL_RATING"
  | "FULL_REVIEW";

function ratingBand(rating: number | undefined) {
  if (rating === undefined) return null;
  if (rating >= 7) return "high";
  if (rating <= 5) return "low";
  return "neutral";
}

function createDrafts(participants: readonly VotingParticipantView[]) {
  return Object.fromEntries(
    participants.map((participant) => [participant.id, emptyEvaluation()]),
  ) as Record<string, EvaluationDraft>;
}

export function RealVotingScreen({ matchId }: Readonly<{ matchId: string }>) {
  const queryClient = useQueryClient();
  const match = useQuery({
    queryKey: queryKeys.match(matchId),
    queryFn: () => api.match(matchId),
  });
  const me = useQuery({ queryKey: queryKeys.me, queryFn: api.me });
  const eligibility = useQuery({
    queryKey: queryKeys.votingEligibility(matchId),
    queryFn: () => api.votingEligibility(matchId),
    enabled: match.data?.status === "FINISHED",
  });
  const voting = useQuery({
    queryKey: queryKeys.voting(matchId),
    queryFn: () => api.voting(matchId),
    enabled: match.data?.status === "FINISHED",
    retry: false,
  });

  const participants = (voting.data?.eligibleTargets ?? []).map((target) => ({
    id: target.participantId,
    name: target.displayName,
    guest: target.kind === "GUEST",
  }));
  const [flow, setFlow] = useState<VotingFlow>("MODE_SELECTION");
  const [standouts, setStandouts] = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [quickRatings, setQuickRatings] = useState<Record<string, number>>({});
  const [quickIndex, setQuickIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, EvaluationDraft>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fullFinishAttempted, setFullFinishAttempted] = useState(false);

  const quickChoices = [
    ...standouts.map((id) => ({
      category: "standout" as const,
      participant: participants.find((item) => item.id === id)!,
    })),
    ...improvements.map((id) => ({
      category: "improvement" as const,
      participant: participants.find((item) => item.id === id)!,
    })),
  ];
  const fullEvaluatedCount = Object.values(drafts).filter(
    (draft) => draft.rating !== undefined,
  ).length;

  const submit = useMutation({
    mutationFn: () => {
      if (flow === "QUICK_REVIEW") {
        return api.submitBallot(matchId, {
          mode: "QUICK",
          evaluations: quickChoices.map((choice) => ({
            targetParticipantId: choice.participant.id,
            rating: quickRatings[choice.participant.id]!,
            quickSignal:
              choice.category === "standout" ? "POSITIVE" : "IMPROVEMENT",
          })),
        });
      }
      return api.submitBallot(matchId, {
        mode: "FULL",
        evaluations: participants.flatMap((participant) => {
          const draft = drafts[participant.id];
          if (!draft || draft.rating === undefined) return [];
          return [
            {
              targetParticipantId: participant.id,
              rating: draft.rating,
              strengths: draft.strengths.map(
                (item) => votingAttributeToApi[item],
              ),
              improvements: draft.improvements.map(
                (item) => votingAttributeToApi[item],
              ),
            },
          ];
        }),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.voting(matchId) }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.myBallot(matchId),
        }),
      ]);
    },
  });

  if (match.isPending || me.isPending)
    return <p role="status">Cargando votación…</p>;
  if (match.isError || me.isError)
    return <p role="alert">{match.error?.message ?? me.error?.message}</p>;
  if (match.data.status !== "FINISHED")
    return (
      <Surface as="section" className={styles.submitted} elevation="raised">
        <Text as="h1" variant="display-lg">
          Votación no disponible
        </Text>
        <Text tone="muted">El partido todavía no fue finalizado.</Text>
        <Link
          className="ui-button ui-button--primary"
          href={`/play/matches/${matchId}`}
        >
          Volver al partido
        </Link>
      </Surface>
    );

  const currentEligibility = eligibility.data?.participants.find(
    (participant) => participant.playerId === me.data.id,
  );
  const canVote = currentEligibility?.canVote === true;
  const eligibleAt = eligibility.data?.votingStartsAt
    ? new Date(eligibility.data.votingStartsAt)
    : null;
  const eligibleNow = eligibleAt ? Date.now() >= eligibleAt.getTime() : false;

  if (voting.isError) {
    const waitingForWindow =
      voting.error instanceof ApiError &&
      (voting.error.code === "voting_not_eligible_yet" ||
        voting.error.code === "voting_not_found");
    if (!waitingForWindow) return <p role="alert">{voting.error.message}</p>;
    return (
      <div className={styles.page}>
        <Link className={styles.backLink} href={`/play/matches/${matchId}`}>
          ← Partido
        </Link>
        <Surface as="section" className={styles.submitted} elevation="raised">
          <Text as="span" tone="accent" variant="label">
            VOTACIÓN
          </Text>
          <Text as="h1" variant="display-lg">
            Todavía no abrió.
          </Text>
          {eligibleAt && !eligibleNow ? (
            <Text tone="muted">
              Se podrá abrir desde{" "}
              {eligibleAt.toLocaleString("es-AR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </Text>
          ) : null}
          <Text tone="muted">
            La votación se habilita automáticamente cuando comienza su ventana.
          </Text>
        </Surface>
      </div>
    );
  }

  if (voting.isPending || eligibility.isPending)
    return <p role="status">Cargando votación…</p>;

  if (voting.data.status === "CLOSED" || voting.data.hasSubmitted) {
    return (
      <Surface as="section" className={styles.submitted} elevation="raised">
        <Text as="span" className={styles.positiveText} variant="label">
          {voting.data.hasSubmitted ? "VOTO ENVIADO" : "VOTACIÓN CERRADA"}
        </Text>
        <Text as="h1" variant="display-lg">
          {voting.data.hasSubmitted ? "Gracias." : "La votación terminó."}
        </Text>
        <Text tone="muted">
          {voting.data.status === "CLOSED"
            ? "Tu resultado de progresión ya puede prepararse."
            : "Tu progreso estará disponible cuando termine la votación."}
        </Text>
        <Link
          className="ui-button ui-button--primary"
          href={
            voting.data.status === "CLOSED"
              ? `/play/matches/${matchId}/progression`
              : `/play/matches/${matchId}`
          }
        >
          {voting.data.status === "CLOSED"
            ? "Ver mi progreso"
            : "Volver al partido"}
        </Link>
      </Surface>
    );
  }

  if (!canVote) {
    return (
      <Surface as="section" className={styles.submitted} elevation="raised">
        <Text as="span" tone="accent" variant="label">
          VOTACIÓN ABIERTA
        </Text>
        <Text as="h1" variant="display-lg">
          No te corresponde votar.
        </Text>
        <Text tone="muted">
          Sólo pueden votar jugadores reales que figuren como presentes en el
          partido.
        </Text>
        <Link
          className="ui-button ui-button--primary"
          href={`/play/matches/${matchId}`}
        >
          Volver al partido
        </Link>
      </Surface>
    );
  }

  function begin(mode: "quick" | "full") {
    setDrafts(createDrafts(participants));
    setFlow(mode === "quick" ? "QUICK_SELECTION" : "FULL_RATING");
  }

  function toggleQuick(id: string, category: QuickCategory) {
    const selected = category === "standout" ? standouts : improvements;
    const next = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : selected.length < 3
        ? [...selected, id]
        : selected;
    if (category === "standout") {
      setStandouts(next);
      setImprovements((current) => current.filter((item) => item !== id));
    } else {
      setImprovements(next);
      setStandouts((current) => current.filter((item) => item !== id));
    }
    setQuickRatings((current) => {
      const nextRatings = { ...current };
      delete nextRatings[id];
      return nextRatings;
    });
  }

  function updateCurrent(update: (draft: EvaluationDraft) => EvaluationDraft) {
    const participant = participants[currentIndex]!;
    setDrafts((current) => ({
      ...current,
      [participant.id]: update(current[participant.id] ?? emptyEvaluation()),
    }));
  }

  function toggleAttribute(
    group: "strengths" | "improvements",
    attribute: VotingAttribute,
  ) {
    updateCurrent((draft) => ({
      ...draft,
      [group]: draft[group].includes(attribute)
        ? draft[group].filter((item) => item !== attribute)
        : draft[group].length < 3
          ? [...draft[group], attribute]
          : draft[group],
    }));
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href={`/play/matches/${matchId}`}>
          ← Partido
        </Link>
        <div className={styles.matchHeading}>
          <div>
            <Text as="span" tone="accent" variant="label">
              Votación abierta
            </Text>
            <Text as="h1" variant="display-lg">
              Evaluá el partido
            </Text>
          </div>
          <div className={styles.deadline}>
            <Text
              as="span"
              className={styles.deadlineValue}
              variant="heading-lg"
            >
              {new Date(voting.data.closesAt).toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <Text as="span" tone="muted" variant="metadata">
              CIERRA
            </Text>
          </div>
        </div>
      </header>
      <TacticalDivider />

      {flow === "MODE_SELECTION" ? (
        <VotingModeSelection onSelect={begin} />
      ) : null}

      {flow === "QUICK_SELECTION" ? (
        <QuickSelection
          improvements={improvements}
          onContinue={() => {
            if (quickChoices.length > 0) {
              setQuickIndex(0);
              setFlow("QUICK_RATING");
            }
          }}
          onToggle={toggleQuick}
          participants={participants}
          standouts={standouts}
        />
      ) : null}

      {flow === "QUICK_RATING" && quickChoices[quickIndex] ? (
        <QuickRating
          choice={quickChoices[quickIndex]}
          index={quickIndex}
          onBack={() => {
            if (quickIndex === 0) setFlow("QUICK_SELECTION");
            else setQuickIndex((value) => value - 1);
          }}
          onNext={() => {
            if (quickIndex === quickChoices.length - 1) setFlow("QUICK_REVIEW");
            else setQuickIndex((value) => value + 1);
          }}
          onRatingChange={(rating) => {
            const choice = quickChoices[quickIndex];
            if (!choice) return;
            setQuickRatings((current) => ({
              ...current,
              [choice.participant.id]: rating,
            }));
          }}
          rating={quickRatings[quickChoices[quickIndex].participant.id]}
          total={quickChoices.length}
        />
      ) : null}

      {flow === "QUICK_REVIEW" ? (
        <VotingReview
          evaluatedCount={quickChoices.length}
          improvementCount={improvements.length}
          mode="quick"
          omittedCount={participants.length - quickChoices.length}
          onBack={() => setFlow("QUICK_RATING")}
          onSubmit={() => submit.mutate()}
          quickChoices={quickChoices.map((choice) => ({
            ...choice,
            rating: quickRatings[choice.participant.id]!,
          }))}
          standoutCount={standouts.length}
        />
      ) : null}

      {flow === "FULL_RATING" && participants[currentIndex] ? (
        <FullVoting
          currentIndex={currentIndex}
          drafts={drafts}
          finishAttempted={fullFinishAttempted}
          onAttributeToggle={toggleAttribute}
          onNavigate={(index) => {
            setCurrentIndex(index);
            setFullFinishAttempted(false);
          }}
          onNext={() => {
            if (currentIndex === participants.length - 1) {
              if (fullEvaluatedCount === 0) setFullFinishAttempted(true);
              else setFlow("FULL_REVIEW");
            } else {
              setCurrentIndex((value) => value + 1);
              setFullFinishAttempted(false);
            }
          }}
          onRatingChange={(rating) => {
            updateCurrent((draft) => {
              const crossedBand =
                ratingBand(draft.rating) !== ratingBand(rating);
              return {
                ...draft,
                rating,
                skipped: false,
                strengths: crossedBand || rating <= 6 ? [] : draft.strengths,
                improvements:
                  crossedBand || rating >= 6 ? [] : draft.improvements,
              };
            });
            setFullFinishAttempted(false);
          }}
          onSkip={() => {
            const participant = participants[currentIndex]!;
            const wasEvaluated = drafts[participant.id]?.rating !== undefined;
            setDrafts((current) => ({
              ...current,
              [participant.id]: { ...emptyEvaluation(), skipped: true },
            }));
            if (currentIndex === participants.length - 1) {
              if (fullEvaluatedCount - (wasEvaluated ? 1 : 0) === 0)
                setFullFinishAttempted(true);
              else setFlow("FULL_REVIEW");
            } else setCurrentIndex((value) => value + 1);
          }}
          participants={participants}
        />
      ) : null}

      {flow === "FULL_REVIEW" ? (
        <VotingReview
          evaluatedCount={fullEvaluatedCount}
          improvementCount={0}
          mode="full"
          omittedCount={participants.length - fullEvaluatedCount}
          onBack={() => setFlow("FULL_RATING")}
          onSubmit={() => submit.mutate()}
          standoutCount={0}
        />
      ) : null}

      {submit.isError ? <p role="alert">{submit.error.message}</p> : null}
      {submit.isPending ? <p role="status">Enviando voto…</p> : null}
    </div>
  );
}
