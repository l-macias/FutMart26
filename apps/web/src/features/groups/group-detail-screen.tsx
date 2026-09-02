"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button, Text } from "@football/ui";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { ReportControl } from "@/components/report-control/report-control";
import styles from "./groups.module.css";
import { InviteConnectionControl } from "@/features/directed-invitations/invite-connection-control";

export function GroupDetailScreen({ groupId }: Readonly<{ groupId: string }>) {
  const group = useQuery({
    queryKey: queryKeys.group(groupId),
    queryFn: () => api.group(groupId),
  });
  const members = useQuery({
    queryKey: queryKeys.groupMembers(groupId),
    queryFn: () => api.members(groupId),
  });
  const matches = useQuery({
    queryKey: queryKeys.matches(groupId),
    queryFn: () => api.matches(groupId),
  });
  const stats = useQuery({
    queryKey: queryKeys.groupStats(groupId),
    queryFn: () => api.groupStats(groupId),
  });
  const ranking = useQuery({
    queryKey: queryKeys.groupRanking(groupId),
    queryFn: () => api.groupRanking(groupId, undefined, 3),
  });
  const activity = useInfiniteQuery({
    queryKey: queryKeys.groupActivity(groupId),
    queryFn: ({ pageParam }) =>
      api.groupActivity(groupId, pageParam ?? undefined, 8),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  if (group.isPending)
    return (
      <div className={styles.page}>
        <p role="status">Cargando grupo…</p>
      </div>
    );
  if (group.isError)
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">
          {group.error.message}
        </p>
      </div>
    );
  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/groups">
        ← GRUPOS
      </Link>
      <header className={styles.detailHero}>
        <div>
          <Text tone="accent" variant="label">
            {group.data.role} · {members.data?.length ?? "—"} MIEMBROS
          </Text>
          <Text as="h1" variant="display-lg">
            {group.data.name}
          </Text>
          <Link
            className="ui-button ui-button--secondary"
            href={`/groups/${groupId}/settings`}
          >
            {group.data.role === "MEMBER"
              ? "Opciones del grupo"
              : "Configurar grupo"}
          </Link>
        </div>
        <span className={styles.crest}>G</span>
      </header>
      <ReportControl targetId={groupId} targetType="GROUP" />
      <section className={styles.matchesSection}>
        <div className={styles.sectionHeading}>
          <div>
            <Text tone="accent" variant="label">
              PRÓXIMAS CONVOCATORIAS
            </Text>
            <Text as="h2" variant="heading-lg">
              Partidos
            </Text>
          </div>
          {group.data.status === "ACTIVE" &&
            group.data.capabilities.includes("MATCH_MANAGE") && (
              <Link
                className="ui-button ui-button--primary"
                href={`/groups/${groupId}/matches/new`}
              >
                Crear próximo partido
              </Link>
            )}
        </div>
        {matches.isPending ? (
          <p className={styles.status} role="status">
            Actualizando partidos…
          </p>
        ) : matches.isError ? (
          <p className={styles.error} role="alert">
            No pudimos cargar los partidos. El grupo sigue disponible.
          </p>
        ) : matches.data.length === 0 ? (
          <p className={styles.status}>
            Todavía no hay partidos. Podés preparar un Draft sin publicarlo.
          </p>
        ) : (
          <div className={styles.matchList}>
            {matches.data.map((match) => (
              <Link
                className={styles.matchRow}
                href={`/play/matches/${match.id}`}
                key={match.id}
              >
                <span>
                  {new Intl.DateTimeFormat("es-AR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  }).format(new Date(match.scheduledAt))}
                </span>
                <strong>
                  {new Intl.DateTimeFormat("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(match.scheduledAt))}{" "}
                  · {match.locationText}
                </strong>
                <small>
                  {match.status} · {match.confirmedCount}/{match.capacity}
                </small>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section
        className={styles.clubSummary}
        aria-labelledby="group-stats-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <Text tone="accent" variant="label">
              PULSO DEL GRUPO
            </Text>
            <Text as="h2" id="group-stats-title" variant="heading-lg">
              Números del club
            </Text>
          </div>
          <Link
            className="ui-button ui-button--secondary"
            href={`/groups/${groupId}/ranking`}
          >
            Ranking completo
          </Link>
        </div>
        {stats.isPending ? (
          <p role="status">Actualizando estadísticas…</p>
        ) : stats.isError ? (
          <p className={styles.error} role="alert">
            Las estadísticas no están disponibles ahora.
          </p>
        ) : (
          <div className={styles.statsStrip}>
            <Stat
              label="Partidos jugados"
              value={stats.data.matches.totalFinished}
            />
            <Stat label="Goles" value={stats.data.goals.total} />
            <Stat
              label="OVR promedio"
              value={formatDecimal(stats.data.performance.averageOvr)}
            />
            <Stat
              label="Rankeados"
              value={stats.data.participation.rankedPlayerCount}
            />
          </div>
        )}
        <div className={styles.topThree}>
          <Text as="h3" variant="heading-md">
            Top 3 F5
          </Text>
          {ranking.isPending ? (
            <Text tone="muted">Actualizando ranking…</Text>
          ) : ranking.isError ? (
            <Text tone="muted" role="alert">
              El ranking no está disponible ahora.
            </Text>
          ) : ranking.data.items.length === 0 ? (
            <Text tone="muted">Todavía no hay Players rankeados.</Text>
          ) : (
            ranking.data.items.map((item) => (
              <div className={styles.rankPreview} key={item.player.id}>
                <strong>#{item.position}</strong>
                <span>{item.player.displayName}</span>
                <b>{Math.round(Number(item.performance.overall))} OVR</b>
              </div>
            ))
          )}
        </div>
      </section>
      <section className={styles.activitySection}>
        <Text tone="accent" variant="label">
          ACTIVIDAD RECIENTE
        </Text>
        <Text as="h2" variant="heading-lg">
          Lo último
        </Text>
        {activity.isPending ? (
          <p className={styles.status} role="status">
            Actualizando actividad…
          </p>
        ) : activity.isError ? (
          <p className={styles.error} role="alert">
            La actividad reciente no está disponible ahora.
          </p>
        ) : activity.data.pages[0]?.items.length === 0 ? (
          <p className={styles.status}>Todavía no hay actividad deportiva.</p>
        ) : (
          <div className={styles.activityList}>
            {uniqueActivity(
              activity.data.pages.flatMap((page) => page.items),
            ).map((event) => (
              <Link
                className={styles.activityRow}
                href={event.target.href}
                key={event.stableId}
              >
                <time>{formatDate(event.occurredAt)}</time>
                <strong>{event.title}</strong>
                <small>{event.body}</small>
              </Link>
            ))}
          </div>
        )}
        {activity.hasNextPage && !activity.isError && (
          <Button
            disabled={activity.isFetchingNextPage}
            onClick={() => void activity.fetchNextPage()}
            variant="secondary"
          >
            {activity.isFetchingNextPage ? "Cargando…" : "Cargar más"}
          </Button>
        )}
      </section>
      <div className={styles.detailGrid}>
        <section>
          <Text as="h2" variant="heading-lg">
            Plantel
          </Text>
          {members.isPending ? (
            <p role="status">Actualizando plantel…</p>
          ) : members.isError ? (
            <p className={styles.error} role="alert">
              No pudimos cargar el plantel.
            </p>
          ) : (
            <div className={styles.memberList}>
              {members.data.map((membership, index) => (
                <article className={styles.member} key={membership.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{membership.player.displayName}</strong>
                  <small>{membership.role}</small>
                </article>
              ))}
            </div>
          )}
        </section>
        {group.data.status === "ACTIVE" &&
        group.data.capabilities.includes("GROUP_MANAGE_INVITATIONS") ? (
          <div>
            <InviteConnectionControl destinationId={groupId} kind="group" />
            <InvitationManager groupId={groupId} />
          </div>
        ) : (
          <aside className={styles.secondary}>
            <Text as="h2" variant="heading-md">
              Invitaciones
            </Text>
            <Text tone="muted">
              Solo quienes administran el grupo pueden crear enlaces.
            </Text>
          </aside>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: Readonly<{ label: string; value: string | number }>) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function formatDecimal(value: string | null) {
  return value === null ? "—" : Number(value).toFixed(1);
}

function uniqueActivity<T extends { stableId: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.stableId, item])).values()];
}

function InvitationManager({ groupId }: Readonly<{ groupId: string }>) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<"SINGLE_USE" | "TIME_LIMITED">("SINGLE_USE");
  const [duration, setDuration] = useState("24");
  const [secretUrl, setSecretUrl] = useState<string | null>(null);
  const invitations = useQuery({
    queryKey: queryKeys.invitations(groupId),
    queryFn: () => api.invitations(groupId),
  });
  const create = useMutation({
    mutationFn: (form: FormData) =>
      api.createInvitation(
        groupId,
        type === "SINGLE_USE"
          ? { type }
          : {
              type,
              expiresAt: new Date(
                Date.now() + Number(duration) * 3_600_000,
              ).toISOString(),
              maxUses: form.get("maxUses") ? Number(form.get("maxUses")) : null,
            },
      ),
    onSuccess: async (result) => {
      setSecretUrl(`${window.location.origin}/invite/${result.token}`);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.invitations(groupId),
      });
    },
  });
  async function share() {
    if (!secretUrl) return;
    if (navigator.share)
      await navigator.share({ title: "Invitación F5 Groups", url: secretUrl });
    else await navigator.clipboard.writeText(secretUrl);
  }
  return (
    <aside className={styles.invites}>
      <Text tone="accent" variant="label">
        SUMAR JUGADORES
      </Text>
      <Text as="h2" variant="heading-lg">
        Invitación
      </Text>
      <form
        action={(data) => create.mutate(data)}
        className={styles.inviteForm}
      >
        <fieldset>
          <legend>Tipo</legend>
          <label>
            <input
              checked={type === "SINGLE_USE"}
              name="type"
              onChange={() => setType("SINGLE_USE")}
              type="radio"
            />{" "}
            Un solo uso
          </label>
          <label>
            <input
              checked={type === "TIME_LIMITED"}
              name="type"
              onChange={() => setType("TIME_LIMITED")}
              type="radio"
            />{" "}
            Temporal
          </label>
        </fieldset>
        {type === "TIME_LIMITED" && (
          <>
            <label>
              <span>Duración</span>
              <select
                onChange={(event) => setDuration(event.target.value)}
                value={duration}
              >
                <option value="1">1 hora</option>
                <option value="24">1 día</option>
                <option value="168">7 días</option>
                <option value="720">1 mes</option>
              </select>
            </label>
            <label>
              <span>Máximo de usos · opcional</span>
              <input min="1" name="maxUses" type="number" />
            </label>
          </>
        )}
        {create.isError && (
          <p className={styles.error} role="alert">
            {create.error.message}
          </p>
        )}
        <Button disabled={create.isPending} type="submit">
          Generar enlace
        </Button>
      </form>
      {secretUrl && (
        <div className={styles.secret}>
          <Text variant="label">ENLACE LISTO</Text>
          <code>{secretUrl}</code>
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(secretUrl);
            }}
            variant="secondary"
          >
            Copiar enlace
          </Button>
          <Button
            onClick={() => {
              void share();
            }}
            variant="quiet"
          >
            Compartir
          </Button>
          <small>Este secreto se muestra solo ahora.</small>
        </div>
      )}
      {invitations.isError && (
        <p className={styles.error} role="alert">
          {invitations.error.message}
        </p>
      )}
      <div className={styles.invitationList}>
        {invitations.data?.map((invitation) => (
          <article key={invitation.id}>
            <span>
              <strong>
                {invitation.type === "SINGLE_USE" ? "UN SOLO USO" : "TEMPORAL"}
              </strong>
              <small>
                {invitation.status} · {invitation.useCount}
                {invitation.maxUses ? ` / ${invitation.maxUses}` : " usos"}
              </small>
              <small>
                Creada por {invitation.createdByDisplayName} ·{" "}
                {formatDate(invitation.createdAt)}
              </small>
              <small>
                {invitation.expiresAt
                  ? `Vence ${formatDate(invitation.expiresAt)}`
                  : "Sin vencimiento"}
              </small>
            </span>
            {invitation.status === "ACTIVE" && (
              <Link href={`/groups/${groupId}/settings`}>Gestionar</Link>
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
