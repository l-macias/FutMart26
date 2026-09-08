"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge, Button, Text } from "@football/ui";
import { MatchStateMark } from "@football/football-ui";

import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { queryPolicy } from "@/lib/api/query-policy";
import { ReportControl } from "@/components/report-control/report-control";

import styles from "./matches.module.css";
import { InviteConnectionControl } from "@/features/directed-invitations/invite-connection-control";
import { matchInformationArchitecture } from "./match-information-architecture";

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
    refetchInterval: match.data?.effectivePhase === "OPEN" ? 30_000 : false,
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
  const actorPlayed =
    finalRoster.data?.participants.some(
      (participant) =>
        participant.isCurrentActor &&
        participant.kind === "PLAYER" &&
        participant.attendance === "PLAYED",
    ) ?? false;
  const progression = useQuery({
    queryKey: queryKeys.progressionReveal(matchId),
    queryFn: () => api.progressionReveal(matchId),
    enabled: match.data?.status === "FINISHED" && actorPlayed,
    retry: false,
  });
  const groupId = match.data?.groupId;
  const group = useQuery({
    queryKey: queryKeys.group(groupId ?? "none"),
    queryFn: () => api.group(groupId!),
    enabled: Boolean(groupId) && match.data?.status === "FINISHED",
  });
  const voting = useQuery({
    queryKey: queryKeys.voting(matchId),
    queryFn: () => api.voting(matchId),
    enabled:
      match.data?.status === "FINISHED" &&
      actorPlayed &&
      result.data?.status === "CONFIRMED" &&
      finalRoster.data?.votingStarted === true,
  });
  const guests = useQuery({
    queryKey: queryKeys.groupGuests(groupId ?? "none"),
    queryFn: () => api.groupGuests(groupId!),
    enabled:
      Boolean(groupId) &&
      match.data?.effectivePhase === "OPEN" &&
      Boolean(match.data.canManage || match.data.canManageGuests),
  });
  const policy = useQuery({
    queryKey: queryKeys.guestPolicy(groupId ?? "none"),
    queryFn: () => api.guestPolicy(groupId!),
    enabled:
      Boolean(groupId) &&
      match.data?.effectivePhase === "OPEN" &&
      Boolean(match.data.canManage || match.data.canManageGuests),
  });
  const preferences = useQuery({
    queryKey: queryKeys.footballPreferences,
    queryFn: api.preferences,
    enabled:
      Boolean(match.data?.canManage) &&
      (match.data?.effectivePhase === "DRAFT" ||
        match.data?.effectivePhase === "OPEN"),
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
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: queryKeys.match(matchId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roster(matchId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.teams(matchId) }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.personalMatchesRoot,
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.personalHome }),
    ];
    if (groupId)
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: queryKeys.groupOverview(groupId),
        }),
      );
    await Promise.all(invalidations);
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
            queryKey: queryKeys.groupOverview(groupId),
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
  const canJoin = match.data.effectivePhase === "OPEN" && !current;
  const isOpen = match.data.effectivePhase === "OPEN";
  const date = new Date(match.data.scheduledAt);
  const location = [
    match.data.venue?.displayName ?? match.data.locationText,
    match.data.court?.displayName,
    match.data.venue?.city,
  ]
    .filter(Boolean)
    .join(" · ");
  const composition = matchInformationArchitecture(
    match.data.effectivePhase,
    match.data.canManage || match.data.canManageGuests || match.data.canClose,
  );

  if (composition.showFinishedSummary)
    return (
      <FinishedMatchView
        finalRoster={finalRoster.data}
        groupName={group.data?.name}
        location={location}
        match={match.data}
        matchId={matchId}
        progression={progression.data}
        result={result.data}
        teams={teams.data}
        voting={voting.data}
      />
    );

  if (composition.showStartedTeams)
    return (
      <StartedMatchView
        canClose={match.data.canClose}
        canManage={match.data.canManage}
        effectivePhase={match.data.effectivePhase}
        groupId={match.data.groupId}
        location={location}
        matchId={matchId}
        persistedStatus={match.data.status}
        scheduledAt={match.data.scheduledAt}
        teams={teams.data}
        teamsError={teams.isError}
        teamsPending={teams.isPending}
      />
    );

  if (match.data.effectivePhase === "CANCELLED")
    return (
      <CancelledMatchView
        groupId={match.data.groupId}
        location={location}
        matchId={matchId}
        roster={roster.data}
        scheduledAt={match.data.scheduledAt}
      />
    );

  return (
    <main className={styles.page}>
      <Link className={styles.back} href={`/groups/${match.data.groupId}`}>
        ← GRUPO
      </Link>
      <header
        className={`${styles.matchHero} ${isOpen ? styles.openHero : styles.draftHero}`}
      >
        <div>
          <div className={styles.heroState}>
            <MatchStateMark tone={isOpen ? "positive" : "neutral"}>
              {isOpen ? "ABIERTO" : "BORRADOR"}
            </MatchStateMark>
            <span>F5</span>
          </div>
          <Text as="h1" variant="display-lg">
            {formatMatchDate(date)}
          </Text>
          <Text variant="heading-lg">{location}</Text>
          {isOpen && (
            <Text className={styles.heroStatus} tone="muted" variant="metadata">
              {match.data.recruitment.effectiveStatus === "CLOSED"
                ? "Convocatoria cerrada"
                : match.data.recruitment.effectiveStatus === "FULL"
                  ? "Cupo completo"
                  : "Convocatoria abierta"}
            </Text>
          )}
        </div>
        <div
          aria-label={`${roster.data.confirmedCount} de ${roster.data.capacity} confirmados`}
          className={styles.capacity}
        >
          <strong>
            {roster.data.confirmedCount}
            <span>/{roster.data.capacity}</span>
          </strong>
          <small>CONFIRMADOS</small>
          {isOpen && (
            <small>
              {roster.data.availableSpots === 0
                ? "CUPO COMPLETO"
                : `FALTAN ${roster.data.availableSpots}`}
            </small>
          )}
        </div>
      </header>
      {match.data.scheduleChange && (
        <div className={styles.scheduleNotice}>
          <strong>HORARIO ACTUALIZADO</strong>
          <span>
            Antes: {formatTime(match.data.scheduleChange.previousScheduledAt)} ·
            Ahora: {formatTime(match.data.scheduledAt)}
          </span>
        </div>
      )}
      {composition.showAdmission && (
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
              >
                Darme de baja
              </Button>
            )}
          </div>
        </section>
      )}
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
        tone="danger"
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

      {composition.showOperationalRoster && (
        <MatchRoster
          canManageGuests={false}
          canManageParticipants={false}
          cancelPending={false}
          demoteId=""
          onCancel={() => undefined}
          onDemoteChange={() => undefined}
          onRemoveGuest={() => undefined}
          onSwap={() => undefined}
          removeGuestPending={false}
          roster={roster.data}
          showActions={false}
          swapPending={false}
        />
      )}

      {!teams.isPending && !teams.isError && isOpen && (
        <section className={styles.teamsSummary}>
          <div>
            <Text tone="accent" variant="label">
              EQUIPOS
            </Text>
            <Text as="h2" variant="heading-lg">
              {teams.data.assignedCount > 0
                ? `Equipo A · ${teams.data.TEAM_A.participants.length} / Equipo B · ${teams.data.TEAM_B.participants.length}`
                : "Pendientes"}
            </Text>
            {teams.data.rosterChanged && (
              <p className={styles.teamWarning} role="alert">
                <strong>CAMBIÓ LA LISTA DE JUGADORES</strong>
                <span>Revisá o regenerá los equipos antes de iniciar.</span>
              </p>
            )}
          </div>
          {teams.data.assignedCount > 0 && (
            <Link
              className={styles.teamLink}
              href={`/play/matches/${matchId}/teams`}
            >
              VER EQUIPOS
            </Link>
          )}
        </section>
      )}

      {composition.showOrganizerTools && (
        <details className={styles.organizerTools}>
          <summary>
            <span>
              ADMINISTRAR PARTIDO ·{" "}
              {match.data.status === "DRAFT" ? "BORRADOR" : "CONVOCATORIA"}
            </span>
          </summary>
          <div className={styles.organizerContent}>
            {match.data.canManage && (
              <ManagementSection
                description="Fecha, hora, duración, cupo y lugar permitidos por el estado actual."
                title="DATOS"
              >
                <Link
                  className="ui-button ui-button--secondary"
                  href={`/play/matches/${matchId}/edit`}
                >
                  Editar datos
                </Link>
              </ManagementSection>
            )}
            {composition.showRecruitment && match.data.canManage && (
              <ManagementSection
                description="Definí si el partido busca jugadores y qué perfiles necesita."
                title="CONVOCATORIA"
              >
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
              </ManagementSection>
            )}
            {isOpen && (
              <ManagementSection
                description="Invitaciones, confirmados, espera e invitados del partido."
                title="PARTICIPANTES"
              >
                {match.data.canManage && (
                  <InviteConnectionControl
                    destinationId={matchId}
                    kind="match"
                    recruitment={match.data.recruitment}
                  />
                )}
                <MatchRoster
                  canManageGuests={match.data.canManageGuests}
                  canManageParticipants={match.data.canManage}
                  cancelPending={cancel.isPending}
                  demoteId={demoteId}
                  onCancel={(id) => cancel.mutate(id)}
                  onDemoteChange={setDemoteId}
                  onRemoveGuest={(id) => removeGuest.mutate(id)}
                  onSwap={(id) => swap.mutate(id)}
                  removeGuestPending={removeGuest.isPending}
                  roster={roster.data}
                  showActions
                  swapPending={swap.isPending}
                />
                {(guests.isError || policy.isError) && (
                  <p className={styles.auxiliaryError} role="status">
                    No pudimos cargar las opciones de invitados. El roster
                    principal sigue disponible.
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
              </ManagementSection>
            )}
            {isOpen && match.data.canManage && (
              <ManagementSection
                description="Armá o ajustá la composición antes de iniciar."
                title="EQUIPOS"
              >
                <Link
                  className="ui-button ui-button--secondary"
                  href={`/play/matches/${matchId}/teams`}
                >
                  {teams.data?.assignedCount
                    ? "Editar equipos"
                    : "Armar equipos"}
                </Link>
              </ManagementSection>
            )}
            {match.data.canManage && (
              <ManagementSection
                danger
                description="La cancelación cierra la convocatoria y notifica a sus participantes."
                title="ZONA DE RIESGO"
              >
                <Button
                  onClick={() => setCancelMatchConfirmOpen(true)}
                  variant="danger"
                >
                  Cancelar partido
                </Button>
              </ManagementSection>
            )}
          </div>
        </details>
      )}
      <ReportControl targetId={matchId} targetType="MATCH" />
    </main>
  );
}

