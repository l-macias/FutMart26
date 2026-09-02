"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { ProgressionRevealResponse } from "@football/contracts";
import { TacticalDivider } from "@football/football-ui";
import { Button, Surface, Text } from "@football/ui";

import {
  PlayerCard,
  type PlayerCardAttributes,
} from "@/components/player-card/player-card";
import { ApiError, mediaContentUrl } from "@/lib/api/client";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "./progression-reveal.module.css";

type Available = Extract<ProgressionRevealResponse, { status: "AVAILABLE" }>;
type Stage = "CONTEXT" | "BEFORE" | "CHANGES" | "AFTER";

const attributeLabels = {
  VELOCIDAD: "Velocidad",
  PASE: "Pase",
  REGATE: "Regate",
  REMATE: "Remate",
  DEFENSA: "Defensa",
  FISICO: "Físico",
} as const;

export function ProgressionRevealScreen({
  matchId,
}: Readonly<{ matchId: string }>) {
  const queryClient = useQueryClient();
  const player = useQuery({ queryKey: queryKeys.me, queryFn: api.me });
  const reveal = useQuery({
    queryKey: queryKeys.progressionReveal(matchId),
    queryFn: () => api.progressionReveal(matchId),
    retry: false,
  });
  const materialize = useMutation({
    mutationFn: () => api.materializeProgression(matchId),
    onSuccess: async (result) => {
      queryClient.setQueryData(queryKeys.progressionReveal(matchId), result);
      if (result.status === "AVAILABLE")
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.performance }),
          queryClient.invalidateQueries({ queryKey: queryKeys.rewards }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.notificationUnreadCount,
          }),
        ]);
    },
  });

  useEffect(() => {
    if (
      materialize.isIdle &&
      (reveal.data?.status === "AVAILABLE" ||
        (reveal.data?.status === "PROGRESSION_PENDING" &&
          reveal.data.reason === "READY_TO_MATERIALIZE"))
    )
      materialize.mutate();
  }, [materialize, reveal.data]);

  if (reveal.isPending || materialize.isPending)
    return <RevealState title="Preparando tu progreso…" />;

  if (reveal.isError) {
    const denied =
      reveal.error instanceof ApiError &&
      ["forbidden", "match_not_found"].includes(reveal.error.code);
    return (
      <RevealState
        alert
        title={
          denied
            ? "Este reveal no está disponible."
            : "No pudimos cargar tu progreso."
        }
      />
    );
  }

  if (materialize.isError)
    return (
      <RevealState alert title="No pudimos preparar el resultado.">
        <Button onClick={() => materialize.mutate()}>Reintentar</Button>
      </RevealState>
    );

  const data = reveal.data;
  if (data.status === "VOTING_OPEN")
    return (
      <RevealState title="La votación sigue abierta.">
        <Text tone="muted">
          Tu progreso estará disponible cuando cierre, a las{" "}
          {formatDate(data.votingClosesAt)}.
        </Text>
      </RevealState>
    );

  if (data.status === "PROGRESSION_PENDING") {
    const copy = {
      VOTING_NOT_STARTED: "La votación todavía no comenzó.",
      CLOSURE_INCOMPLETE: "El cierre deportivo todavía no está completo.",
      EARLIER_MATCH_PENDING:
        "Primero debe procesarse un partido anterior para conservar tu historia.",
      READY_TO_MATERIALIZE: "Preparando tu progreso…",
    }[data.reason];
    return <RevealState title={copy} />;
  }

  return (
    <AvailableReveal
      photoSrc={
        player.data?.image ? mediaContentUrl(player.data.image.url) : null
      }
      reveal={data}
    />
  );
}

