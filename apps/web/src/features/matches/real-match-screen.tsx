"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button, Text } from "@football/ui";

import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { queryPolicy } from "@/lib/api/query-policy";
import { ReportControl } from "@/components/report-control/report-control";

import styles from "./matches.module.css";
import { InviteConnectionControl } from "@/features/directed-invitations/invite-connection-control";

export function RealMatchScreen({ matchId }: Readonly<{ matchId: string }>) {
  const queryClient = useQueryClient();
  const match = useQuery({
    ...queryPolicy.volatile,
    queryKey: queryKeys.match(matchId),
    queryFn: () => api.match(matchId),
  });
  const roster = useQuery({
    ...queryPolicy.volatile,
    queryKey: queryKeys.roster(matchId),
    queryFn: () => api.roster(matchId),
    refetchInterval: match.data?.status === "OPEN" ? 30_000 : false,
  });
  const teams = useQuery({
    ...queryPolicy.volatile,
    queryKey: queryKeys.teams(matchId),
    queryFn: () => api.teams(matchId),
  });
  const closureEnabled =
    match.data?.status === "STARTED" || match.data?.status === "FINISHED";
  const finalRoster = useQuery({
    queryKey: queryKeys.finalRoster(matchId),
    queryFn: () => api.finalRoster(matchId),
    enabled: closureEnabled,
  });
  const result = useQuery({
    queryKey: queryKeys.result(matchId),
    queryFn: () => api.result(matchId),
    enabled: closureEnabled,
  });
  const progression = useQuery({
    queryKey: queryKeys.progressionReveal(matchId),
    queryFn: () => api.progressionReveal(matchId),
    enabled: match.data?.status === "FINISHED",
    retry: false,
  });
  const groupId = match.data?.groupId;
  const guests = useQuery({
    queryKey: queryKeys.groupGuests(groupId ?? "none"),
    queryFn: () => api.groupGuests(groupId!),
    enabled: Boolean(groupId),
  });
  const policy = useQuery({
    queryKey: queryKeys.guestPolicy(groupId ?? "none"),
    queryFn: () => api.guestPolicy(groupId!),
    enabled: Boolean(groupId),
  });
  const preferences = useQuery({
    queryKey: queryKeys.footballPreferences,
    queryFn: api.preferences,
  });
  const [guestId, setGuestId] = useState("");
  const [newGuestName, setNewGuestName] = useState("");
  const [guestFeedback, setGuestFeedback] = useState<string | null>(null);
  const [demoteId, setDemoteId] = useState("");
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [cancelMatchConfirmOpen, setCancelMatchConfirmOpen] = useState(false);

  useEffect(() => {
    if (!finalRoster.data?.votingStartsAt || finalRoster.data.votingStarted)
      return;
    const startsAt = new Date(finalRoster.data.votingStartsAt).getTime();
    const delay = Math.min(
      Math.max(startsAt - Date.now() + 250, 1_000),
      2_147_000_000,
    );
    const timeout = window.setTimeout(() => void finalRoster.refetch(), delay);
    return () => window.clearTimeout(timeout);
  }, [finalRoster.data, finalRoster.dataUpdatedAt, finalRoster.refetch]);

  const activeGroupGuestIds = useMemo(
    () =>
      new Set(
        [...(roster.data?.confirmed ?? []), ...(roster.data?.waitlist ?? [])]
          .filter((participant) => participant.kind === "GUEST")
          .map((participant) => participant.groupGuestId)
          .filter((id): id is string => Boolean(id)),
      ),
    [roster.data],
  );

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.match(matchId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roster(matchId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.teams(matchId) }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.personalMatchesRoot,
      }),
    ]);
  }
  const publish = useMutation({
    mutationFn: () => api.publishMatch(matchId),
    onSuccess: refresh,
  });
  const join = useMutation({
    mutationFn: () => api.joinMatch(matchId),
    onSuccess: refresh,
  });
  const leave = useMutation({
    mutationFn: () => api.leaveMatch(matchId),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: (participantId: string) =>
      api.cancelParticipant(matchId, participantId),
    onSuccess: refresh,
  });
  const saveRecruitment = useMutation({
    mutationFn: (input: {
      enabled: boolean;
      needs: { role: RecruitmentRole; quantity: number }[];
    }) => api.saveRecruitment(matchId, input),
    onSuccess: refresh,
  });
  const swap = useMutation({
    mutationFn: (promoteId: string) =>
      api.swapWaitlist(matchId, promoteId, demoteId),
    onSuccess: refresh,
  });
  const addGuest = useMutation({
    mutationFn: (id: string) => api.addGuestToMatch(matchId, id),
    onSuccess: async (result) => {
      const guestName =
        guests.data?.find((guest) => guest.id === guestId)?.displayName ??
        "El invitado";
      setGuestFeedback(
        result.status === "CONFIRMED"
          ? `${guestName} quedó confirmado en el partido.`
          : `${guestName} quedó en la lista de espera.`,
      );
      setGuestId("");
      await refresh();
    },
  });
  const createAndAddGuest = useMutation({
    mutationFn: async () => {
      const guestName = newGuestName.trim();
      const created = await api.createGroupGuest(groupId!, guestName);
      const participation = await api.addGuestToMatch(matchId, created.id);
      return { guestName, participation };
    },
    onSuccess: async ({ guestName, participation }) => {
      setGuestFeedback(
        participation.status === "CONFIRMED"
          ? `${guestName} fue creado y quedó confirmado en el partido.`
          : `${guestName} fue creado y quedó en la lista de espera.`,
      );
      setNewGuestName("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.groupGuests(groupId!),
      });
      await refresh();
    },
  });
  const removeGuest = useMutation({
    mutationFn: (participantId: string) =>
      api.removeGuestFromMatch(matchId, participantId),
    onSuccess: refresh,
  });
  const cancelMatch = useMutation({
    mutationFn: () => api.cancelMatch(matchId),
    onSuccess: async () => {
      setCancelMatchConfirmOpen(false);
      await refresh();
      if (groupId)
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.matches(groupId),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.groupActivity(groupId),
          }),
        ]);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.recruitmentOpportunities,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.notificationUnreadCount,
        }),
      ]);
    },
  });
  const mutationError = [
    publish,
    join,
    leave,
    cancel,
    swap,
    addGuest,
    createAndAddGuest,
    removeGuest,
    saveRecruitment,
    cancelMatch,
  ].find((item) => item.isError)?.error;

  if (match.isPending || roster.isPending)
    return (
      <main className={styles.page}>
        <p role="status">Cargando partido…</p>
      </main>
    );
  if (match.isError || roster.isError)
    return (
      <main className={styles.page}>
        <p className={styles.error} role="alert">
          {match.error?.message ?? roster.error?.message}
        </p>
      </main>
    );

  const current = roster.data.currentParticipation;
  const canJoin = match.data.status === "OPEN" && !current;
  const isOpen = match.data.status === "OPEN";
  const date = new Date(match.data.scheduledAt);
  const location = [
    match.data.venue?.displayName ?? match.data.locationText,
    match.data.court?.displayName,
    match.data.venue?.city,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className={styles.page}>
      <Link className={styles.back} href={`/groups/${match.data.groupId}`}>
        ← GRUPO
      </Link>
      <header className={styles.matchHero}>
        <div>
          <Text tone="accent" variant="label">
            {match.data.status} · F5
          </Text>
          <Text as="h1" variant="display-lg">
            {formatMatchDate(date)}
          </Text>
          <Text variant="heading-lg">{location}</Text>
        </div>
        <div className={styles.capacity}>
          <strong>
            {roster.data.confirmedCount}
            <span>/{roster.data.capacity}</span>
          </strong>
          <small>CONFIRMADOS</small>
        </div>
      </header>
      <ReportControl targetId={matchId} targetType="MATCH" />

      {match.data.venue && (
        <div className={styles.rowActions}>
          <Link
            className={styles.teamLink}
            href={`/rankings/venues/${match.data.venue.id}`}
          >
            RANKING DE LA SEDE
          </Link>
          <Link
            className={styles.teamLink}
            href={`/rankings/cities/${match.data.venue.cityKey}`}
          >
            RANKING DE {match.data.venue.city.toLocaleUpperCase("es-AR")}
          </Link>
        </div>
      )}

      {match.data.status === "STARTED" && (
        <div className={styles.playingState}>
          <Text tone="accent" variant="label">
            PARTIDO EN JUEGO
          </Text>
          <strong>Inscripciones y equipos bloqueados.</strong>
          {match.data.canClose && (
            <Link
              className={styles.teamLink}
              href={`/play/matches/${matchId}/close`}
            >
              CERRAR PARTIDO
            </Link>
          )}
        </div>
      )}
      {match.data.status === "CANCELLED" && (
        <section className={styles.cancelledState}>
          <Text tone="accent" variant="label">
            PARTIDO CANCELADO
          </Text>
          <Text as="h2" variant="heading-lg">
            La convocatoria quedó cerrada.
          </Text>
          <Text tone="muted">
            El roster se conserva como historia operativa, pero ya no se puede
            anotar, iniciar, reclutar ni votar.
          </Text>
        </section>
      )}
      {match.data.status === "FINISHED" && result.data && (
        <section className={styles.finishedState}>
          <div>
            <Text tone="accent" variant="label">
              FINALIZADO
            </Text>
            <Text as="h2" variant="display-lg">
              {result.data.status === "NOT_PLAYED"
                ? "PARTIDO NO JUGADO"
                : result.data.status === "CONFIRMED"
                  ? `${result.data.teamAGoals} — ${result.data.teamBGoals}`
                  : "CIERRE PENDIENTE"}
            </Text>
            {finalRoster.data?.confirmedAt && (
              <p className={styles.muted}>
                {
                  finalRoster.data.participants.filter(
                    (item) => item.attendance === "PLAYED",
                  ).length
                }{" "}
                jugaron ·{" "}
                {
                  finalRoster.data.participants.filter(
                    (item) => item.attendance === "NO_SHOW",
                  ).length
                }{" "}
                ausente
              </p>
            )}
          </div>
          <div className={styles.rowActions}>
            {progression.data?.status === "AVAILABLE" ||
            (progression.data?.status === "PROGRESSION_PENDING" &&
              ["READY_TO_MATERIALIZE", "EARLIER_MATCH_PENDING"].includes(
                progression.data.reason,
              )) ? (
              <Link
                className={styles.teamLink}
                href={`/play/matches/${matchId}/progression`}
              >
                VER MI PROGRESO
              </Link>
            ) : null}
            {result.data.status === "CONFIRMED" &&
            finalRoster.data?.votingStarted ? (
              <Link
                className={styles.teamLink}
                href={`/play/matches/${matchId}/voting`}
              >
                IR A VOTACIÓN
              </Link>
            ) : result.data.status === "CONFIRMED" &&
              finalRoster.data?.votingStartsAt ? (
              <span className={styles.muted}>
                Votación disponible a las{" "}
                {new Date(finalRoster.data.votingStartsAt).toLocaleTimeString(
                  "es-AR",
                  { hour: "2-digit", minute: "2-digit" },
                )}
              </span>
            ) : null}
            {(finalRoster.data?.confirmedAt ||
              result.data.status === "CONFIRMED" ||
              result.data.status === "NOT_PLAYED" ||
              finalRoster.data?.closureEditable) && (
              <Link
                className={styles.teamLink}
                href={`/play/matches/${matchId}/close`}
              >
                {finalRoster.data?.closureEditable
                  ? result.data.status === "CONFIRMED" ||
                    result.data.status === "NOT_PLAYED"
                    ? "VER / CORREGIR CIERRE"
                    : "COMPLETAR CIERRE"
                  : "VER CIERRE"}
              </Link>
            )}
          </div>
        </section>
      )}

      {match.data.scheduleChange && (
        <div className={styles.scheduleNotice}>
          <strong>HORARIO ACTUALIZADO</strong>
          <span>
            Antes: {formatTime(match.data.scheduleChange.previousScheduledAt)} ·
            Ahora: {formatTime(match.data.scheduledAt)}
          </span>
        </div>
      )}
      {match.data.canManage &&
        (match.data.status === "DRAFT" || match.data.status === "OPEN") && (
          <section className={styles.managementActions}>
            <div>
              <Text tone="accent" variant="label">
                OPERACIÓN
              </Text>
              <Text as="h2" variant="heading-lg">
                Administrar partido.
              </Text>
            </div>
            <div className={styles.actions}>
              <Link
                className="ui-button ui-button--secondary"
                href={`/play/matches/${matchId}/edit`}
              >
                Editar datos
              </Link>
              <Button
                onClick={() => setCancelMatchConfirmOpen(true)}
                variant="quiet"
              >
                Cancelar partido
              </Button>
            </div>
          </section>
        )}
      <RecruitmentPanel
        canManage={match.data.canManage}
        isProfileMatch={matchesProfile(
          match.data.recruitment.needs,
          preferences.data,
        )}
        onSave={(input) => saveRecruitment.mutate(input)}
        pending={saveRecruitment.isPending}
        recruitment={match.data.recruitment}
        status={match.data.status}
      />
      {match.data.canManage && match.data.status === "OPEN" && (
        <InviteConnectionControl
          destinationId={matchId}
          kind="match"
          recruitment={match.data.recruitment}
        />
      )}
      <section className={styles.personalState}>
        <div>
          <Text tone="accent" variant="label">
            TU ESTADO
          </Text>
          <Text as="h2" variant="heading-lg">
            {current
              ? current.status === "CONFIRMED"
                ? `Estás confirmado · #${current.admissionNumber}`
                : `Estás en espera · #${current.admissionNumber}`
              : personalStateCopy(match.data.status)}
          </Text>
          {current?.status === "WAITLISTED" && (
            <p>{current.waitlistPosition}.º suplente</p>
          )}
          {current?.promotedAt && (
            <p className={styles.positive}>
              Entraste al partido. Ahora estás confirmado.
            </p>
          )}
        </div>
        <div className={styles.actions}>
          {match.data.status === "DRAFT" && match.data.canManage && (
            <Button
              disabled={publish.isPending}
              onClick={() => publish.mutate()}
            >
              Publicar convocatoria
            </Button>
          )}
          {canJoin && (
            <Button disabled={join.isPending} onClick={() => join.mutate()}>
              Anotarme
            </Button>
          )}
          {isOpen && current && (
            <Button
              disabled={leave.isPending}
              onClick={() => setLeaveConfirmOpen(true)}
              variant="secondary"
            >
              Darme de baja
            </Button>
          )}
        </div>
      </section>
      <ConfirmDialog
        confirmDisabled={leave.isPending}
        confirmLabel="Darme de baja"
        eyebrow="SALIR DEL PARTIDO"
        message="Vas a liberar tu lugar. Si hay jugadores en espera, el siguiente podrá ser promovido automáticamente."
        onCancel={() => setLeaveConfirmOpen(false)}
        onConfirm={() => {
          setLeaveConfirmOpen(false);
          leave.mutate();
        }}
        open={leaveConfirmOpen}
        title="¿Querés darte de baja?"
      />
      <ConfirmDialog
        confirmDisabled={cancelMatch.isPending}
        confirmLabel="Cancelar partido"
        eyebrow="CANCELAR PARTIDO"
        message="La convocatoria quedará cerrada y no podrá iniciarse. Los participantes y la historia se conservarán."
        onCancel={() => setCancelMatchConfirmOpen(false)}
        onConfirm={() => cancelMatch.mutate()}
        open={cancelMatchConfirmOpen}
        title="¿Cancelar este partido?"
      />

      {mutationError && (
        <p className={styles.error} role="alert">
          {mutationError.message}
        </p>
      )}

      {teams.isError && (
        <p className={styles.auxiliaryError} role="status">
          No pudimos cargar los equipos. El estado y el roster del partido
          siguen disponibles.
        </p>
      )}
      {closureEnabled && (finalRoster.isError || result.isError) && (
        <p className={styles.auxiliaryError} role="status">
          No pudimos cargar el cierre deportivo. Podés seguir consultando el
          partido e intentar nuevamente desde Cerrar partido.
        </p>
      )}

      {!teams.isPending && !teams.isError && (
        <section className={styles.teamsSummary}>
          <div>
            <Text tone="accent" variant="label">
              EQUIPOS
            </Text>
            <Text as="h2" variant="heading-lg">
              {teams.data.assignedCount > 0
                ? `Equipo A · ${teams.data.TEAM_A.participants.length} / Equipo B · ${teams.data.TEAM_B.participants.length}`
                : "Los equipos todavía no fueron armados."}
            </Text>
            {teams.data.rosterChanged && (
              <p className={styles.teamWarning} role="alert">
                <strong>CAMBIÓ LA LISTA DE JUGADORES</strong>
                <span>Revisá o regenerá los equipos antes de iniciar.</span>
              </p>
            )}
            {match.data.status === "STARTED" && (
              <p className={styles.muted}>
                Al terminar el partido, cargá asistencia, resultado y
                estadísticas desde el cierre.
              </p>
            )}
          </div>
          <Link
            className={styles.teamLink}
            href={`/play/matches/${matchId}/teams`}
          >
            {teams.data.canManage && match.data.status === "OPEN"
              ? teams.data.assignedCount > 0
                ? "EDITAR EQUIPOS"
                : "ARMAR EQUIPOS"
              : "VER EQUIPOS"}
          </Link>
        </section>
      )}

      <div className={styles.rosterGrid}>
        <Roster
          title="CONFIRMADOS"
          rows={roster.data.confirmed}
          canManageParticipants={match.data.canManage && isOpen}
          canManageGuests={match.data.canManageGuests && isOpen}
          onCancel={(id) => cancel.mutate(id)}
          onRemoveGuest={(id) => removeGuest.mutate(id)}
        />
        <section className={styles.rosterSection}>
          <Text as="h2" variant="heading-lg">
            EN ESPERA
          </Text>
          {roster.data.waitlist.length === 0 ? (
            <p className={styles.muted}>No hay suplentes.</p>
          ) : (
            roster.data.waitlist.map((participant, index) => (
              <article className={styles.rosterRow} key={participant.id}>
                <span>#{participant.position}</span>
                <strong>{participant.displayName}</strong>
                <small>
                  {index + 1}.º suplente
                  {participant.kind === "GUEST" ? " · INVITADO" : ""}
                </small>
                {isOpen &&
                  ((participant.kind === "PLAYER" && match.data.canManage) ||
                    (participant.kind === "GUEST" &&
                      (participant.addedByCurrentActor ||
                        match.data.canManageGuests))) && (
                    <div className={styles.rowActions}>
                      <Button
                        disabled={cancel.isPending || removeGuest.isPending}
                        onClick={() =>
                          participant.kind === "GUEST"
                            ? removeGuest.mutate(participant.id)
                            : cancel.mutate(participant.id)
                        }
                        variant="quiet"
                      >
                        {participant.kind === "GUEST" ? "Retirar" : "Cancelar"}
                      </Button>
                      {match.data.canManage && demoteId && (
                        <Button
                          disabled={swap.isPending}
                          onClick={() => swap.mutate(participant.id)}
                          variant="quiet"
                        >
                          Confirmar por swap
                        </Button>
                      )}
                    </div>
                  )}
              </article>
            ))
          )}
          {match.data.canManage &&
            isOpen &&
            roster.data.waitlist.length > 0 && (
              <label className={styles.compactField}>
                <span>CONFIRMADO A PASAR A ESPERA</span>
                <select
                  onChange={(event) => setDemoteId(event.target.value)}
                  value={demoteId}
                >
                  <option value="">Seleccionar…</option>
                  {roster.data.confirmed.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.displayName}
                    </option>
                  ))}
                </select>
                <small>
                  El swap conserva el cupo y manda al confirmado al final de la
                  espera.
                </small>
              </label>
            )}
        </section>
      </div>

      {isOpen && (
        <>
          {(guests.isError || policy.isError) && (
            <p className={styles.auxiliaryError} role="status">
              No pudimos cargar las opciones de invitados. El roster principal
              sigue disponible.
            </p>
          )}
          <GuestControls
            guestId={guestId}
            guests={(guests.data ?? []).filter(
              (guest) => !activeGroupGuestIds.has(guest.id),
            )}
            feedback={guestFeedback}
            newGuestName={newGuestName}
            policy={policy.data}
            setGuestId={(id) => {
              setGuestFeedback(null);
              setGuestId(id);
            }}
            setNewGuestName={(name) => {
              setGuestFeedback(null);
              setNewGuestName(name);
            }}
            add={() => {
              setGuestFeedback(null);
              addGuest.mutate(guestId);
            }}
            create={() => {
              setGuestFeedback(null);
              createAndAddGuest.mutate();
            }}
          />
        </>
      )}
    </main>
  );
}