type MatchRead = Awaited<ReturnType<typeof api.match>>;
type RosterRead = Awaited<ReturnType<typeof api.roster>>;
type FinalRosterRead = Awaited<ReturnType<typeof api.finalRoster>>;
type ResultRead = Awaited<ReturnType<typeof api.result>>;
type TeamsRead = Awaited<ReturnType<typeof api.teams>>;
type VotingRead = Awaited<ReturnType<typeof api.voting>>;
type ProgressionRead = Awaited<ReturnType<typeof api.progressionReveal>>;

function StartedMatchView({
  canClose,
  canManage,
  effectivePhase,
  groupId,
  location,
  matchId,
  persistedStatus,
  scheduledAt,
  teams,
  teamsError,
  teamsPending,
}: Readonly<{
  canClose: boolean;
  canManage: boolean;
  effectivePhase: MatchRead["effectivePhase"];
  groupId: string;
  location: string;
  matchId: string;
  persistedStatus: MatchRead["status"];
  scheduledAt: string;
  teams?: TeamsRead;
  teamsError: boolean;
  teamsPending: boolean;
}>) {
  const awaitingResult = effectivePhase === "AWAITING_RESULT";
  const canLoadClosure = persistedStatus === "STARTED" && canClose;
  return (
    <main className={styles.page}>
      <Link className={styles.back} href={`/groups/${groupId}`}>
        ← GRUPO
      </Link>
      <header className={`${styles.matchHero} ${styles.startedHero}`}>
        <div>
          <div className={styles.heroState}>
            <MatchStateMark tone={awaitingResult ? "warning" : "positive"}>
              {awaitingResult ? "ESPERANDO RESULTADO" : "EN JUEGO"}
            </MatchStateMark>
            <span>F5</span>
          </div>
          <Text as="h1" variant="display-lg">
            {formatMatchDate(new Date(scheduledAt))}
          </Text>
          <Text variant="heading-lg">{location}</Text>
        </div>
        <div
          className={styles.startedMatchup}
          aria-label="Equipo A contra Equipo B"
        >
          <strong>EQUIPO A</strong>
          <span>VS</span>
          <strong>EQUIPO B</strong>
        </div>
      </header>
      {teamsPending ? (
        <p role="status">Cargando equipos…</p>
      ) : teams && teams.assignedCount > 0 ? (
        <section className={styles.startedTeams}>
          <StartedTeam
            label="EQUIPO A"
            participants={teams.TEAM_A.participants}
          />
          <StartedTeam
            label="EQUIPO B"
            participants={teams.TEAM_B.participants}
          />
        </section>
      ) : teamsError ? (
        <p className={styles.auxiliaryError} role="status">
          No pudimos mostrar la composición de los equipos.
        </p>
      ) : (
        <p className={styles.muted}>Los equipos no están disponibles.</p>
      )}
      {(canLoadClosure || canManage) && (
        <details className={styles.organizerTools}>
          <summary>
            <span>
              ADMINISTRAR PARTIDO ·{" "}
              {awaitingResult ? "ESPERANDO RESULTADO" : "EN JUEGO"}
            </span>
          </summary>
          <div className={styles.organizerContent}>
            {canLoadClosure ? (
              <>
                <ManagementSection
                  description="Marcá quién jugó y quién no se presentó."
                  title="ASISTENCIA"
                >
                  <Text tone="muted">
                    Se completa junto con el cierre deportivo.
                  </Text>
                </ManagementSection>
                <ManagementSection
                  description="Cargá resultado, goles y asistencias antes de finalizar."
                  title="RESULTADO Y EVENTOS"
                >
                  <Link
                    className="ui-button ui-button--secondary"
                    href={`/play/matches/${matchId}/close`}
                  >
                    Cargar cierre
                  </Link>
                </ManagementSection>
                <ManagementSection
                  description="Revisá la planilla y confirmá el final del partido."
                  title="CIERRE"
                >
                  <Link
                    className="ui-button ui-button--secondary"
                    href={`/play/matches/${matchId}/close`}
                  >
                    Revisar y finalizar
                  </Link>
                </ManagementSection>
              </>
            ) : (
              <ManagementSection
                description="Confirmá los equipos e iniciá el partido antes de cargar el resultado."
                title="PREPARAR CIERRE"
              >
                <Link
                  className="ui-button ui-button--secondary"
                  href={`/play/matches/${matchId}/teams`}
                >
                  Revisar equipos
                </Link>
              </ManagementSection>
            )}
          </div>
        </details>
      )}
      <ReportControl targetId={matchId} targetType="MATCH" />
    </main>
  );
}

