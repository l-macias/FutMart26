"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

import type { PersonalHomeResponse } from "@football/contracts";
import { Text } from "@football/ui";

import { CompactMatch, formatMatchDate } from "@/features/play/compact-match";
import { refreshNotificationState } from "@/features/notifications/notification-state";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { queryPolicy } from "@/lib/api/query-policy";

import styles from "./global-home.module.css";

type AttentionItem = PersonalHomeResponse["attention"]["items"][number];

export function GlobalHomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const home = useQuery({
    ...queryPolicy.volatile,
    queryKey: queryKeys.personalHome,
    queryFn: api.personalHome,
  });
  const markRead = useMutation({
    mutationFn: (item: AttentionItem) => api.markNotificationRead(item.id),
    onSuccess: async (_, item) => {
      await refreshNotificationState(queryClient);
      router.push(item.target.href);
    },
  });

  if (home.isPending)
    return (
      <div className={styles.page}>
        <p role="status">Preparando tu inicio…</p>
      </div>
    );
  if (home.isError)
    return (
      <div className={styles.page}>
        <p role="alert">No pudimos cargar tu inicio.</p>
        <Link href="/play">Ir a jugar</Link>
      </div>
    );

  const data = home.data;
  const hasNothingImmediate =
    !data.currentOrNextMatch &&
    data.attention.items.length === 0 &&
    data.opportunities.items.length === 0;

  function openAttention(
    event: MouseEvent<HTMLAnchorElement>,
    item: AttentionItem,
  ) {
    event.preventDefault();
    markRead.mutate(item);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Text as="span" tone="accent" variant="label">
            INICIO
          </Text>
          <Text as="h1" variant="display-lg">
            Hola, {data.player.displayName}.
          </Text>
        </div>
        <Text className={styles.context} tone="muted">
          {contextLine(data, hasNothingImmediate)}
        </Text>
      </header>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          {data.currentOrNextMatch ? (
            <CompactMatch match={data.currentOrNextMatch} />
          ) : (
            <section className={styles.compactEmpty}>
              <Text as="h2" variant="heading-lg">
                No tenés próximos partidos.
              </Text>
              <Link className={styles.primaryAction} href="/play">
                BUSCAR PARTIDO →
              </Link>
            </section>
          )}

          <section className={styles.section} aria-labelledby="attention-title">
            <div className={styles.sectionHeader}>
              <Text as="h2" id="attention-title" variant="heading-lg">
                Necesita tu atención
              </Text>
              <Link href="/notifications">Ver todas</Link>
            </div>
            {!data.attention.available ? (
              <Text tone="muted" role="alert">
                No pudimos cargar tus pendientes.
              </Text>
            ) : data.attention.items.length === 0 ? (
              <Text tone="muted">No tenés nada pendiente.</Text>
            ) : (
              <ol className={`${styles.rows} ui-list`}>
                {data.attention.items.map((item) => (
                  <li className="ui-row" key={item.id}>
                    <Link
                      aria-label={`${item.title}. Abrir`}
                      className={styles.rowLink}
                      href={item.target.href}
                      onClick={(event) => openAttention(event, item)}
                    >
                      <span
                        className={styles.attentionLead}
                        aria-hidden="true"
                      />
                      <span className="ui-row__content">
                        <strong className="ui-row__primary">
                          {item.title}
                        </strong>
                        <small className="ui-row__secondary">{item.body}</small>
                      </span>
                      <span className={styles.chevron} aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
            {markRead.isError ? (
              <Text tone="muted" role="alert">
                No pudimos actualizar la notificación. Intentá nuevamente.
              </Text>
            ) : null}
          </section>

          <section
            className={styles.section}
            aria-labelledby="opportunities-title"
          >
            <div className={styles.sectionHeader}>
              <div>
                <Text tone="accent" variant="label">
                  PARA VOS
                </Text>
                <Text as="h2" id="opportunities-title" variant="heading-lg">
                  Partidos buscando jugadores
                </Text>
              </div>
              <Link href="/play">Ver más en Jugar</Link>
            </div>
            {!data.opportunities.available ? (
              <Text tone="muted" role="alert">
                No pudimos cargar las oportunidades.
              </Text>
            ) : data.opportunities.items.length === 0 ? (
              <Text tone="muted">
                No hay partidos buscando jugadores ahora.
              </Text>
            ) : (
              <ol className={`${styles.rows} ui-list`}>
                {data.opportunities.items.map((item) => (
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
                      <span className={styles.openSpots}>
                        FALTAN {item.openSpots}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside
          className={styles.personalContext}
          aria-label="Tu nivel y posición"
        >
          <section>
            <Text tone="accent" variant="label">
              TU PROGRESO
            </Text>
            <strong>{Math.round(data.progress.overall)} OVR</strong>
            <Text tone="muted" variant="metadata">
              {data.progress.processedMatchCount} partidos procesados
            </Text>
            <Link href="/profile/progression">Ver historial →</Link>
          </section>
          <section>
            <Text tone="accent" variant="label">
              TU POSICIÓN GLOBAL
            </Text>
            <strong>
              {data.globalPosition.ranked
                ? `#${data.globalPosition.position}`
                : "—"}
            </strong>
            <Text tone="muted" variant="metadata">
              {data.globalPosition.ranked
                ? `${Math.round(Number(data.globalPosition.overall))} OVR`
                : "Jugá un partido procesado para entrar"}
            </Text>
            <Link href="/rankings?scope=global">Ver rankings →</Link>
          </section>
        </aside>
      </div>
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

function contextLine(data: PersonalHomeResponse, empty: boolean) {
  if (data.currentOrNextMatch?.status === "STARTED")
    return "Tenés un partido en juego.";
  if (data.currentOrNextMatch) return "Tu próximo partido ya está marcado.";
  if (data.attention.items.length > 0)
    return `${data.attention.items.length} ${data.attention.items.length === 1 ? "cosa requiere" : "cosas requieren"} tu atención.`;
  if (empty)
    return "No tenés nada pendiente. La cancha está lista cuando vos quieras.";
  return "Esto es lo más importante para vos ahora.";
}
