"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type {
  GroupActivityResponse,
  GroupOverviewResponse,
} from "@football/contracts";
import { Badge, Text } from "@football/ui";
import { ReportControl } from "@/components/report-control/report-control";
import {
  V4GroupCrest,
  V4Portrait,
  V4RewardBadge,
  V4TierPlate,
} from "@/components/visual-v4/profile-assets";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import styles from "./groups.module.css";

type MatchPreview = GroupOverviewResponse["historyMatches"][number];

export function GroupDetailScreen({ groupId }: Readonly<{ groupId: string }>) {
  const [showFullRoster, setShowFullRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [matchView, setMatchView] = useState<"upcoming" | "history">(
    "upcoming",
  );
  const overview = useQuery({
    queryKey: queryKeys.groupOverview(groupId),
    queryFn: () => api.groupOverview(groupId),
  });
  const members = useQuery({
    queryKey: queryKeys.groupMembers(groupId),
    queryFn: () => api.members(groupId),
    enabled: showFullRoster && overview.isSuccess,
  });
  const stats = useQuery({
    queryKey: queryKeys.groupStats(groupId),
    queryFn: () => api.groupStats(groupId),
    enabled: overview.isSuccess,
  });
  const ranking = useQuery({
    queryKey: queryKeys.groupRanking(groupId),
    queryFn: () => api.groupRanking(groupId, undefined, 3),
    enabled: overview.isSuccess,
  });
  const activity = useQuery({
    queryKey: queryKeys.groupActivity(groupId),
    queryFn: () => api.groupActivity(groupId, undefined, 4),
    enabled: overview.isSuccess,
  });

  if (overview.isPending)
    return (
      <div className={styles.page}>
        <p role="status">Cargando grupo…</p>
      </div>
    );
  if (overview.isError)
    return (
      <div className={styles.page}>
        <p className={styles.error} role="alert">
          {overview.error.message}
        </p>
      </div>
    );

  const { group } = overview.data;
  const visibleMembers = members.data?.filter((membership) =>
    membership.player.displayName
      .toLocaleLowerCase("es")
      .includes(rosterSearch.trim().toLocaleLowerCase("es")),
  );
  const selectedMatches =
    matchView === "upcoming"
      ? overview.data.upcomingMatches
      : overview.data.historyMatches;

  return (
    <div className={`${styles.page} ui-visual-v4`}>
      <Link className={styles.back} href="/groups">
        ← GRUPOS
      </Link>
      <header
        className={`${styles.groupHeader} ${group.status === "ARCHIVED" ? styles.groupHeaderArchived : ""}`}
      >
        <img
          alt=""
          className={styles.groupHeroScene}
          src="/fifar-v4/group-ranking-scenes/group-club-night.webp"
        />
        <div className={styles.groupCrestStage}>
          <V4GroupCrest name={group.name} seed={group.id} size="large" />
          <span>FIFAR F5</span>
        </div>
        <div className={styles.groupIdentity}>
          <Text tone="accent" variant="label">
            ESPACIO DE GRUPO
          </Text>
          <Text as="h1" className={styles.groupTitle} variant="display-lg">
            {group.name}
          </Text>
          <div className={styles.headerMeta} aria-label="Estado del grupo">
            {group.visibility === "PRIVATE" ? (
              <Badge kind="state">PRIVADO</Badge>
            ) : (
              <span>PÚBLICO</span>
            )}
            {group.role !== "MEMBER" && (
              <Badge kind="role">{roleLabel(group.role)}</Badge>
            )}
            {group.status === "ARCHIVED" && (
              <Badge className={styles.archivedBadge} kind="state">
                ARCHIVADO
              </Badge>
            )}
          </div>
        </div>
        <div
          className={styles.memberCount}
          aria-label={`${overview.data.memberCount} jugadores`}
        >
          <strong>{overview.data.memberCount}</strong>
          <span>JUGADORES</span>
        </div>
      </header>

      {group.status === "ARCHIVED" && (
        <p className={styles.archivedNotice} role="status">
          Este grupo está archivado. Su historia sigue disponible en modo de
          consulta.
        </p>
      )}

      <div
        className={`${styles.overviewGrid} ${group.status === "ARCHIVED" ? styles.overviewGridArchived : ""}`}
      >
        <div className={styles.overviewMain}>
          <NextMatch
            canCreate={overview.data.canCreateMatch}
            groupId={groupId}
            groupName={group.name}
            match={overview.data.nextMatch}
          />

          <section
            className={styles.rosterSection}
            aria-labelledby="roster-title"
          >
            <div className={styles.sectionHeading}>
              <div>
                <Text tone="accent" variant="label">
                  PLANTEL · {overview.data.memberCount}
                </Text>
                <Text as="h2" id="roster-title" variant="heading-lg">
                  Jugadores del grupo
                </Text>
              </div>
              {overview.data.memberCount >
                overview.data.rosterPreview.length && (
                <button
                  className="ui-button ui-button--secondary"
                  onClick={() => setShowFullRoster((value) => !value)}
                  type="button"
                >
                  {showFullRoster ? "Cerrar plantel" : "Ver plantel completo"}
                </button>
              )}
            </div>
            {showFullRoster ? (
              <>
                <label className={styles.rosterSearch}>
                  <span>BUSCAR EN EL PLANTEL</span>
                  <input
                    onChange={(event) => setRosterSearch(event.target.value)}
                    placeholder="Nombre del jugador"
                    type="search"
                    value={rosterSearch}
                  />
                </label>
                {members.isPending ? (
                  <p role="status">Actualizando plantel…</p>
                ) : members.isError ? (
                  <p className={styles.error} role="alert">
                    No pudimos cargar el plantel completo.
                  </p>
                ) : visibleMembers?.length === 0 ? (
                  <p className={styles.status}>No hay coincidencias.</p>
                ) : (
                  <Roster members={visibleMembers ?? []} />
                )}
              </>
            ) : (
              <Roster members={overview.data.rosterPreview} />
            )}
          </section>

          <section
            className={styles.matchesSection}
            aria-labelledby="matches-title"
          >
            <div className={styles.sectionHeading}>
              <div>
                <Text tone="accent" variant="label">
                  PARTIDOS
                </Text>
                <Text as="h2" id="matches-title" variant="heading-lg">
                  Calendario del grupo
                </Text>
              </div>
              <div className={styles.matchTabs} aria-label="Vista de partidos">
                <button
                  aria-pressed={matchView === "upcoming"}
                  onClick={() => setMatchView("upcoming")}
                  type="button"
                >
                  PRÓXIMOS
                </button>
                <button
                  aria-pressed={matchView === "history"}
                  onClick={() => setMatchView("history")}
                  type="button"
                >
                  HISTORIAL
                </button>
              </div>
            </div>
            {selectedMatches.length === 0 ? (
              <p className={styles.status}>
                {matchView === "upcoming"
                  ? overview.data.nextMatch
                    ? "No hay otros partidos próximos."
                    : "No hay próximos partidos."
                  : "Todavía no hay partidos en el historial."}
              </p>
            ) : (
              <div className={styles.matchList}>
                {selectedMatches.map((match) => (
                  <MatchRow
                    groupId={groupId}
                    groupName={group.name}
                    key={match.id}
                    match={match}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className={styles.overviewAside}>
          <section className={styles.compactSection}>
            <div className={styles.sectionHeading}>
              <div>
                <Text tone="accent" variant="label">
                  TOP DEL GRUPO
                </Text>
                <Text as="h2" variant="heading-md">
                  F5
                </Text>
              </div>
            </div>
            {ranking.isPending ? (
              <p className={styles.status} role="status">
                Actualizando ranking…
              </p>
            ) : ranking.isError ? (
              <p className={styles.error} role="alert">
                El ranking no está disponible ahora.
              </p>
            ) : ranking.data.items.length === 0 ? (
              <p className={styles.status}>
                Todavía no hay jugadores rankeados.
              </p>
            ) : (
              <div className={styles.topThree}>
                {ranking.data.items.map((item) => (
                  <Link
                    className={styles.rankPreview}
                    href={`/players/${item.player.id}`}
                    key={item.player.id}
                  >
                    <span className={styles.rankNumber}>#{item.position}</span>
                    <V4Portrait name={item.player.displayName} />
                    <span className={styles.rankIdentity}>
                      <strong>{item.player.displayName}</strong>
                      <small>F5 · NIVEL ACTUAL</small>
                    </span>
                    <V4TierPlate
                      compact
                      overall={Number(item.performance.overall)}
                    />
                  </Link>
                ))}
              </div>
            )}
            <Link
              className={styles.inlineLink}
              href={`/rankings?scope=group&groupId=${groupId}`}
            >
              VER RANKING COMPLETO →
            </Link>
          </section>

          <section className={styles.compactSection}>
            <Text tone="accent" variant="label">
              NÚMEROS DEL GRUPO
            </Text>
            {stats.isPending ? (
              <p className={styles.status} role="status">
                Actualizando números…
              </p>
            ) : stats.isError ? (
              <p className={styles.error} role="alert">
                Los números no están disponibles ahora.
              </p>
            ) : (
              <div className={styles.statsStrip}>
                <Stat label="Jugadores" value={overview.data.memberCount} />
                <Stat
                  label="Partidos"
                  value={stats.data.matches.totalFinished}
                />
                <Stat
                  label="OVR promedio"
                  value={formatDecimal(stats.data.performance.averageOvr)}
                />
              </div>
            )}
          </section>

          <section className={styles.compactSection}>
            <Text tone="accent" variant="label">
              ACTIVIDAD RECIENTE
            </Text>
            {activity.isPending ? (
              <p className={styles.status} role="status">
                Actualizando actividad…
              </p>
            ) : activity.isError ? (
              <p className={styles.error} role="alert">
                La actividad no está disponible ahora.
              </p>
            ) : activity.data.items.length === 0 ? (
              <p className={styles.status}>
                Todavía no hay actividad deportiva.
              </p>
            ) : (
              <div className={`${styles.activityList} ui-list`}>
                {activity.data.items.map((event) => (
                  <Link
                    className={`${styles.activityRow} ui-row`}
                    href={event.target.href}
                    key={event.stableId}
                  >
                    <ActivityVisual event={event} group={group} />
                    <span>
                      <strong>{event.title}</strong>
                      <small>{event.body}</small>
                    </span>
                    <time>{formatDate(event.occurredAt)}</time>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {overview.data.canManageGroup && (
            <section className={styles.managementCallout}>
              <Text tone="accent" variant="label">
                ORGANIZACIÓN
              </Text>
              <Text tone="muted">
                Invitaciones, roles, permisos e identidad viven en un espacio
                separado.
              </Text>
              <Link
                className="ui-button ui-button--management"
                href={`/groups/${groupId}/settings`}
              >
                Administrar grupo
              </Link>
            </section>
          )}

          {!overview.data.canManageGroup && group.status === "ACTIVE" && (
            <Link
              className={styles.membershipOptionsLink}
              href={`/groups/${groupId}/settings`}
            >
              Opciones de membresía
            </Link>
          )}

          <div className={styles.reportAction}>
            <ReportControl targetId={groupId} targetType="GROUP" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function NextMatch({
  canCreate,
  groupId,
  groupName,
  match,
}: Readonly<{
  canCreate: boolean;
  groupId: string;
  groupName: string;
  match: MatchPreview | null;
}>) {
  return (
    <section className={styles.nextMatch} aria-labelledby="next-match-title">
      <img
        alt=""
        className={styles.nextMatchScene}
        src="/fifar-v4/match-scenes/match-open-night.webp"
      />
      {match ? (
        <>
          <div className={styles.nextMatchStrip}>
            <Text tone="accent" variant="label">
              {match.effectivePhase === "IN_PROGRESS"
                ? "EN JUEGO"
                : "PRÓXIMO PARTIDO"}
            </Text>
            <span>{statusLabel(match.effectivePhase)}</span>
          </div>
          <div className={styles.nextMatchHeader}>
            <V4GroupCrest name={groupName} seed={groupId} size="large" />
            <div className={styles.nextMatchIdentity}>
              <Text as="h2" id="next-match-title" variant="heading-lg">
                {formatLongDate(match.scheduledAt)}
              </Text>
              <strong>{groupName}</strong>
              <Text tone="muted">{match.locationText}</Text>
            </div>
            <strong className={styles.capacity}>
              {match.confirmedCount} / {match.capacity}
              <small> ANOTADOS</small>
            </strong>
          </div>
          {match.participationStatus && (
            <p className={styles.actorStatus}>
              {match.participationStatus === "CONFIRMED"
                ? "✓ ESTÁS ANOTADO"
                : "ESTÁS EN ESPERA"}
            </p>
          )}
          <Link
            className="ui-button ui-button--primary"
            href={`/play/matches/${match.id}`}
          >
            Ver partido
          </Link>
        </>
      ) : (
        <div className={styles.compactEmpty}>
          <V4GroupCrest name={groupName} seed={groupId} size="large" />
          <Text as="h2" id="next-match-title" variant="heading-md">
            No hay próximos partidos.
          </Text>
          {canCreate && (
            <Link
              className="ui-button ui-button--primary"
              href={`/groups/${groupId}/matches/new`}
            >
              Crear partido
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function Roster({
  members,
}: Readonly<{ members: GroupOverviewResponse["rosterPreview"] }>) {
  return (
    <div className={styles.memberList}>
      {members.map((membership, index) => (
        <Link
          className={styles.member}
          href={`/players/${membership.player.id}`}
          key={membership.id}
        >
          <span className={styles.squadNumber}>{index + 1}</span>
          <V4Portrait name={membership.player.displayName} />
          <span className={styles.memberIdentity}>
            <strong>{membership.player.displayName}</strong>
            <small>JUGADOR F5</small>
          </span>
          <span className={styles.memberRole}>
            {membership.role !== "MEMBER" && (
              <Badge kind="role">
                {membership.role === "OWNER" ? "PROPIETARIO" : "MOD"}
              </Badge>
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}

function MatchRow({
  groupId,
  groupName,
  match,
}: Readonly<{
  groupId: string;
  groupName: string;
  match: MatchPreview;
}>) {
  return (
    <Link
      className={`${styles.matchRow} ui-row`}
      href={`/play/matches/${match.id}`}
    >
      <V4GroupCrest name={groupName} seed={groupId} size="compact" />
      <span className={styles.matchDate}>
        {formatShortDate(match.scheduledAt)}
      </span>
      <span className="ui-row__content">
        <strong className="ui-row__primary">{match.locationText}</strong>
        <small className="ui-row__secondary">
          {statusLabel(match.effectivePhase)}
        </small>
      </span>
      <strong className="ui-row__metric">
        {match.result
          ? `${match.result.teamAGoals}–${match.result.teamBGoals}`
          : `${match.confirmedCount}/${match.capacity}`}
      </strong>
    </Link>
  );
}

function ActivityVisual({
  event,
  group,
}: Readonly<{
  event: GroupActivityResponse["items"][number];
  group: GroupOverviewResponse["group"];
}>) {
  if (
    event.eventType === "ACHIEVEMENT_EARNED" ||
    event.eventType === "AWARD_EARNED"
  )
    return (
      <V4RewardBadge
        label={event.title}
        seed={
          event.eventType === "ACHIEVEMENT_EARNED"
            ? event.achievementType
            : event.awardType
        }
      />
    );
  if (event.eventType === "PROGRESSION_APPLIED")
    return <V4Portrait name={event.player.displayName} />;
  return <V4GroupCrest name={group.name} seed={group.id} size="compact" />;
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

function roleLabel(role: "OWNER" | "MODERATOR" | "MEMBER") {
  if (role === "OWNER") return "PROPIETARIO";
  if (role === "MODERATOR") return "MODERADOR";
  return "MIEMBRO";
}

function statusLabel(status: MatchPreview["effectivePhase"]) {
  const labels = {
    DRAFT: "BORRADOR",
    OPEN: "ABIERTO",
    IN_PROGRESS: "EN JUEGO",
    AWAITING_RESULT: "ESPERANDO RESULTADO",
    VOTING_OPEN: "VOTACIÓN ABIERTA",
    FINISHED: "FINALIZADO",
    CANCELLED: "CANCELADO",
  } as const;
  return labels[status];
}

function formatDecimal(value: string | null) {
  return value === null ? "—" : Number(value).toFixed(1);
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}
