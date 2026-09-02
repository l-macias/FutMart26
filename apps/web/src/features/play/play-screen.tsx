"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { MatchStateMark, TacticalDivider } from "@football/football-ui";
import { Surface, Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import styles from "./play.module.css";

type Match = Awaited<
  ReturnType<typeof api.personalMatches>
>["upcoming"][number];

export function PlayScreen() {
  const matches = useQuery({
    queryKey: queryKeys.personalMatches(5, 4),
    queryFn: () => api.personalMatches(5, 4),
  });
  const opportunities = useInfiniteQuery({
    queryKey: queryKeys.recruitmentOpportunities,
    queryFn: ({ pageParam }) => api.recruitmentOpportunities(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  if (matches.isPending) {
    return (
      <div className={styles.page}>
        <p role="status">Preparando tus partidos…</p>
      </div>
    );
  }

  if (matches.isError) {
    return (
      <div className={styles.page}>
        <p role="alert">No pudimos cargar tus partidos.</p>
      </div>
    );
  }

  const upcoming = matches.data.upcoming;
  const nextMatch = upcoming[0] ?? null;
  const laterMatches = upcoming.slice(1, 5);
  const recentMatches = matches.data.recent;

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <Text as="span" tone="accent" variant="label">
          Jugar
        </Text>
        <Text as="h1" variant="display-lg">
          Lo que viene.
        </Text>
        <Text tone="muted" variant="body">
          Tus partidos reales, en un solo lugar.
        </Text>
      </header>

      <>
        <>
          {nextMatch ? (
            <RealNextMatch match={nextMatch} />
          ) : (
            <Surface
              as="section"
              className={styles.nextMatch}
              elevation="raised"
            >
              <div className={styles.matchHeading}>
                <Text tone="accent" variant="label">
                  PRÓXIMO PARTIDO
                </Text>
                <Text as="h2" variant="heading-lg">
                  No tenés partidos próximos.
                </Text>
                <Text tone="muted">
                  Cuando un grupo publique una nueva convocatoria aparecerá acá.
                </Text>
              </div>
              <div className={styles.matchActions}>
                <Link className={styles.primaryLink} href="/groups">
                  VER MIS GRUPOS <span aria-hidden="true">→</span>
                </Link>
              </div>
            </Surface>
          )}

          <TacticalDivider />

          <section className={styles.upcoming}>
            <Text as="h2" variant="heading-lg">
              Partidos que buscan jugadores
            </Text>
            {opportunities.isPending && (
              <Text tone="muted">Buscando convocatorias…</Text>
            )}
            {opportunities.isError && (
              <Text tone="muted" role="alert">
                No pudimos cargar las oportunidades.
              </Text>
            )}
            <ol className={styles.upcomingList}>
              {opportunities.data?.pages
                .flatMap((page) => page.items)
                .map((item, index) => (
                  <li className={styles.upcomingRow} key={item.matchId}>
                    <span className={styles.matchIndex}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <Text as="h3" variant="heading-md">
                        <Link href={`/play/matches/${item.matchId}`}>
                          {item.group.name}
                        </Link>
                      </Text>
                      <Text tone="muted" variant="metadata">
                        Faltan {item.openSpots} ·{" "}
                        {item.needs
                          .map((need) => `${need.quantity} ${need.role}`)
                          .join(" · ") || "sin rol específico"}
                      </Text>
                      {item.matchesMyProfile && (
                        <Text tone="accent" variant="label">
                          COINCIDE CON TU PERFIL
                        </Text>
                      )}
                    </div>
                  </li>
                ))}
            </ol>
            {opportunities.data?.pages[0]?.items.length === 0 && (
              <Text tone="muted">
                No hay partidos buscando jugadores ahora.
              </Text>
            )}
            {opportunities.hasNextPage && (
              <button
                className={styles.primaryLink}
                onClick={() => void opportunities.fetchNextPage()}
                type="button"
              >
                CARGAR MÁS
              </button>
            )}
          </section>

          <TacticalDivider />

          <div className={styles.secondaryZone}>
            <MatchList
              empty="No hay otros partidos programados."
              matches={laterMatches}
              title="Próximos partidos"
            />
            <MatchList
              empty="Todavía no hay actividad reciente."
              matches={recentMatches}
              title="Actividad reciente"
            />
          </div>
        </>
      </>
    </div>
  );
}

function RealNextMatch({ match }: Readonly<{ match: Match }>) {
  const date = new Date(match.scheduledAt);
  const location = [
    match.venue?.displayName ?? match.locationText,
    match.court?.displayName,
    match.venue?.city,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Surface as="section" className={styles.nextMatch} elevation="raised">
      <span aria-hidden="true" className={styles.pitchStripe} />
      <div className={styles.matchHeading}>
        <Text as="span" tone="accent" variant="label">
          Próximo partido
        </Text>
        <Text as="p" className={styles.matchTime} variant="display-lg">
          {formatMatchDate(date)}
        </Text>
        <Text as="h2" variant="heading-lg">
          {match.group.name}
        </Text>
        <Text tone="muted" variant="metadata">
          F5 · {match.durationMinutes} min{location ? ` · ${location}` : ""}
        </Text>
      </div>

      <div className={styles.registrationState}>
        <Text as="span" variant="heading-md">
          {match.confirmedCount} / {match.capacity}
        </Text>
        <MatchStateMark tone={match.status === "OPEN" ? "positive" : "warning"}>
          {match.status === "OPEN" ? "Convocatoria" : "Borrador"}
        </MatchStateMark>
      </div>

      <div className={styles.matchActions}>
        <Link className={styles.primaryLink} href={`/play/matches/${match.id}`}>
          VER PARTIDO <span aria-hidden="true">→</span>
        </Link>
      </div>
    </Surface>
  );
}

function MatchList({
  empty,
  matches,
  title,
}: Readonly<{
  empty: string;
  matches: Match[];
  title: string;
}>) {
  return (
    <section className={styles.upcoming}>
      <Text as="h2" variant="heading-lg">
        {title}
      </Text>
      {matches.length === 0 ? (
        <Text tone="muted">{empty}</Text>
      ) : (
        <ol className={styles.upcomingList}>
          {matches.map((match, index) => (
            <li className={styles.upcomingRow} key={match.id}>
              <span className={styles.matchIndex}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <Text as="span" tone="muted" variant="metadata">
                  {formatMatchDate(new Date(match.scheduledAt))}
                </Text>
                <Text as="h3" variant="heading-md">
                  <Link href={`/play/matches/${match.id}`}>
                    {match.group.name}
                  </Link>
                </Text>
              </div>
              <MatchStateMark tone={toneForStatus(match.status)}>
                {labelForStatus(match.status)}
              </MatchStateMark>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function labelForStatus(status: Match["status"]) {
  switch (status) {
    case "DRAFT":
      return "Borrador";
    case "OPEN":
      return "Convocatoria";
    case "STARTED":
      return "En juego";
    case "FINISHED":
      return "Finalizado";
    case "CANCELLED":
      return "Cancelado";
  }
}

function toneForStatus(status: Match["status"]): "positive" | "warning" {
  return status === "DRAFT" ? "warning" : "positive";
}

function formatMatchDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