type RecruitmentRole = "LIBRE" | "DEFENSIVO" | "MEDIO" | "OFENSIVO" | "PORTERO";
const recruitmentRoles: RecruitmentRole[] = [
  "LIBRE",
  "DEFENSIVO",
  "MEDIO",
  "OFENSIVO",
  "PORTERO",
];

function RecruitmentPanel({
  canManage,
  isProfileMatch,
  onSave,
  pending,
  recruitment,
  status,
}: Readonly<{
  canManage: boolean;
  isProfileMatch: boolean;
  onSave: (input: {
    enabled: boolean;
    needs: { role: RecruitmentRole; quantity: number }[];
  }) => void;
  pending: boolean;
  recruitment: {
    enabled: boolean;
    effectiveStatus: "CLOSED" | "OPEN" | "FULL";
    openSpots: number;
    needs: { role: RecruitmentRole; quantity: number }[];
  };
  status: string;
}>) {
  const [enabled, setEnabled] = useState(recruitment.enabled);
  const [needs, setNeeds] = useState(recruitment.needs);
  useEffect(() => {
    setEnabled(recruitment.enabled);
    setNeeds(recruitment.needs);
  }, [recruitment]);
  const editable = canManage && (status === "DRAFT" || status === "OPEN");
  return (
    <section className={styles.recruitment}>
      <div>
        <Text tone="accent" variant="label">
          RECLUTAMIENTO
        </Text>
        <Text as="h2" variant="heading-lg">
          {recruitment.effectiveStatus === "FULL"
            ? "PARTIDO COMPLETO"
            : recruitment.effectiveStatus === "OPEN"
              ? `BUSCAMOS ${recruitment.openSpots} ${recruitment.openSpots === 1 ? "JUGADOR" : "JUGADORES"}`
              : "BÚSQUEDA CERRADA"}
        </Text>
        {recruitment.enabled && recruitment.needs.length > 0 && (
          <Text tone="muted">
            {recruitment.needs
              .map((need) => `${need.quantity} ${need.role}`)
              .join(" · ")}
          </Text>
        )}
        {isProfileMatch && recruitment.effectiveStatus === "OPEN" && (
          <Text tone="accent" variant="label">
            COINCIDE CON TU PERFIL
          </Text>
        )}
      </div>
      {editable && (
        <details>
          <summary>BUSCAR JUGADORES</summary>
          <label className={styles.recruitmentToggle}>
            <input
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              type="checkbox"
            />
            Publicar que buscamos jugadores
          </label>
          <div className={styles.needGrid}>
            {recruitmentRoles.map((role) => {
              const need = needs.find((item) => item.role === role);
              return (
                <label key={role}>
                  <span>{role}</span>
                  <input
                    aria-label={`Cantidad para ${role}`}
                    min="0"
                    step="1"
                    onChange={(event) => {
                      const quantity = Number(event.target.value);
                      setNeeds((current) => [
                        ...current.filter((item) => item.role !== role),
                        ...(quantity > 0 ? [{ role, quantity }] : []),
                      ]);
                    }}
                    type="number"
                    value={need?.quantity ?? 0}
                  />
                </label>
              );
            })}
          </div>
          <Button
            disabled={pending}
            onClick={() => onSave({ enabled, needs })}
            variant="secondary"
          >
            Guardar búsqueda
          </Button>
        </details>
      )}
    </section>
  );
}

