"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { OverallDisplay } from "@football/football-ui";
import { Badge, Text } from "@football/ui";

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
        <Link className={styles.back} href="/search">
          ← BUSCAR
        </Link>
        <header className={styles.header}>
          <div>
            <Badge kind="state">PERFIL PRIVADO</Badge>
            <Text as="h1" variant="display-lg">
              {data.player.displayName}
            </Text>
            <Text tone="muted">
              Este jugador no aparece en la búsqueda global. Su evidencia
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
      <Link className={styles.back} href="/search">
        ← BUSCAR
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
        <div className={styles.profileActions}>
          {data.isCurrentPlayer ? (
            <Link className="ui-button ui-button--secondary" href="/profile">
              Ver mi perfil completo
            </Link>
          ) : (
            <>
              <ConnectionControls playerId={playerId} />
              <ReportControl targetId={playerId} targetType="PLAYER" />
            </>
          )}
        </div>
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
            <div className={styles.profileSummary}>
              <div>
                <Text as="h2" variant="heading-lg">
                  Perfil futbolístico
                </Text>
                <Text tone="muted">Identidad deportiva F5</Text>
              </div>
              <OverallDisplay value={Math.round(data.performance.overall)} />
            </div>
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
              <Metric
                label="Promedio"
                value={
                  data.summary.averageRating === null
                    ? "—"
                    : Number(data.summary.averageRating).toFixed(1)
                }
              />
              <Metric label="Goles" value={data.summary.totalGoals} />
              <Metric label="Asistencias" value={data.summary.totalAssists} />
            </dl>
          </section>

          <section className={styles.section}>
            <Text as="h2" variant="heading-lg">
              Grupos
            </Text>
            <ul className={styles.contextList}>
              {data.groups.map((group) => (
                <li key={group.id}>
                  <Link href={`/groups/${group.id}`}>{group.name}</Link>
                  <span aria-hidden="true">→</span>
                </li>
              ))}
              {data.groups.length === 0 ? (
                <li>
                  <Text tone="muted">Sin grupos públicos para mostrar.</Text>
                </li>
              ) : null}
            </ul>
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
              Premios
            </Text>
            <ul className={styles.rewardList}>
              {data.rewards.awardSummary.map((award) => (
                <li key={award.type}>
                  <strong>
                    {award.title}
                    {award.count > 1 ? ` ×${award.count}` : ""}
                  </strong>
                  <small>{award.description}</small>
                </li>
              ))}
              {data.rewards.awardSummary.length === 0 && (
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
          <InvitePlayerToGroupControl playerId={playerId} />
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

function InvitePlayerToGroupControl({
  playerId,
}: Readonly<{ playerId: string }>) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const options = useQuery({
    queryKey: queryKeys.playerGroupInvitationOptions(playerId),
    queryFn: () => api.playerGroupInvitationOptions(playerId),
    enabled: open,
  });
  const invite = useMutation({
    mutationFn: (groupId: string) =>
      api.inviteConnectionToGroup(groupId, playerId),
    onSuccess: async () => {
      setFeedback("Invitación enviada.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.playerGroupInvitationOptions(playerId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.directedInvitations,
        }),
      ]);
    },
  });
  return (
    <div className={styles.groupInviteControl}>
      <button
        className="ui-button ui-button--secondary"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Invitar a grupo
      </button>
      {open ? (
        <div className={styles.groupInviteOptions}>
          {options.isPending ? (
            <Text tone="muted">Cargando grupos…</Text>
          ) : null}
          {options.isError ? (
            <Text tone="muted" role="alert">
              No pudimos cargar tus grupos disponibles.
            </Text>
          ) : null}
          {options.data?.items.map((item) => (
            <button
              disabled={invite.isPending || item.state === "PENDING"}
              key={item.group.id}
              onClick={() => invite.mutate(item.group.id)}
              type="button"
            >
              <strong>{item.group.name}</strong>
              <span>
                {item.state === "PENDING" ? "INVITACIÓN PENDIENTE" : "INVITAR"}
              </span>
            </button>
          ))}
          {options.data?.items.length === 0 ? (
            <Text tone="muted">
              No tenés grupos activos disponibles para invitarlo.
            </Text>
          ) : null}
          {feedback ? <Text tone="accent">{feedback}</Text> : null}
          {invite.isError ? (
            <Text tone="muted" role="alert">
              No pudimos enviar la invitación.
            </Text>
          ) : null}
        </div>
      ) : null}
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

function Metric({
  label,
  value,
}: Readonly<{ label: string; value: number | string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
