"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type KeyboardEvent } from "react";

import type { PersonalMatch } from "@football/contracts";
import { MatchStateMark } from "@football/football-ui";
import { Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { CompactMatch, formatMatchDate } from "./compact-match";
import styles from "./play.module.css";

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
    <div className={styles.page}>
      <header className={styles.intro}>
        <div>
          <Text as="span" tone="accent" variant="label">
            JUGAR
          </Text>
          <Text as="h1" variant="display-lg">
            Tus partidos.
          </Text>
        </div>
        <Text className={styles.context} tone="muted">
          Cuándo jugás y dónde todavía hay lugar.
        </Text>
      </header>

      {highlighted ? (
        <CompactMatch match={highlighted} />
      ) : (
        <section className={styles.compactEmpty}>
          <Text as="h2" variant="heading-lg">
            No tenés partidos todavía.
          </Text>
          <Text tone="muted">
            Explorá las convocatorias abiertas o revisá tus grupos.
          </Text>
        </section>
      )}

      <section className={styles.section} aria-labelledby="opportunities-title">
        <div className={styles.sectionHeader}>
          <div>
            <Text tone="accent" variant="label">
              BUSCAN JUGADORES
            </Text>
            <Text as="h2" id="opportunities-title" variant="heading-lg">
              Partidos con lugar
            </Text>
          </div>
          <Link href="/groups">Ver mis grupos</Link>
        </div>
        {opportunities.isPending ? (
          <Text tone="muted">Buscando convocatorias…</Text>
        ) : opportunities.isError ? (
          <Text tone="muted" role="alert">
            No pudimos cargar las oportunidades.
          </Text>
        ) : opportunities.data.pages[0]?.items.length === 0 ? (
          <Text tone="muted">No hay partidos buscando jugadores ahora.</Text>
        ) : (
          <ol className={`${styles.rows} ui-list`}>
            {opportunities.data.pages
              .flatMap((page) => page.items)
              .map((item) => (
                <li className="ui-row" key={item.matchId}>
                  <Link
                    className={styles.rowLink}
                    href={`/play/matches/${item.matchId}`}
                  >
                    <span className={styles.matchDate} aria-hidden="true">
                      {formatShortDay(new Date(item.scheduledAt))}
                    </span>
                    <span className="ui-row__content">
                      <strong className="ui-row__primary">
                        {item.group.name}
                      </strong>
                      <small className="ui-row__secondary">
                        {formatMatchDate(new Date(item.scheduledAt))} ·{" "}
                        {item.venue?.displayName ?? item.locationText}
                      </small>
                    </span>
                    <span className={styles.spots}>
                      FALTAN {item.openSpots}
                    </span>
                  </Link>
                </li>
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
            {opportunities.isFetchingNextPage ? "CARGANDO…" : "CARGAR MÁS"}
          </button>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="my-matches-title">
        <Text as="h2" id="my-matches-title" variant="heading-lg">
          Mis partidos
        </Text>
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
        <div id="my-matches-panel" role="tabpanel">
          {selectedMatches.length === 0 ? (
            <Text className={styles.inlineEmpty} tone="muted">
              {matchView === "upcoming"
                ? highlighted
                  ? "No tenés otros partidos programados."
                  : "No tenés próximos partidos."
                : "Todavía no tenés partidos en el historial."}
            </Text>
          ) : (
            <MatchRows matches={selectedMatches} />
          )}
        </div>
      </section>
    </div>
  );
}

function MatchRows({ matches }: Readonly<{ matches: PersonalMatch[] }>) {
  return (
    <ol className={`${styles.rows} ui-list`}>
      {matches.map((match) => (
        <li className="ui-row" key={match.id}>
          <Link className={styles.rowLink} href={`/play/matches/${match.id}`}>
            <span className={styles.matchDate} aria-hidden="true">
              {formatShortDay(new Date(match.scheduledAt))}
            </span>
            <span className="ui-row__content">
              <strong className="ui-row__primary">{match.group.name}</strong>
              <small className="ui-row__secondary">
                {formatMatchDate(new Date(match.scheduledAt))} ·{" "}
                {match.venue?.displayName ?? match.locationText}
                {match.participation
                  ? ` · ${participationLabel(match.participation.status)}`
                  : ""}
              </small>
            </span>
            {match.result ? (
              <span className={styles.score}>
                {match.result.teamAGoals} — {match.result.teamBGoals}
              </span>
            ) : (
              <MatchStateMark tone={statusTone(match.status)}>
                {statusLabel(match.status)}
              </MatchStateMark>
            )}
          </Link>
        </li>
      ))}
    </ol>
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

function participationLabel(status: "CONFIRMED" | "WAITLISTED") {
  return status === "CONFIRMED" ? "Estás anotado" : "Lista de espera";
}

function statusLabel(status: PersonalMatch["status"]) {
  if (status === "OPEN") return "Convocatoria";
  if (status === "STARTED") return "En juego";
  if (status === "FINISHED") return "Finalizado";
  if (status === "CANCELLED") return "Cancelado";
  return "Borrador";
}

function statusTone(status: PersonalMatch["status"]): "positive" | "warning" {
  return status === "CANCELLED" || status === "DRAFT" ? "warning" : "positive";
}