function matchesProfile(
  needs: { role: RecruitmentRole }[],
  preferences?: {
    preferredRoles: RecruitmentRole[];
    willingToPlayGoalkeeper: boolean;
  },
) {
  if (!preferences) return false;
  return needs.some(
    (need) =>
      preferences.preferredRoles.includes(need.role) ||
      (need.role === "PORTERO" && preferences.willingToPlayGoalkeeper),
  );
}

function Roster({
  title,
  rows,
  canManageParticipants,
  canManageGuests,
  onCancel,
  onRemoveGuest,
}: Readonly<{
  title: string;
  rows: Awaited<ReturnType<typeof api.roster>>["confirmed"];
  canManageParticipants: boolean;
  canManageGuests: boolean;
  onCancel: (id: string) => void;
  onRemoveGuest: (id: string) => void;
}>) {
  return (
    <section className={styles.rosterSection}>
      <Text as="h2" variant="heading-lg">
        {title}
      </Text>
      {rows.length === 0 ? (
        <p className={styles.muted}>Todavía no hay jugadores.</p>
      ) : (
        rows.map((participant) => (
          <article className={styles.rosterRow} key={participant.id}>
            <span>#{participant.position}</span>
            <strong>{participant.displayName}</strong>
            <small>
              {participant.kind === "GUEST" ? "INVITADO" : "JUGADOR"}
            </small>
            {(participant.addedByCurrentActor || canManageGuests) &&
            participant.kind === "GUEST" ? (
              <Button
                onClick={() => onRemoveGuest(participant.id)}
                variant="quiet"
              >
                Retirar
              </Button>
            ) : canManageParticipants && participant.kind === "PLAYER" ? (
              <Button onClick={() => onCancel(participant.id)} variant="quiet">
                Cancelar
              </Button>
            ) : null}
          </article>
        ))
      )}
    </section>
  );
}

