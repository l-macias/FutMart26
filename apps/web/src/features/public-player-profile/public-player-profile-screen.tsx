"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Badge, Text } from "@football/ui";

import { PlayerCard } from "@/components/player-card/player-card";
import {
  V4GroupCrest,
  V4RewardBadge,
} from "@/components/visual-v4/profile-assets";
import { V4PlayIdentity } from "@/components/visual-v4/play-identity";
import { OvrPlate } from "@/components/visual-v3/ovr-plate";
import { PlayerAvatar } from "@/components/visual-v3/player-avatar";
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
  if (data.visibility === "ANONYMIZED")
    return (
      <div className={`${styles.page} ui-visual-v3 ui-visual-v4`}>
        <Link className={styles.back} href="/search">
          ← BUSCAR
        </Link>
        <header className={styles.privateIdentity}>
          <div className={styles.anonymizedBackdrop} aria-hidden="true" />
          <div
            className={`${styles.privateContent} ${styles.anonymizedContent}`}
          >
            <PlayerAvatar
              name={data.player.displayName}
              photoSrc={data.player.image}
              size="large"
            />
            <div className={styles.anonymizedCopy}>
              <Badge kind="state">PERFIL HISTÓRICO</Badge>
              <Text as="h1" variant="display-lg">
                {data.player.displayName}
              </Text>
              <Text tone="muted">
                Esta cuenta fue eliminada. Su evidencia deportiva histórica se
                conserva sin datos personales.
              </Text>
            </div>
          </div>
        </header>
      </div>
    );
  if (data.visibility === "PRIVATE")
    return (
      <div className={`${styles.page} ui-visual-v3 ui-visual-v4`}>
        <Link className={styles.back} href="/search">
          ← BUSCAR
        </Link>
        <header className={styles.privateIdentity}>
          <div className={styles.privateBackdrop} aria-hidden="true" />
          <div className={styles.privateContent}>
            <Badge kind="state">PERFIL PRIVADO</Badge>
            <Text as="h1" variant="display-lg">
              {data.player.displayName}
            </Text>
            <Text tone="muted">
              Este jugador no aparece en la búsqueda global. Su evidencia
              deportiva sigue visible sólo en contextos compartidos autorizados.
            </Text>
            <div className={styles.privateActions}>
              {data.isCurrentPlayer ? (
                <Link
                  className="ui-button ui-button--secondary"
                  href="/profile"
                >
                  Ver mi perfil completo
                </Link>
              ) : null}
              {!data.isCurrentPlayer ? (
                <ReportControl targetId={playerId} targetType="PLAYER" />
              ) : null}
            </div>
          </div>
        </header>
      </div>
    );
  const primaryGroup = data.groups[0] ?? null;
  return (
    <div className={`${styles.page} ui-visual-v3 ui-visual-v4`}>
      <Link className={styles.back} href="/search">
        ← BUSCAR
      </Link>
      <section
        className={styles.publicIdentity}
        aria-labelledby="public-player-name"
      >
        <div className={styles.identityPitch} aria-hidden="true" />
        <div className={styles.identityIllustration} aria-hidden="true" />
        <span className={styles.profileSerial} aria-hidden="true">
          FIFAR / PLAYER / {playerId.slice(0, 4).toUpperCase()}
        </span>
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
        </aside>
        <header className={styles.header}>
          <span className={styles.identityBadge}>IDENTIDAD F5</span>
          <Text as="h1" id="public-player-name" variant="display-lg">
            {data.player.displayName}
          </Text>
          <Text tone="muted">
            {data.performance.initialized
              ? `${data.performance.processedMatchCount} partidos procesados`
              : "Todavía no tiene partidos procesados"}
          </Text>
          <OvrPlate
            detail={`${data.performance.processedMatchCount} partidos`}
            size="large"
            value={Math.round(data.performance.overall)}
          />
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
      </section>

      <div className={styles.layout}>
        <div className={styles.content}>
          <section className={`${styles.section} ${styles.footballModule}`}>
            <div className={styles.visualModuleHeading}>
              <span>IDENTIDAD DE JUEGO</span>
              <Text as="h2" variant="heading-lg">
                Zona y atributos
              </Text>
            </div>
            {data.footballProfile ? (
              <V4PlayIdentity
                attributes={data.performance.attributes}
                roles={data.footballProfile.preferredRoles}
                strengths={data.footballProfile.strengths}
                willingToPlayGoalkeeper={
                  data.footballProfile.willingToPlayGoalkeeper
                }
              />
            ) : (
              <V4PlayIdentity
                attributes={data.performance.attributes}
                roles={[]}
                strengths={[]}
                willingToPlayGoalkeeper={false}
              />
            )}
          </section>

          <section className={`${styles.section} ${styles.statsModule}`}>
            <div className={styles.statsIdentity}>
              {primaryGroup ? (
                <V4GroupCrest
                  name={primaryGroup.name}
                  seed={primaryGroup.id}
                  size="large"
                />
              ) : (
                <span className={styles.statsF5Mark}>F5</span>
              )}
              <div>
                <span>PERFORMANCE / CARRERA TOTAL</span>
                <Text as="h2" variant="heading-lg">
                  Resumen deportivo
                </Text>
                <small>{primaryGroup?.name ?? "Trayectoria FIFAR"}</small>
              </div>
            </div>
            <dl className={styles.metrics}>
              <Metric
                mark="01"
                label="Partidos"
                value={data.performance.processedMatchCount}
              />
              <Metric
                mark="02"
                label="Promedio"
                value={
                  data.summary.averageRating === null
                    ? "—"
                    : Number(data.summary.averageRating).toFixed(1)
                }
              />
              <Metric mark="03" label="Goles" value={data.summary.totalGoals} />
              <Metric
                mark="04"
                label="Asistencias"
                value={data.summary.totalAssists}
              />
            </dl>
          </section>

          <section className={`${styles.section} ${styles.groupsModule}`}>
            <div className={styles.moduleHeader}>
              <Text as="h2" variant="heading-lg">
                Grupos
              </Text>
              <span>{data.groups.length.toString().padStart(2, "0")}</span>
            </div>
            <ul className={styles.contextList}>
              {data.groups.map((group) => (
                <li key={group.id}>
                  <V4GroupCrest
                    name={group.name}
                    seed={group.id}
                    size="large"
                  />
                  <Link href={`/groups/${group.id}`}>{group.name}</Link>
                  <small>GRUPO PÚBLICO</small>
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

          <section
            className={`${styles.section} ${styles.rewardsModule} ${styles.achievementModule}`}
          >
            <div className={styles.moduleHeader}>
              <Text as="h2" variant="heading-lg">
                Logros
              </Text>
              <span>COLLECTION</span>
            </div>
            <ul className={styles.rewardList}>
              {data.rewards.achievements.map((achievement) => (
                <li key={achievement.type}>
                  <V4RewardBadge
                    label={achievement.title}
                    seed={achievement.type}
                    size="large"
                  />
                  <span>
                    <strong>{achievement.title}</strong>
                    <small>{achievement.description}</small>
                  </span>
                </li>
              ))}
              {data.rewards.achievements.length === 0 && (
                <li>
                  <Text tone="muted">Todavía no obtuvo logros.</Text>
                </li>
              )}
            </ul>
          </section>

          <section
            className={`${styles.section} ${styles.rewardsModule} ${styles.awardModule}`}
          >
            <div className={styles.moduleHeader}>
              <Text as="h2" variant="heading-lg">
                Premios
              </Text>
              <span>HONOURS</span>
            </div>
            <ul className={styles.rewardList}>
              {data.rewards.awardSummary.map((award) => (
                <li key={award.type}>
                  <V4RewardBadge
                    label={award.title}
                    seed={award.type}
                    size="large"
                  />
                  <span>
                    <strong>
                      {award.title}
                      {award.count > 1 ? ` ×${award.count}` : ""}
                    </strong>
                    <small>{award.description}</small>
                  </span>
                </li>
              ))}
              {data.rewards.awardSummary.length === 0 && (
                <li>
                  <Text tone="muted">Todavía no recibió premios.</Text>
                </li>
              )}
            </ul>
          </section>
        </div>
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

function Metric({
  label,
  value,
  mark,
}: Readonly<{ label: string; value: number | string; mark: string }>) {
  return (
    <div>
      <span aria-hidden="true">{mark}</span>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
