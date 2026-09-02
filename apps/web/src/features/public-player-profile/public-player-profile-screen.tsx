"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Text } from "@football/ui";

import { PlayerCard } from "@/components/player-card/player-card";
import { ReportControl } from "@/components/report-control/report-control";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { ApiError, mediaContentUrl } from "@/lib/api/client";

import styles from "./public-player-profile.module.css";

export function PublicPlayerProfileScreen({
  playerId,
}: Readonly<{ playerId: string }>) {
  const profile = useQuery({
    queryKey: queryKeys.publicPlayerProfile(playerId),
    queryFn: () => api.publicPlayerProfile(playerId),
    retry: false,
  });

  if (profile.isPending)
    return <div className={styles.state}>Preparando ficha F5…</div>;
  if (profile.isError)
    return (
      <div className={styles.state} role="alert">
        {publicProfileErrorMessage(profile.error)}
      </div>
    );

  const data = profile.data;
  if (data.visibility === "PRIVATE")
    return (
      <div className={styles.page}>
        <Link className={styles.back} href="/players">
          ← BUSCAR JUGADORES
        </Link>
        <header className={styles.header}>
          <div>
            <Text tone="accent" variant="label">
              PERFIL PRIVADO
            </Text>
            <Text as="h1" variant="display-lg">
              {data.player.displayName}
            </Text>
            <Text tone="muted">
              Este jugador no participa del discovery global. Su evidencia
              deportiva sigue visible sólo en contextos compartidos autorizados.
            </Text>
          </div>
          {data.isCurrentPlayer ? (
            <Link className="ui-button ui-button--secondary" href="/profile">
              Ver mi perfil completo
            </Link>
          ) : null}
        </header>
        {!data.isCurrentPlayer ? (
          <ReportControl targetId={playerId} targetType="PLAYER" />
        ) : null}
      </div>
    );
  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/players">
        ← BUSCAR JUGADORES
      </Link>
      <header className={styles.header}>
        <div>
          <Text as="span" tone="accent" variant="label">
            FICHA DE JUGADOR · F5
          </Text>
          <Text as="h1" variant="display-lg">
            {data.player.displayName}
          </Text>
          <Text tone="muted">
            {data.performance.initialized
              ? `${data.performance.processedMatchCount} partidos procesados`
              : "Todavía no tiene partidos procesados"}
          </Text>
        </div>
        {data.isCurrentPlayer && (
          <Link className="ui-button ui-button--secondary" href="/profile">
            Ver mi perfil completo
          </Link>
        )}
        {!data.isCurrentPlayer && <ConnectionControls playerId={playerId} />}
        {!data.isCurrentPlayer && (
          <ReportControl targetId={playerId} targetType="PLAYER" />
        )}
      </header>

      <div className={styles.layout}>
        <aside className={styles.cardArea}>
          <PlayerCard
            attributes={data.performance.attributes}
            footer={
              data.footballProfile?.preferredRoles.join(" · ") ||
              "PERFIL INICIAL"
            }
            name={data.player.displayName}
            overall={data.performance.overall}
            photoSrc={
              data.player.image ? mediaContentUrl(data.player.image.url) : null
            }
          />
          {!data.performance.initialized && (
            <Text tone="muted">
              La card inicial permanece en 60 hasta procesar su primer partido.
            </Text>
          )}
        </aside>

        <main className={styles.content}>
          <section className={styles.section}>
            <Text as="h2" variant="heading-lg">
              Perfil futbolístico
            </Text>
            {data.footballProfile ? (
              <>
                <TagList
                  empty="Sin roles declarados"
                  items={data.footballProfile.preferredRoles}
                />
                {data.footballProfile.willingToPlayGoalkeeper && (
                  <Text tone="accent" variant="label">
                    PUEDE ATAJAR
                  </Text>
                )}
                <div>
                  <Text as="h3" variant="heading-md">
                    Fortalezas declaradas
                  </Text>
                  <TagList
                    empty="Sin fortalezas declaradas"
                    items={data.footballProfile.strengths}
                  />
                </div>
              </>
            ) : (
              <Text tone="muted">Todavía no completó sus preferencias F5.</Text>
            )}
          </section>

          <section className={styles.section}>
            <Text as="h2" variant="heading-lg">
              Resumen deportivo
            </Text>
            <dl className={styles.metrics}>
              <Metric
                label="Partidos"
                value={data.performance.processedMatchCount}
              />
              <Metric label="Goles" value={data.summary.totalGoals} />
              <Metric label="Asistencias" value={data.summary.totalAssists} />
              <Metric label="Logros" value={data.summary.achievementCount} />
              <Metric label="Premios" value={data.summary.awardCount} />
            </dl>
          </section>

          <section className={styles.section}>
            <Text as="h2" variant="heading-lg">
              Logros
            </Text>
            <ul className={styles.rewardList}>
              {data.rewards.achievements.map((achievement) => (
                <li key={achievement.type}>
                  <strong>{achievement.title}</strong>
                  <small>{achievement.description}</small>
                </li>
              ))}
              {data.rewards.achievements.length === 0 && (
                <li>
                  <Text tone="muted">Todavía no obtuvo logros.</Text>
                </li>
              )}
            </ul>
          </section>

          <section className={styles.section}>
            <Text as="h2" variant="heading-lg">
              Premios recientes
            </Text>
            <ul className={styles.rewardList}>
              {data.rewards.recentAwards.map((award) => (
                <li key={`${award.awardedAt}:${award.type}`}>
                  <strong>{award.title}</strong>
                  <small>
                    {new Date(award.scheduledAt).toLocaleDateString("es-AR")}
                  </small>
                </li>
              ))}
              {data.rewards.recentAwards.length === 0 && (
                <li>
                  <Text tone="muted">Todavía no recibió premios.</Text>
                </li>
              )}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}