function StartedTeam({
  label,
  participants,
}: Readonly<{
  label: string;
  participants: TeamsRead["TEAM_A"]["participants"];
}>) {
  return (
    <section className={styles.startedTeam}>
      <Text as="h2" variant="heading-lg">
        {label}
      </Text>
      {participants.map((participant) => (
        <article
          className={styles.startedPlayer}
          key={participant.participantId}
        >
          <div>
            <strong>{participant.displayName}</strong>
            {participant.kind === "GUEST" ? (
              <Badge kind="role">INVITADO</Badge>
            ) : null}
          </div>
          <span className={styles.rosterOvr}>
            {participant.internalOvr
              ? `${Math.round(Number(participant.internalOvr))} OVR`
              : "—"}
          </span>
        </article>
      ))}
    </section>
  );
}

function CancelledMatchView({
  groupId,
  location,
  matchId,
  roster,
  scheduledAt,
}: Readonly<{
  groupId: string;
  location: string;
  matchId: string;
  roster: RosterRead;
  scheduledAt: string;
}>) {
  return (
    <main className={styles.page}>
      <Link className={styles.back} href={`/groups/${groupId}`}>
        ← GRUPO
      </Link>
      <header className={`${styles.matchHero} ${styles.cancelledHero}`}>
        <div>
          <div className={styles.heroState}>
            <MatchStateMark tone="negative">CANCELADO</MatchStateMark>
            <span>F5</span>
          </div>
          <Text as="h1" variant="display-lg">
            {formatMatchDate(new Date(scheduledAt))}
          </Text>
          <Text variant="heading-lg">{location}</Text>
        </div>
      </header>
      <section className={styles.cancelledState}>
        <Text as="h2" variant="heading-lg">
          La convocatoria quedó cerrada.
        </Text>
        <Text tone="muted">
          Se conserva el plantel registrado como historia operativa.
        </Text>
      </section>
      <Roster
        canManageGuests={false}
        canManageParticipants={false}
        onCancel={() => undefined}
        onRemoveGuest={() => undefined}
        rows={roster.confirmed}
        showActions={false}
        title={`CONFIRMADOS · ${roster.confirmed.length}`}
      />
      <ReportControl targetId={matchId} targetType="MATCH" />
    </main>
  );
}

