"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

import type { PersonalHomeResponse, PersonalMatch } from "@football/contracts";
import { Text } from "@football/ui";

import { OvrPlate } from "@/components/visual-v3/ovr-plate";
import {
  V4GroupCrest,
  V4Portrait,
  V4RewardBadge,
} from "@/components/visual-v4/profile-assets";
import { getPlayerCardTier } from "@/components/player-card/player-card-tier";
import { formatMatchDate } from "@/features/play/compact-match";
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
    <div className={`${styles.page} ui-visual-v4`}>
      <header className={styles.header}>
        <div className={styles.greeting}>
          <Text as="span" tone="accent" variant="label">
            TU CANCHA · HOY
          </Text>
          <Text as="h1" variant="display-lg">
            Hola, <strong>{data.player.displayName}</strong>
          </Text>
          <Text className={styles.context} tone="muted">
            {contextLine(data, hasNothingImmediate)}
          </Text>
        </div>
        <span className={styles.homeSerial} aria-hidden="true">
          FIFAR / F5
        </span>
      </header>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          {data.currentOrNextMatch ? (
            <HomeMatchFeature match={data.currentOrNextMatch} />
          ) : (
            <section className={styles.compactEmpty}>
              <div className={styles.emptyArtwork} aria-hidden="true" />
              <div>
                <Text tone="accent" variant="label">
                  CANCHA DISPONIBLE
                </Text>
                <Text as="h2" variant="display-lg">
                  Tu próximo partido empieza acá.
                </Text>
                <Text tone="muted">Todavía no tenés una fecha marcada.</Text>
              </div>
              <Link className="ui-button ui-button--primary" href="/play">
                Buscar partido
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
              <ol className={styles.attentionDeck}>
                {data.attention.items.map((item, index) => (
                  <li
                    className={
                      index === 0
                        ? styles.attentionPrimary
                        : styles.attentionItem
                    }
                    key={item.id}
                  >
                    <Link
                      aria-label={`${item.title}. Abrir`}
                      className={styles.rowLink}
                      href={item.target.href}
                      onClick={(event) => openAttention(event, item)}
                    >
                      <AttentionVisual item={item} />
                      <span className={styles.attentionCopy}>
                        <strong>{item.title}</strong>
                        <small>{item.body}</small>
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
              <ol className={styles.opportunityRail}>
                {data.opportunities.items.map((item) => (
                  <li key={item.matchId}>
                    <Link
                      className={styles.opportunityCard}
                      href={`/play/matches/${item.matchId}`}
                    >
                      <span
                        className={styles.opportunityScene}
                        aria-hidden="true"
                      />
                      <V4GroupCrest
                        name={item.group.name}
                        seed={item.group.id}
                        size="compact"
                      />
                      <span className={styles.opportunityCopy}>
                        <small>
                          {formatShortDay(new Date(item.scheduledAt))}
                        </small>
                        <strong>{item.group.name}</strong>
                        <span>
                          {formatMatchDate(new Date(item.scheduledAt))} ·{" "}
                          {item.venue?.displayName ?? item.locationText}
                        </span>
                      </span>
                      <strong className={styles.openSpots}>
                        +{item.openSpots}
                        <small>LUGARES</small>
                      </strong>
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
          data-tier={getPlayerCardTier(Math.round(data.progress.overall))}
        >
          <div className={styles.contextPitch} aria-hidden="true" />
          <div className={styles.playerAnchor}>
            <V4Portrait name={data.player.displayName} size="large" />
            <span>PERFIL F5</span>
          </div>
          <OvrPlate
            detail={`${data.progress.processedMatchCount} partidos`}
            size="large"
            value={Math.round(data.progress.overall)}
          />
          <div className={styles.rankBlock}>
            <Text tone="accent" variant="label">
              POSICIÓN GLOBAL
            </Text>
            <strong>
              {data.globalPosition.ranked
                ? `#${data.globalPosition.position}`
                : "—"}
            </strong>
            <Text tone="muted" variant="metadata">
              {data.globalPosition.ranked
                ? `${Math.round(Number(data.globalPosition.overall))} OVR`
                : "Jugá para entrar al ranking"}
            </Text>
          </div>
          <div className={styles.contextLinks}>
            <Link href="/profile/progression">Progresión</Link>
            <Link href="/rankings?scope=global">Rankings</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function HomeMatchFeature({ match }: Readonly<{ match: PersonalMatch }>) {
  const date = new Date(match.scheduledAt);
  const isCurrent = match.effectivePhase === "IN_PROGRESS";
  const location = match.venue?.displayName ?? match.locationText;
  const remaining = Math.max(0, match.capacity - match.confirmedCount);
  return (
    <article className={styles.matchFeature}>
      <img
        alt=""
        className={styles.pitchFrame}
        src="/fifar-v4/match-scenes/home-feature-night.webp"
      />
      <div className={styles.featureAtmosphere} aria-hidden="true" />
      <header className={styles.matchStrip}>
        <span>{isCurrent ? "EN JUEGO" : "PRÓXIMO PARTIDO"}</span>
        <time dateTime={match.scheduledAt}>{formatMatchDate(date)}</time>
      </header>
      <div className={styles.matchIdentity}>
        <div className={styles.crestStage}>
          <V4GroupCrest
            name={match.group.name}
            seed={match.group.id}
            size="large"
          />
          <span aria-hidden="true">F5</span>
        </div>
        <div>
          <Text tone="accent" variant="label">
            {isCurrent ? "PARTIDO ACTUAL" : "PRÓXIMA FECHA"}
          </Text>
          <Text as="h2" variant="display-lg">
            {match.group.name}
          </Text>
          <Text tone="muted">{location}</Text>
          <Text className={styles.kickoff} variant="heading-lg">
            {new Intl.DateTimeFormat("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }).format(date)}{" "}
            HS
          </Text>
        </div>
      </div>
      <div className={styles.matchStatusLine}>
        <div>
          <small>CUPO</small>
          <strong>
            {match.confirmedCount}
            <span>/{match.capacity}</span>
          </strong>
        </div>
        <div>
          <small>ESTADO</small>
          <strong>
            {match.participation?.status === "CONFIRMED"
              ? "CONFIRMADO"
              : match.participation?.status === "WAITLISTED"
                ? "EN ESPERA"
                : remaining > 0
                  ? `FALTAN ${remaining}`
                  : "COMPLETO"}
          </strong>
        </div>
        <Link
          className="ui-button ui-button--primary"
          href={`/play/matches/${match.id}`}
        >
          Ver partido
        </Link>
      </div>
    </article>
  );
}

function AttentionVisual({ item }: Readonly<{ item: AttentionItem }>) {
  if (/AWARD|ACHIEVEMENT|PROGRESSION/.test(item.type))
    return <V4RewardBadge label={item.title} seed={item.id} />;
  if (/CONNECTION/.test(item.type)) return <V4Portrait name={item.title} />;
  return <V4GroupCrest name={item.title} seed={item.id} size="compact" />;
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