function ConnectionControls({ playerId }: Readonly<{ playerId: string }>) {
  const queryClient = useQueryClient();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const status = useQuery({
    queryKey: queryKeys.connectionStatus(playerId),
    queryFn: () => api.connectionStatus(playerId),
  });
  const mutation = useMutation({
    mutationFn: (
      action: "request" | "accept" | "reject" | "cancel" | "remove",
    ) => {
      if (action === "request") return api.requestConnection(playerId);
      if (action === "accept") return api.acceptConnection(playerId);
      if (action === "reject") return api.rejectConnection(playerId);
      if (action === "cancel") return api.cancelConnection(playerId);
      return api.removeConnection(playerId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.connectionStatus(playerId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.connections }),
        queryClient.invalidateQueries({
          queryKey: ["me", "connections", "requests"],
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.notificationUnreadCount,
        }),
      ]);
    },
  });

  if (status.isPending) return <Text tone="muted">Consultando conexión…</Text>;
  if (status.isError)
    return <Text tone="muted">No pudimos consultar la conexión.</Text>;
  const state = status.data.state;
  return (
    <div className={styles.connectionActions}>
      {state === "NONE" && (
        <button
          className="ui-button ui-button--primary"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("request")}
          type="button"
        >
          Conectar
        </button>
      )}
      {state === "PENDING_SENT" && (
        <>
          <Text tone="muted" variant="label">
            SOLICITUD ENVIADA
          </Text>
          <button
            className="ui-button ui-button--secondary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("cancel")}
            type="button"
          >
            Cancelar
          </button>
        </>
      )}
      {state === "PENDING_RECEIVED" && (
        <>
          <button
            className="ui-button ui-button--primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("accept")}
            type="button"
          >
            Aceptar
          </button>
          <button
            className="ui-button ui-button--secondary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("reject")}
            type="button"
          >
            Rechazar
          </button>
        </>
      )}
      {state === "CONNECTED" && (
        <>
          <Text tone="accent" variant="label">
            CONECTADO
          </Text>
          <button
            className="ui-button ui-button--secondary"
            disabled={mutation.isPending}
            onClick={() => setConfirmRemove(true)}
            type="button"
          >
            Eliminar conexión
          </button>
        </>
      )}
      {mutation.isError && (
        <Text tone="muted">No pudimos completar la acción.</Text>
      )}
      <ConfirmDialog
        confirmDisabled={mutation.isPending}
        confirmLabel="Eliminar conexión"
        message="La relación deja de estar activa, pero no cambia grupos, partidos ni evidencia deportiva."
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          mutation.mutate("remove", {
            onSettled: () => setConfirmRemove(false),
          });
        }}
        open={confirmRemove}
        title="¿Eliminar esta conexión?"
      />
    </div>
  );
}

function publicProfileErrorMessage(error: unknown) {
  if (!(error instanceof ApiError))
    return "No pudimos cargar este perfil deportivo.";
  if (error.code === "network_error")
    return "No pudimos conectar con el servidor. El perfil no se perdió; reintentá cuando vuelva la conexión.";
  if (error.code === "account_suspended")
    return "Este perfil no está disponible.";
  if (error.status === 404) return "No encontramos este perfil deportivo.";
  if (error.status === 401) return "Tu sesión terminó. Volvé a ingresar.";
  return "No pudimos cargar este perfil deportivo.";
}

function TagList({
  items,
  empty,
}: Readonly<{ items: string[]; empty: string }>) {
  if (items.length === 0) return <Text tone="muted">{empty}</Text>;
  return (
    <ul className={styles.tags}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
