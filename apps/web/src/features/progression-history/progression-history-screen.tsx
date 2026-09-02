"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";

import type { ProgressionHistoryEntry } from "@football/contracts";
import { TacticalDivider } from "@football/football-ui";
import { Button, Surface, Text } from "@football/ui";

import { PlayerCard } from "@/components/player-card/player-card";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { mediaContentUrl } from "@/lib/api/client";

import styles from "./progression-history.module.css";

const attributeLabels = {
  VELOCIDAD: "Velocidad",
  PASE: "Pase",
  REGATE: "Regate",
  REMATE: "Remate",
  DEFENSA: "Defensa",
  FISICO: "Físico",
} as const;

export function ProgressionHistoryScreen() {
  const player = useQuery({ queryKey: queryKeys.me, queryFn: api.me });
  const performance = useQuery({
    queryKey: queryKeys.performance,
    queryFn: api.performance,
  });
  const history = useInfiniteQuery({
    queryKey: queryKeys.progressionHistory,
    queryFn: ({ pageParam }) => api.progressionHistory(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  if (player.isPending || performance.isPending || history.isPending)
    return <PageState title="Recuperando tu historia F5…" />;

  if (player.isError || performance.isError || history.isError)
    return <PageState alert title="No pudimos cargar tu progresión." />;

  const items = uniqueEntries(history.data.pages.flatMap((page) => page.items));

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <Text as="span" tone="accent" variant="label">
          Progresión F5
        </Text>
        <Text as="h1" variant="display-lg">
          Tu recorrido
        </Text>
        <Text tone="muted">
          Cada punto pertenece a un partido procesado y conserva su snapshot
          histórico.
        </Text>
      </header>

      <section className={styles.currentState}>
        <div className={styles.currentCard}>
          <PlayerCard
            attributes={performance.data.attributes}
            name={player.data.displayName}
            overall={performance.data.overall}
            photoSrc={
              player.data.image ? mediaContentUrl(player.data.image.url) : null
            }
          />
        </div>
        <div className={styles.currentSummary}>
          <Text as="span" tone="accent" variant="label">
            Estado actual
          </Text>
          <Text as="h2" variant="display-lg">
            {Math.round(performance.data.overall)} OVR
          </Text>
          <dl>
            <div>
              <dt>Partidos procesados</dt>
              <dd>{performance.data.processedMatchCount}</dd>
            </div>
            <div>
              <dt>Disciplina</dt>
              <dd>F5</dd>
            </div>
          </dl>
        </div>
      </section>

      <TacticalDivider />

      {items.length === 0 ? (
        <Surface className={styles.emptyState}>
          <Text as="h2" variant="heading-lg">
            Tu historia empieza con el próximo partido
          </Text>
          <Text tone="muted">
            Cuando se procese tu primera progresión, aparecerá acá aunque no
            haya cambios de OVR.
          </Text>
          <Link className="ui-button ui-button--primary" href="/play">
            Ir a jugar
          </Link>
        </Surface>
      ) : (
        <>
          <section className={styles.evolution}>
            <div>
              <Text as="span" tone="accent" variant="label">
                Evolución OVR
              </Text>
              <Text as="h2" variant="heading-lg">
                Trayectoria cargada
              </Text>
            </div>
            <OverallChart items={items} />
          </section>

          <TacticalDivider />

          <section className={styles.historySection}>
            <div>
              <Text as="span" tone="accent" variant="label">
                Partido a partido
              </Text>
              <Text as="h2" variant="heading-lg">
                Historial
              </Text>
            </div>
            <ol className={styles.timeline}>
              {items.map((item) => (
                <HistoryItem item={item} key={item.context.matchId} />
              ))}
            </ol>
            {history.hasNextPage ? (
              <Button
                disabled={history.isFetchingNextPage}
                onClick={() => void history.fetchNextPage()}
                variant="secondary"
              >
                {history.isFetchingNextPage ? "Cargando…" : "Cargar más"}
              </Button>
            ) : null}
            {history.isFetchNextPageError ? (
              <p className={styles.negative} role="alert">
                No pudimos cargar más partidos. Intentá nuevamente.
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

function OverallChart({
  items,
}: Readonly<{ items: ProgressionHistoryEntry[] }>) {
  const chronological = [...items].reverse();
  const values = chronological.map((item) =>
    Number(item.snapshot.overall.after),
  );
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = 24;
  const width = 720;
  const height = 220;
  const range = Math.max(maximum - minimum, 1);
  const points = values.map((value, index) => ({
    x:
      values.length === 1
        ? width / 2
        : padding + (index / (values.length - 1)) * (width - padding * 2),
    y: padding + ((maximum - value) / range) * (height - padding * 2),
    value,
  }));

  return (
    <div className={styles.chartFrame}>
      <svg
        aria-hidden="true"
        className={styles.chart}
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          x1={padding}
          x2={width - padding}
          y1={height - padding}
          y2={height - padding}
        />
        {points.length > 1 ? (
          <polyline
            fill="none"
            points={points.map((point) => `${point.x},${point.y}`).join(" ")}
          />
        ) : null}
        {points.map((point, index) => (
          <circle cx={point.x} cy={point.y} key={index} r="6" />
        ))}
      </svg>
      <div className={styles.chartLegend}>
        <span>
          {formatShortDate(chronological[0]!.context.scheduledAt)} · OVR{" "}
          {formatOverall(points[0]!.value)}
        </span>
        {chronological.length > 1 ? (
          <span>
            {formatShortDate(chronological.at(-1)!.context.scheduledAt)} · OVR{" "}
            {formatOverall(points.at(-1)!.value)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function HistoryItem({ item }: Readonly<{ item: ProgressionHistoryEntry }>) {
  const noEvidence = item.snapshot.processingOutcome === "NO_EVIDENCE";
  const changes = Object.entries(item.snapshot.attributes.delta).filter(
    ([, value]) => Math.abs(Number(value)) >= 0.005,
  ) as [keyof typeof attributeLabels, string][];

  return (
    <li>
      <span aria-hidden="true" className={styles.timelineNode} />
      <article className={styles.historyItem}>
        <header>
          <div>
            <time dateTime={item.context.scheduledAt}>
              <Text as="span" variant="label">
                {formatDate(item.context.scheduledAt)}
              </Text>
            </time>
            <Text as="h3" variant="heading-md">
              {item.context.group.name}
            </Text>
          </div>
          <Text as="span" variant="heading-md">
            {item.context.result.teamAGoals} — {item.context.result.teamBGoals}
          </Text>
        </header>

        <div className={styles.overallLine}>
          <span>
            <Text as="span" tone="muted" variant="metadata">
              OVR
            </Text>
            <Text
              as="span"
              className={styles.overallValue}
              variant="heading-lg"
            >
              {formatOverall(item.snapshot.overall.before)} →{" "}
              {formatOverall(item.snapshot.overall.after)}
            </Text>
          </span>
          <Text
            as="span"
            className={deltaClass(Number(item.snapshot.overall.delta))}
            variant="label"
          >
            {formatDelta(item.snapshot.overall.delta)}
          </Text>
        </div>

        {noEvidence ? (
          <Text className={styles.noEvidence} tone="muted" variant="metadata">
            Partido registrado · sin evaluaciones suficientes para modificar tu
            rendimiento.
          </Text>
        ) : (
          <Text tone="muted" variant="metadata">
            Rating {Number(item.snapshot.aggregatedRating).toFixed(1)} ·{" "}
            {item.snapshot.receivedEvaluationCount} de{" "}
            {item.snapshot.eligibleEvaluationCount} evaluaciones ·{" "}
            {Math.round(Number(item.snapshot.participationRatio) * 100)}%
            participación
          </Text>
        )}

        {changes.length > 0 ? (
          <ul className={styles.attributeChanges}>
            {changes.map(([attribute, delta]) => (
              <li key={attribute}>
                {attributeLabels[attribute]} {formatDelta(delta)}
              </li>
            ))}
          </ul>
        ) : null}

        <Link
          className={styles.revealLink}
          href={`/play/matches/${item.context.matchId}/progression`}
        >
          Ver reveal histórico
        </Link>
      </article>
    </li>
  );
}

function PageState({
  alert,
  title,
}: Readonly<{ alert?: boolean; title: string }>) {
  return (
    <div className={styles.page}>
      <Text as="h1" role={alert ? "alert" : "status"} variant="heading-lg">
        {title}
      </Text>
    </div>
  );
}

function uniqueEntries(items: ProgressionHistoryEntry[]) {
  return [
    ...new Map(items.map((item) => [item.context.matchId, item])).values(),
  ];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatOverall(value: string | number) {
  return Number(value).toFixed(1);
}

function formatDelta(value: string) {
  const number = Number(value);
  if (Math.abs(number) < 0.005) return "0.00";
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}`;
}

function deltaClass(value: number) {
  if (value > 0) return styles.positive;
  if (value < 0) return styles.negative;
  return styles.neutral;
}