function FinishedMatchView({
  finalRoster,
  groupName,
  location,
  match,
  matchId,
  progression,
  result,
  teams,
  voting,
}: Readonly<{
  finalRoster?: FinalRosterRead;
  groupName?: string;
  location: string;
  match: MatchRead;
  matchId: string;
  progression?: ProgressionRead;
  result?: ResultRead;
  teams?: TeamsRead;
  voting?: VotingRead;
}>) {
  const actorParticipant = finalRoster?.participants.find(
    (participant) => participant.isCurrentActor,
  );
  const actorPlayed = actorParticipant?.attendance === "PLAYED";
  const actorTeamParticipant = teams
    ? [...teams.TEAM_A.participants, ...teams.TEAM_B.participants].find(
        (participant) =>
          participant.participantId === actorParticipant?.participantId,
      )
    : undefined;
  const canOpenProgression =
    actorPlayed &&
    voting?.status !== "OPEN" &&
    (progression?.status === "AVAILABLE" ||
      (progression?.status === "PROGRESSION_PENDING" &&
        ["READY_TO_MATERIALIZE", "EARLIER_MATCH_PENDING"].includes(
          progression.reason,
        )));
  const stats = new Map(
    result?.participants.map((row) => [row.participantId, row]) ?? [],
  );

  return (
    <main className={styles.page}>
      <Link className={styles.back} href={`/groups/${match.groupId}`}>
        ← {groupName ? groupName.toLocaleUpperCase("es-AR") : "GRUPO"}
      </Link>
      <header className={`${styles.matchHero} ${styles.finishedHero}`}>
        <div>
          <div className={styles.heroState}>
            <MatchStateMark>FINALIZADO</MatchStateMark>
            <span>F5</span>
          </div>
          <Text as="h1" variant="display-lg">
            {formatMatchDate(new Date(match.scheduledAt))}
          </Text>
          <Text variant="heading-lg">{location}</Text>
        </div>
        <div
          aria-label={
            result?.status === "CONFIRMED"
              ? `Resultado final: Equipo A ${result.teamAGoals}, Equipo B ${result.teamBGoals}`
              : "Resultado final no disponible"
          }
          className={styles.finalScore}
        >
          <small>RESULTADO FINAL</small>
          <div>
            <span>EQUIPO A</span>
            <Text as="span" className={styles.scoreValue} variant="score">
              {result?.status === "CONFIRMED"
                ? `${result.teamAGoals} — ${result.teamBGoals}`
                : result?.status === "NOT_PLAYED"
                  ? "NO JUGADO"
                  : "PENDIENTE"}
            </Text>
            <span>EQUIPO B</span>
          </div>
        </div>
      </header>
      {result?.status === "CONFIRMED" && teams ? (
        <section className={styles.matchSheet}>
          <Text tone="accent" variant="label">
            PLANILLA DEL PARTIDO
          </Text>
          <div className={styles.finishedTeams}>
            <FinishedTeam
              label="EQUIPO A"
              participants={teams.TEAM_A.participants}
              roster={finalRoster}
            />
            <FinishedTeam
              label="EQUIPO B"
              participants={teams.TEAM_B.participants}
              roster={finalRoster}
            />
          </div>
          <FinishedStats participants={teams} stats={stats} />
        </section>
      ) : null}

      {actorPlayed ? (
        <section className={styles.actorMatch}>
          <Text tone="accent" variant="label">
            TU PARTIDO
          </Text>
          {actorTeamParticipant?.rating ? (
            <div className={styles.actorMetrics}>
              <div className={styles.actorNote}>
                <span>NOTA</span>
                <strong>
                  {Number(actorTeamParticipant.rating).toFixed(1)}
                </strong>
              </div>
              {progression?.status === "AVAILABLE" && (
                <div className={styles.actorOvr}>
                  <span>OVR</span>
                  <strong>
                    {Number(progression.snapshot.overall.before).toFixed(1)}
                    <i aria-hidden="true">→</i>
                    {Number(progression.snapshot.overall.after).toFixed(1)}
                  </strong>
                </div>
              )}
            </div>
          ) : (
            <Text as="h2" variant="heading-md">
              Tu evaluación todavía no está disponible
            </Text>
          )}
          <div className={styles.rowActions}>
            {voting?.status === "OPEN" && !voting.hasSubmitted ? (
              <Link
                className="ui-button ui-button--primary"
                href={`/play/matches/${matchId}/voting`}
              >
                VOTAR AHORA
              </Link>
            ) : null}
            {voting?.status === "OPEN" && voting.hasSubmitted ? (
              <span className={styles.positive}>VOTO ENVIADO</span>
            ) : null}
            {voting?.status === "CLOSED" ? (
              <span className={styles.muted}>VOTACIÓN CERRADA</span>
            ) : null}
            {canOpenProgression ? (
              <Link
                className="ui-button ui-button--secondary"
                href={`/play/matches/${matchId}/progression`}
              >
                VER MI PROGRESIÓN
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {finalRoster?.closureEditable ? (
        <details className={styles.organizerTools}>
          <summary>
            <span>ADMINISTRAR PARTIDO · FINALIZADO</span>
          </summary>
          <div className={styles.organizerContent}>
            <ManagementSection
              description="El cierre sólo puede revisarse mientras el dominio todavía lo permite."
              title="REVISIÓN DEL CIERRE"
            >
              <Link
                className="ui-button ui-button--secondary"
                href={`/play/matches/${matchId}/close`}
              >
                Ver o corregir cierre
              </Link>
            </ManagementSection>
          </div>
        </details>
      ) : null}
      <ReportControl targetId={matchId} targetType="MATCH" />
    </main>
  );
}

function FinishedStats({
  participants,
  stats,
}: Readonly<{
  participants: TeamsRead;
  stats: Map<string, ResultRead["participants"][number]>;
}>) {
  const names = new Map(
    [
      ...participants.TEAM_A.participants,
      ...participants.TEAM_B.participants,
    ].map((participant) => [
      participant.participantId,
      participant.displayName,
    ]),
  );
  const goals = [...stats.entries()].filter(([, value]) => value.goals > 0);
  const assists = [...stats.entries()].filter(([, value]) => value.assists > 0);
  if (goals.length === 0 && assists.length === 0) return null;
  return (
    <div className={styles.finishedStats}>
      {goals.length > 0 && (
        <section>
          <Text tone="accent" variant="label">
            GOLES
          </Text>
          {goals.map(([participantId, value]) => (
            <p key={participantId}>
              {names.get(participantId)} ×{value.goals}
            </p>
          ))}
        </section>
      )}
      {assists.length > 0 && (
        <section>
          <Text tone="accent" variant="label">
            ASISTENCIAS
          </Text>
          {assists.map(([participantId, value]) => (
            <p key={participantId}>
              {names.get(participantId)} ×{value.assists}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}

function FinishedTeam({
  label,
  participants,
  roster,
}: Readonly<{
  label: string;
  participants: TeamsRead["TEAM_A"]["participants"];
  roster?: FinalRosterRead;
}>) {
  const attendance = new Map(
    roster?.participants.map((row) => [row.participantId, row.attendance]) ??
      [],
  );
  return (
    <section className={styles.finishedTeam}>
      <Text as="h2" variant="heading-lg">
        {label}
      </Text>
      <div className={styles.sheetHeader} aria-hidden="true">
        <span>JUGADOR</span>
        <span>OVR</span>
        <span>NOTA</span>
      </div>
      <div className={styles.sheetRows} role="list">
        {participants.map((participant) => {
          const noShow =
            attendance.get(participant.participantId) === "NO_SHOW";
          return (
            <article
              className={styles.sheetRow}
              key={participant.participantId}
              role="listitem"
            >
              <div>
                <strong>{participant.displayName}</strong>
                <div className={styles.rowBadges}>
                  {participant.kind === "GUEST" ? (
                    <Badge kind="role">INVITADO</Badge>
                  ) : null}
                  {noShow ? <Badge kind="state">NO JUGÓ</Badge> : null}
                </div>
              </div>
              <span className={styles.sheetOvr}>
                {participant.internalOvr
                  ? Math.round(Number(participant.internalOvr))
                  : "—"}
              </span>
              <strong className={styles.sheetNote}>
                {participant.rating
                  ? Number(participant.rating).toFixed(1)
                  : "—"}
              </strong>
            </article>
          );
        })}
      </div>
    </section>
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

function ManagementSection({
  children,
  danger = false,
  description,
  title,
}: Readonly<{
  children: ReactNode;
  danger?: boolean;
  description: string;
  title: string;
}>) {
  return (
    <section
      className={`${styles.managementSection} ${danger ? styles.managementDanger : ""}`}
    >
      <div>
        <Text tone={danger ? "muted" : "accent"} variant="label">
          {title}
        </Text>
        <Text tone="muted">{description}</Text>
      </div>
      <div className={styles.managementSectionContent}>{children}</div>
    </section>
  );
}

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

function MatchRoster({
  canManageGuests,
  canManageParticipants,
  cancelPending,
  demoteId,
  onCancel,
  onDemoteChange,
  onRemoveGuest,
  onSwap,
  removeGuestPending,
  roster,
  showActions,
  swapPending,
}: Readonly<{
  canManageGuests: boolean;
  canManageParticipants: boolean;
  cancelPending: boolean;
  demoteId: string;
  onCancel: (id: string) => void;
  onDemoteChange: (id: string) => void;
  onRemoveGuest: (id: string) => void;
  onSwap: (id: string) => void;
  removeGuestPending: boolean;
  roster: RosterRead;
  showActions: boolean;
  swapPending: boolean;
}>) {
  return (
    <div className={styles.rosterGrid}>
      <Roster
        canManageGuests={canManageGuests}
        canManageParticipants={canManageParticipants}
        onCancel={onCancel}
        onRemoveGuest={onRemoveGuest}
        rows={roster.confirmed}
        showActions={showActions}
        title={`CONFIRMADOS · ${roster.confirmed.length}`}
      />
      <section className={styles.rosterSection}>
        <Text as="h2" variant="heading-lg">
          EN ESPERA · {roster.waitlist.length}
        </Text>
        {roster.waitlist.length === 0 ? (
          <p className={styles.muted}>Sin jugadores en espera.</p>
        ) : (
          <div className={styles.rosterList} role="list">
            {roster.waitlist.map((participant, index) => (
              <article
                className={styles.rosterRow}
                key={participant.id}
                role="listitem"
              >
                <span>#{participant.position}</span>
                <strong>{participant.displayName}</strong>
                <small className={styles.rosterMeta}>
                  {index + 1}.º suplente
                  {participant.kind === "GUEST" ? (
                    <Badge kind="role">INVITADO</Badge>
                  ) : null}
                </small>
                {showActions &&
                  ((participant.kind === "PLAYER" && canManageParticipants) ||
                    (participant.kind === "GUEST" &&
                      (participant.addedByCurrentActor ||
                        canManageGuests))) && (
                    <div className={styles.rowActions}>
                      <Button
                        disabled={cancelPending || removeGuestPending}
                        onClick={() =>
                          participant.kind === "GUEST"
                            ? onRemoveGuest(participant.id)
                            : onCancel(participant.id)
                        }
                        variant="quiet"
                      >
                        {participant.kind === "GUEST" ? "Retirar" : "Cancelar"}
                      </Button>
                      {canManageParticipants && demoteId && (
                        <Button
                          disabled={swapPending}
                          onClick={() => onSwap(participant.id)}
                          variant="quiet"
                        >
                          Confirmar por swap
                        </Button>
                      )}
                    </div>
                  )}
              </article>
            ))}
          </div>
        )}
        {showActions && canManageParticipants && roster.waitlist.length > 0 && (
          <label className={styles.compactField}>
            <span>CONFIRMADO A PASAR A ESPERA</span>
            <select
              onChange={(event) => onDemoteChange(event.target.value)}
              value={demoteId}
            >
              <option value="">Seleccionar…</option>
              {roster.confirmed.map((participant) => (
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
  );
}

function Roster({
  title,
  rows,
  canManageParticipants,
  canManageGuests,
  onCancel,
  onRemoveGuest,
  showActions,
}: Readonly<{
  title: string;
  rows: Awaited<ReturnType<typeof api.roster>>["confirmed"];
  canManageParticipants: boolean;
  canManageGuests: boolean;
  onCancel: (id: string) => void;
  onRemoveGuest: (id: string) => void;
  showActions: boolean;
}>) {
  return (
    <section className={styles.rosterSection}>
      <Text as="h2" variant="heading-lg">
        {title}
      </Text>
      {rows.length === 0 ? (
        <p className={styles.muted}>Todavía no hay jugadores.</p>
      ) : (
        <div className={styles.rosterList} role="list">
          {rows.map((participant) => (
            <article
              className={styles.rosterRow}
              key={participant.id}
              role="listitem"
            >
              <span>#{participant.position}</span>
              <strong>{participant.displayName}</strong>
              <small className={styles.rosterMeta}>
                {participant.kind === "GUEST" ? (
                  <Badge kind="role">INVITADO</Badge>
                ) : null}
              </small>
              {showActions &&
              (participant.addedByCurrentActor || canManageGuests) &&
              participant.kind === "GUEST" ? (
                <Button
                  onClick={() => onRemoveGuest(participant.id)}
                  variant="quiet"
                >
                  Retirar
                </Button>
              ) : showActions &&
                canManageParticipants &&
                participant.kind === "PLAYER" ? (
                <Button
                  onClick={() => onCancel(participant.id)}
                  variant="quiet"
                >
                  Cancelar
                </Button>
              ) : null}
            </article>
          ))}
        </div>
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
  if (status === "DRAFT") return "Partido en borrador";
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
    hourCycle: "h23",
  }).format(date);
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
