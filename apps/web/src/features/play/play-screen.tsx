"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type KeyboardEvent } from "react";

import type { PersonalMatch } from "@football/contracts";
import { MatchStateMark } from "@football/football-ui";
import { Text } from "@football/ui";

import { V4GroupCrest } from "@/components/visual-v4/profile-assets";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import { CompactMatch, formatMatchDate } from "./compact-match";
import styles from "./play.module.css";

type Opportunity = Awaited<
  ReturnType<typeof api.recruitmentOpportunities>
>["items"][number];

export function PlayScreen() {
  const [matchView, setMatchView] = useState<"upcoming" | "history">(
    "upcoming",
  );
  const matches = useQuery({
    queryKey: queryKeys.personalMatches(10, 10),
    queryFn: () => api.personalMatches(10, 10),
  });
  const opportunities = useInfiniteQuery({
    queryKey: queryKeys.recruitmentOpportunities,
    queryFn: ({ pageParam }) => api.recruitmentOpportunities(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  if (matches.isPending)
    return (
      <div className={styles.page}>
        <p role="status">Preparando tus partidos…</p>
      </div>
    );
  if (matches.isError)
    return (
      <div className={styles.page}>
        <p role="alert">No pudimos cargar tus partidos.</p>
      </div>
    );

  const highlighted = matches.data.current ?? matches.data.upcoming[0] ?? null;
  const upcoming = matches.data.current
    ? matches.data.upcoming
    : matches.data.upcoming.slice(1);
  const selectedMatches =
    matchView === "upcoming" ? upcoming : matches.data.history;
  const availableOpportunities =
    opportunities.data?.pages.flatMap((page) => page.items) ?? [];

  function navigateMatchTabs(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    const nextView =
      event.key === "ArrowLeft" || event.key === "Home"
        ? "upcoming"
        : "history";
    setMatchView(nextView);
    const tabs =
      event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
        '[role="tab"]',
      );
    tabs?.[nextView === "upcoming" ? 0 : 1]?.focus();
  }

  return (
    <div className={`${styles.page} ui-visual-v4`}>
      <header className={styles.intro}>
        <img
          alt=""
          className={styles.introScene}
          src="/fifar-v4/backgrounds-raster/night-pitch.webp"
        />
        <div className={styles.introCopy}>
          <Text as="span" tone="accent" variant="label">
            CENTRO DE PARTIDOS · F5
          </Text>
          <Text as="h1" variant="display-lg">
            Jugar
          </Text>
          <Text className={styles.context} tone="muted">
            Tu próxima cancha y las convocatorias abiertas.
          </Text>
        </div>
        <strong className={styles.playMark} aria-hidden="true">
          05
        </strong>
      </header>

      {highlighted ? (
        <CompactMatch match={highlighted} />
      ) : (
        <PlayEmptyFeature />
      )}

      <div className={styles.playGrid}>
        <div className={styles.discoveryColumn}>
          <section
            className={styles.opportunitySection}
            aria-labelledby="opportunities-title"
          >
            <div className={styles.sectionHeader}>
              <div>
                <Text tone="accent" variant="label">
                  CANCHAS ABIERTAS
                </Text>
                <Text as="h2" id="opportunities-title" variant="heading-lg">
                  Buscan jugadores
                </Text>
              </div>
              <Link href="/groups">Mis grupos →</Link>
            </div>
            {opportunities.isPending ? (
              <OpportunityLoading />
            ) : opportunities.isError ? (
              <Text className={styles.localState} tone="muted" role="alert">
                No pudimos cargar las oportunidades.
              </Text>
            ) : availableOpportunities.length === 0 ? (
              <OpportunityEmpty />
            ) : (
              <ol className={styles.opportunityGrid}>
                {availableOpportunities.map((item, index) => (
                  <OpportunityCard
                    featured={index === 0}
                    item={item}
                    key={item.matchId}
                  />
                ))}
              </ol>
            )}
            {opportunities.hasNextPage ? (
              <button
                className={styles.loadMore}
                disabled={opportunities.isFetchingNextPage}
                onClick={() => void opportunities.fetchNextPage()}
                type="button"
              >
                {opportunities.isFetchingNextPage
                  ? "CARGANDO…"
                  : "CARGAR MÁS PARTIDOS"}
              </button>
            ) : null}
          </section>
        </div>

        <aside className={styles.scheduleColumn}>
          <section
            className={styles.scheduleSection}
            aria-labelledby="my-matches-title"
          >
            <div className={styles.scheduleHeading}>
              <div>
                <Text tone="accent" variant="label">
                  TU AGENDA
                </Text>
                <Text as="h2" id="my-matches-title" variant="heading-lg">
                  Tus partidos.
                </Text>
              </div>
              <div
                className={styles.tabs}
                aria-label="Vista de mis partidos"
                role="tablist"
              >
                <button
                  aria-controls="my-matches-panel"
                  aria-selected={matchView === "upcoming"}
                  onKeyDown={navigateMatchTabs}
                  onClick={() => setMatchView("upcoming")}
                  role="tab"
                  tabIndex={matchView === "upcoming" ? 0 : -1}
                  type="button"
                >
                  PRÓXIMOS
                </button>
                <button
                  aria-controls="my-matches-panel"
                  aria-selected={matchView === "history"}
                  onKeyDown={navigateMatchTabs}
                  onClick={() => setMatchView("history")}
                  role="tab"
                  tabIndex={matchView === "history" ? 0 : -1}
                  type="button"
                >
                  HISTORIAL
                </button>
              </div>
            </div>
            <div id="my-matches-panel" role="tabpanel">
              {selectedMatches.length === 0 ? (
                <p className={styles.scheduleEmpty}>
                  {matchView === "upcoming"
                    ? highlighted
                      ? "No tenés otros partidos programados."
                      : "No tenés próximos partidos."
                    : "Todavía no tenés partidos en el historial."}
                </p>
              ) : (
                <MatchDeck matches={selectedMatches} view={matchView} />
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function OpportunityCard({
  featured,
  item,
}: Readonly<{ featured: boolean; item: Opportunity }>) {
  const date = new Date(item.scheduledAt);
  const needs = item.needs.slice(0, 2);
  return (
    <li
      className={styles.opportunityItem}
      data-featured={featured ? "true" : undefined}
      data-profile-match={item.matchesMyProfile ? "true" : undefined}
    >
      <Link
        className={styles.opportunityCard}
        href={`/play/matches/${item.matchId}`}
      >
        <span className={styles.opportunityScene} aria-hidden="true" />
        <header className={styles.opportunityTopline}>
          <V4GroupCrest
            name={item.group.name}
            seed={item.group.id}
            size="compact"
          />
          <span>
            {item.matchesMyProfile
              ? "COINCIDE CON TU PERFIL"
              : featured
                ? "OPORTUNIDAD DESTACADA"
                : "CONVOCATORIA F5"}
          </span>
          <time dateTime={item.scheduledAt}>{formatShortDay(date)}</time>
        </header>
        <div className={styles.opportunityIdentity}>
          <strong>{item.group.name}</strong>
          <span>{formatMatchDate(date)}</span>
          <small>{item.venue?.displayName ?? item.locationText}</small>
        </div>
        {needs.length > 0 ? (
          <div className={styles.needList} aria-label="Necesidades del partido">
            {needs.map((need) => (
              <span key={need.role}>
                {need.quantity}× {roleLabel(need.role)}
              </span>
            ))}
          </div>
        ) : null}
        <footer className={styles.opportunityFooter}>
          <strong>
            {item.openSpots}
            <small>{item.openSpots === 1 ? "LUGAR" : "LUGARES"}</small>
          </strong>
          <span>VER PARTIDO →</span>
        </footer>
      </Link>
    </li>
  );
}

function MatchDeck({
  matches,
  view,
}: Readonly<{
  matches: PersonalMatch[];
  view: "upcoming" | "history";
}>) {
  return (
    <ol className={styles.matchDeck} data-view={view}>
      {matches.map((match) => (
        <li key={match.id}>
          <Link
            className={styles.personalMatch}
            data-phase={match.effectivePhase}
            href={`/play/matches/${match.id}`}
          >
            <span className={styles.personalMatchScene} aria-hidden="true" />
            <V4GroupCrest
              name={match.group.name}
              seed={match.group.id}
              size="compact"
            />
            <time dateTime={match.scheduledAt}>
              <strong>{formatShortDay(new Date(match.scheduledAt))}</strong>
              <small>{formatShortTime(new Date(match.scheduledAt))}</small>
            </time>
            <span className={styles.personalMatchIdentity}>
              <strong>{match.group.name}</strong>
              <small>
                {match.venue?.displayName ?? match.locationText}
                {match.participation
                  ? ` · ${participationLabel(match.participation.status)}`
                  : ""}
              </small>
            </span>
            {match.result ? (
              <strong className={styles.score}>
                {match.result.teamAGoals}
                <span>—</span>
                {match.result.teamBGoals}
              </strong>
            ) : (
              <MatchStateMark tone={statusTone(match.effectivePhase)}>
                {statusLabel(match.effectivePhase)}
              </MatchStateMark>
            )}
          </Link>
        </li>
      ))}
    </ol>
  );
}

function PlayEmptyFeature() {
  return (
    <section className={styles.emptyFeature}>
      <span aria-hidden="true" />
      <div>
        <Text tone="accent" variant="label">
          TU PRÓXIMA FECHA
        </Text>
        <Text as="h2" variant="display-lg">
          La cancha está esperando.
        </Text>
        <Text tone="muted">
          Explorá convocatorias abiertas o revisá tus grupos.
        </Text>
        <Link className="ui-button ui-button--primary" href="/groups">
          VER MIS GRUPOS
        </Link>
      </div>
    </section>
  );
}

function OpportunityEmpty() {
  return (
    <div className={styles.opportunityEmpty}>
      <span aria-hidden="true" />
      <div>
        <strong>No hay convocatorias abiertas ahora.</strong>
        <small>Revisá tus grupos para organizar la próxima fecha.</small>
      </div>
      <Link href="/groups">IR A GRUPOS →</Link>
    </div>
  );
}

function OpportunityLoading() {
  return (
    <div className={styles.opportunityLoading} role="status">
      <span />
      <span />
      <span />
      <p>Buscando convocatorias…</p>
    </div>
  );
}

function formatShortDay(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replace(".", "")
    .toUpperCase();
}

function formatShortTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function participationLabel(status: "CONFIRMED" | "WAITLISTED") {
  return status === "CONFIRMED" ? "Estás anotado" : "Lista de espera";
}

function roleLabel(role: Opportunity["needs"][number]["role"]) {
  const labels = {
    PORTERO: "PORTERO",
    DEFENSIVO: "DEFENSA",
    MEDIO: "MEDIO",
    OFENSIVO: "ATAQUE",
    LIBRE: "LIBRE",
  } as const;
  return labels[role];
}

function statusLabel(status: PersonalMatch["effectivePhase"]) {
  if (status === "OPEN") return "Convocatoria";
  if (status === "IN_PROGRESS") return "En juego";
  if (status === "AWAITING_RESULT") return "Esperando resultado";
  if (status === "VOTING_OPEN") return "Votación abierta";
  if (status === "FINISHED") return "Finalizado";
  if (status === "CANCELLED") return "Cancelado";
  return "Borrador";
}

function statusTone(
  status: PersonalMatch["effectivePhase"],
): "positive" | "warning" {
  return status === "CANCELLED" ||
    status === "DRAFT" ||
    status === "AWAITING_RESULT"
    ? "warning"
    : "positive";
}