function AvailableReveal({
  reveal,
  photoSrc,
}: Readonly<{ reveal: Available; photoSrc: string | null }>) {
  const [stage, setStage] = useState<Stage>("CONTEXT");
  const snapshot = reveal.snapshot;
  const noEvidence = snapshot.processingOutcome === "NO_EVIDENCE";
  const before = cardAttributes(snapshot.attributes.before);
  const after = cardAttributes(snapshot.attributes.after);

  return (
    <div className={styles.page}>
      <div className={styles.revealContext}>
        <Text as="span" variant="label">
          {reveal.context.player.displayName}
        </Text>
        <Text as="span" tone="muted" variant="metadata">
          F5 · {reveal.context.group.name}
        </Text>
      </div>
      <TacticalDivider />
      <div className={styles.stage} key={stage}>
        {stage === "CONTEXT" ? (
          <section className={styles.centerStage}>
            <Text as="span" tone="accent" variant="label">
              Partido completado
            </Text>
            <Text as="h1" className={styles.contextScore} variant="score">
              {reveal.context.result.teamAGoals} —{" "}
              {reveal.context.result.teamBGoals}
            </Text>
            <Text variant="heading-md">{reveal.context.group.name}</Text>
            {snapshot.aggregatedRating ? (
              <div className={styles.evidenceSummary}>
                <Text as="span" variant="heading-lg">
                  {Number(snapshot.aggregatedRating).toFixed(1)}
                </Text>
                <Text tone="muted" variant="metadata">
                  Rating del partido · {snapshot.receivedEvaluationCount} de{" "}
                  {snapshot.eligibleEvaluationCount} evaluaciones
                </Text>
              </div>
            ) : null}
          </section>
        ) : null}

        {stage === "BEFORE" ? (
          <CardStage
            attributes={before}
            eyebrow="Antes del partido"
            name={reveal.context.player.displayName}
            overall={Number(snapshot.overall.before)}
            photoSrc={photoSrc}
            title="Tu punto de partida"
          />
        ) : null}

        {stage === "CHANGES" ? (
          <section className={styles.attributeStage}>
            <div>
              <Text as="span" tone="accent" variant="label">
                Tu evolución
              </Text>
              <Text as="h1" variant="display-lg">
                {noEvidence ? "Partido registrado" : "Qué cambió"}
              </Text>
              {noEvidence ? (
                <Text tone="muted">
                  No hubo evaluaciones para modificar tu rendimiento. Tu OVR y
                  tus atributos se mantienen.
                </Text>
              ) : null}
            </div>
            <div className={styles.overallChange}>
              <Text as="span" tone="muted" variant="score">
                {Math.round(Number(snapshot.overall.before))}
              </Text>
              <span aria-hidden="true" className={styles.progressArrow}>
                →
              </span>
              <Text as="span" className={styles.overallAfter} variant="score">
                {Math.round(Number(snapshot.overall.after))}
              </Text>
              <Text
                as="span"
                className={deltaClass(Number(snapshot.overall.delta))}
                variant="label"
              >
                {formatDelta(snapshot.overall.delta)} OVR
              </Text>
            </div>
            <ul className={styles.attributeList}>
              {Object.keys(attributeLabels).map((key) => {
                const attribute = key as keyof typeof attributeLabels;
                const delta = Number(snapshot.attributes.delta[attribute]);
                return (
                  <li key={attribute}>
                    <Text as="span" variant="label">
                      {attributeLabels[attribute]}
                    </Text>
                    <span className={styles.attributeValues}>
                      <Text as="span" tone="muted" variant="heading-md">
                        {Math.round(before[attribute])}
                      </Text>
                      <span aria-hidden="true">→</span>
                      <Text as="span" variant="heading-md">
                        {Math.round(after[attribute])}
                      </Text>
                    </span>
                    <Text
                      as="span"
                      className={deltaClass(delta)}
                      variant="label"
                    >
                      {formatDelta(snapshot.attributes.delta[attribute])}
                    </Text>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {stage === "AFTER" ? (
          <section className={styles.cardReveal}>
            <div>
              <Text as="span" tone="accent" variant="label">
                {noEvidence ? "Rendimiento sin cambios" : "Tu nueva versión"}
              </Text>
              <Text as="h1" variant="display-lg">
                {noEvidence ? "Seguís en marcha" : "Progreso aplicado"}
              </Text>
            </div>
            <PlayerCard
              attributes={after}
              name={reveal.context.player.displayName}
              overall={Number(snapshot.overall.after)}
              photoSrc={photoSrc}
            />
            {reveal.rewards.achievements.length > 0 ||
            reveal.rewards.awards.length > 0 ? (
              <section className={styles.rewards} aria-label="Recompensas">
                {reveal.rewards.achievements.map((achievement) => (
                  <div key={achievement.type}>
                    <Text as="span" tone="accent" variant="label">
                      Nuevo logro
                    </Text>
                    <Text as="span" variant="heading-md">
                      {achievement.title}
                    </Text>
                    <Text tone="muted" variant="metadata">
                      {achievement.description}
                    </Text>
                  </div>
                ))}
                {reveal.rewards.awards.map((award) => (
                  <div key={award.type}>
                    <Text
                      as="span"
                      className={styles.rewardAward}
                      variant="label"
                    >
                      Premio del partido
                    </Text>
                    <Text as="span" variant="heading-md">
                      {award.title}
                    </Text>
                    <Text tone="muted" variant="metadata">
                      {award.description}
                    </Text>
                  </div>
                ))}
              </section>
            ) : null}
            <div className={styles.summaryActions}>
              <Link className="ui-button ui-button--primary" href="/profile">
                Ver perfil
              </Link>
              <Button onClick={() => setStage("CONTEXT")} variant="quiet">
                Ver de nuevo
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      {stage !== "AFTER" ? (
        <div className={styles.revealActions}>
          <Button onClick={() => setStage("AFTER")} variant="quiet">
            Saltar
          </Button>
          <Button onClick={() => setStage(nextStage(stage))}>Continuar</Button>
        </div>
      ) : null}
    </div>
  );
}

function CardStage({
  attributes,
  eyebrow,
  name,
  overall,
  photoSrc,
  title,
}: Readonly<{
  attributes: PlayerCardAttributes;
  eyebrow: string;
  name: string;
  overall: number;
  photoSrc: string | null;
  title: string;
}>) {
  return (
    <section className={styles.cardReveal}>
      <div>
        <Text as="span" tone="accent" variant="label">
          {eyebrow}
        </Text>
        <Text as="h1" variant="display-lg">
          {title}
        </Text>
      </div>
      <PlayerCard
        attributes={attributes}
        name={name}
        overall={overall}
        photoSrc={photoSrc}
      />
    </section>
  );
}

function RevealState({
  title,
  alert = false,
  children,
}: Readonly<{
  title: string;
  alert?: boolean;
  children?: React.ReactNode;
}>) {
  return (
    <Surface as="section" className={styles.summary} elevation="raised">
      <Text as="span" tone="accent" variant="label">
        PROGRESIÓN
      </Text>
      <Text
        as="h1"
        variant="display-lg"
        {...(alert ? { role: "alert" } : { role: "status" })}
      >
        {title}
      </Text>
      {children}
      <Link className="ui-button ui-button--secondary" href="/play">
        Volver a jugar
      </Link>
    </Surface>
  );
}

function nextStage(stage: Stage): Stage {
  return {
    CONTEXT: "BEFORE",
    BEFORE: "CHANGES",
    CHANGES: "AFTER",
    AFTER: "AFTER",
  }[stage] as Stage;
}

function cardAttributes(
  values: Record<keyof PlayerCardAttributes, string>,
): PlayerCardAttributes {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, Number(value)]),
  ) as unknown as PlayerCardAttributes;
}

function formatDelta(value: string) {
  const number = Number(value);
  if (number === 0) return "0";
  const formatted = Math.abs(number)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
  return `${number > 0 ? "+" : "−"}${formatted}`;
}

function deltaClass(value: number) {
  return value > 0
    ? styles.deltaPositive
    : value < 0
      ? styles.deltaNegative
      : styles.deltaNeutral;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