type GuestPolicy = Awaited<ReturnType<typeof api.guestPolicy>> | undefined;
function GuestControls({
  feedback,
  guestId,
  guests,
  newGuestName,
  policy,
  setGuestId,
  setNewGuestName,
  add,
  create,
}: Readonly<{
  feedback: string | null;
  guestId: string;
  guests: Awaited<ReturnType<typeof api.groupGuests>>;
  newGuestName: string;
  policy: GuestPolicy;
  setGuestId: (id: string) => void;
  setNewGuestName: (name: string) => void;
  add: () => void;
  create: () => void;
}>) {
  if (!policy) return null;
  if (!policy.guestsEnabled)
    return (
      <section className={styles.guestPanel}>
        <Text as="h2" variant="heading-lg">
          Invitados
        </Text>
        <p>Este grupo no acepta invitados por el momento.</p>
      </section>
    );
  const allowed = policy.canOverride || (policy.effectiveAllowance ?? 0) > 0;
  return (
    <section className={styles.guestPanel}>
      <Text tone="accent" variant="label">
        INVITADOS
      </Text>
      <Text as="h2" variant="heading-lg">
        Sumar a alguien.
      </Text>
      {!allowed ? (
        <p>No tenés habilitado agregar invitados en este grupo.</p>
      ) : (
        <div className={styles.guestControls}>
          <label>
            <span>Invitado existente</span>
            <select
              onChange={(event) => setGuestId(event.target.value)}
              value={guestId}
            >
              <option value="">Seleccionar…</option>
              {guests
                .filter((guest) => guest.status === "ACTIVE")
                .map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {guest.displayName}
                  </option>
                ))}
            </select>
          </label>
          <Button disabled={!guestId} onClick={add} variant="secondary">
            Agregar invitado
          </Button>
          <span className={styles.or}>O CREAR IDENTIDAD</span>
          <label>
            <span>Nombre</span>
            <input
              onChange={(event) => setNewGuestName(event.target.value)}
              value={newGuestName}
            />
          </label>
          <Button disabled={!newGuestName.trim()} onClick={create}>
            Crear y agregar
          </Button>
          {feedback && (
            <p className={styles.positive} role="status">
              {feedback}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function personalStateCopy(status: string) {
  if (status === "DRAFT") return "Convocatoria en Draft";
  if (status === "CANCELLED") return "Partido cancelado";
  if (status === "STARTED") return "Partido en juego";
  if (status === "FINISHED") return "Partido finalizado";
  return "Todavía no te anotaste";
}

function formatMatchDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
