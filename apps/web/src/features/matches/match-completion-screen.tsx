"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, Surface, Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "./match-completion.module.css";

type Step = "INTRO" | "ATTENDANCE" | "SCORING" | "REVIEW" | "DONE";
type Stat = { goals: number; assists: number };
type TeamSide = "TEAM_A" | "TEAM_B";

function getClosureValidationErrors({
  playedParticipantIds,
  sideByParticipant,
  stats,
  teamAGoals,
  teamBGoals,
}: Readonly<{
  playedParticipantIds: readonly string[];
  sideByParticipant: ReadonlyMap<string, TeamSide>;
  stats: Record<string, Stat>;
  teamAGoals: number;
  teamBGoals: number;
}>): string[] {
  if (playedParticipantIds.length === 0) return [];

  const totals: Record<TeamSide, Stat> = {
    TEAM_A: { goals: 0, assists: 0 },
    TEAM_B: { goals: 0, assists: 0 },
  };

  for (const participantId of playedParticipantIds) {
    const side = sideByParticipant.get(participantId);
    if (!side) continue;
    const participantStats = stats[participantId] ?? { goals: 0, assists: 0 };
    totals[side].goals += participantStats.goals;
    totals[side].assists += participantStats.assists;
  }

  const errors: string[] = [];
  const validateTeam = (side: TeamSide, label: string, score: number) => {
    const assignedGoals = totals[side].goals;
    const assignedAssists = totals[side].assists;

    if (assignedGoals !== score) {
      const difference = score - assignedGoals;
      errors.push(
        difference > 0
          ? `${label}: faltan asignar ${difference} ${difference === 1 ? "gol" : "goles"}. El marcador indica ${score} y cargaste ${assignedGoals}.`
          : `${label}: hay ${Math.abs(difference)} ${Math.abs(difference) === 1 ? "gol" : "goles"} de más. El marcador indica ${score} y cargaste ${assignedGoals}.`,
      );
    }

    if (assignedAssists > score) {
      errors.push(
        `${label}: cargaste ${assignedAssists} asistencias para ${score} ${score === 1 ? "gol" : "goles"}.`,
      );
    }
  };

  validateTeam("TEAM_A", "Equipo A", teamAGoals);
  validateTeam("TEAM_B", "Equipo B", teamBGoals);
  return errors;
}

export function MatchCompletionScreen({
  matchId,
}: Readonly<{ matchId: string }>) {
  const queryClient = useQueryClient();
  const confirmDialog = useRef<HTMLDialogElement>(null);
  const match = useQuery({
    queryKey: queryKeys.match(matchId),
    queryFn: () => api.match(matchId),
  });
  const teams = useQuery({
    queryKey: queryKeys.teams(matchId),
    queryFn: () => api.teams(matchId),
  });
  const roster = useQuery({
    queryKey: queryKeys.finalRoster(matchId),
    queryFn: () => api.finalRoster(matchId),
  });
  const result = useQuery({
    queryKey: queryKeys.result(matchId),
    queryFn: () => api.result(matchId),
  });
  const [step, setStep] = useState<Step>("INTRO");
  const [played, setPlayed] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [teamAGoals, setTeamAGoals] = useState(0);
  const [teamBGoals, setTeamBGoals] = useState(0);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!match.data || !roster.data || !result.data || hydrated.current) return;
    hydrated.current = true;
    hydrateDraft();
    if (match.data.status !== "FINISHED") return;
    if (
      result.data.status === "CONFIRMED" ||
      result.data.status === "NOT_PLAYED"
    ) {
      setStep("DONE");
      return;
    }
    if (!roster.data.confirmedAt) {
      setStep("ATTENDANCE");
      return;
    }
    setStep(
      roster.data.participants.some((item) => item.attendance === "PLAYED")
        ? "SCORING"
        : "REVIEW",
    );
  }, [match.data, roster.data, result.data]);

  useEffect(() => {
    if (!roster.data?.votingStartsAt || roster.data.votingStarted) return;
    const startsAt = new Date(roster.data.votingStartsAt).getTime();
    const delay = Math.min(
      Math.max(startsAt - Date.now() + 250, 1_000),
      2_147_000_000,
    );
    const timeout = window.setTimeout(() => void roster.refetch(), delay);
    return () => window.clearTimeout(timeout);
  }, [roster.data, roster.dataUpdatedAt, roster.refetch]);

  const sideByParticipant = useMemo(
    () =>
      new Map([
        ...(teams.data?.TEAM_A.participants ?? []).map(
          (item) => [item.participantId, "TEAM_A"] as const,
        ),
        ...(teams.data?.TEAM_B.participants ?? []).map(
          (item) => [item.participantId, "TEAM_B"] as const,
        ),
      ]),
    [teams.data],
  );
  const playedParticipants =
    roster.data?.participants.filter((item) =>
      played.has(item.participantId),
    ) ?? [];
  const noShowCount =
    (roster.data?.participants.length ?? 0) - playedParticipants.length;
  const grouped = {
    TEAM_A:
      roster.data?.participants.filter(
        (item) => sideByParticipant.get(item.participantId) === "TEAM_A",
      ) ?? [],
    TEAM_B:
      roster.data?.participants.filter(
        (item) => sideByParticipant.get(item.participantId) === "TEAM_B",
      ) ?? [],
  };
  const closureValidationErrors = getClosureValidationErrors({
    playedParticipantIds: playedParticipants.map((item) => item.participantId),
    sideByParticipant,
    stats,
    teamAGoals,
    teamBGoals,
  });

  async function invalidateClosure() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.match(matchId) }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.finalRoster(matchId),
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.result(matchId) }),
    ]);
  }
  const finish = useMutation({
    mutationFn: () => api.finishMatch(matchId),
    onSuccess: async () => {
      await invalidateClosure();
      setStep("ATTENDANCE");
    },
  });
  const saveAttendance = useMutation({
    mutationFn: () =>
      api.saveFinalRoster(matchId, {
        participants: roster.data!.participants.map((item) => ({
          participantId: item.participantId,
          attendance: played.has(item.participantId)
            ? ("PLAYED" as const)
            : ("NO_SHOW" as const),
        })),
      }),
    onSuccess: async () => {
      await invalidateClosure();
      setStep(played.size === 0 ? "REVIEW" : "SCORING");
    },
  });
  const saveDraft = useMutation({
    mutationFn: () =>
      api.saveResultDraft(matchId, {
        teamAGoals,
        teamBGoals,
        participants: playedParticipants.map((item) => ({
          participantId: item.participantId,
          ...(stats[item.participantId] ?? { goals: 0, assists: 0 }),
        })),
      }),
    onSuccess: async () => {
      await invalidateClosure();
      setStep("REVIEW");
    },
  });
  const confirm = useMutation({
    mutationFn: () => api.confirmResult(matchId),
    onSuccess: async () => {
      confirmDialog.current?.close();
      await invalidateClosure();
      setStep("DONE");
    },
  });
  const error = finish.error ?? saveAttendance.error ?? saveDraft.error;

  if (
    match.isPending ||
    teams.isPending ||
    roster.isPending ||
    result.isPending
  )
    return (
      <main className={styles.page}>
        <p role="status">Preparando cierre del partido…</p>
      </main>
    );
  if (match.isError || teams.isError || roster.isError || result.isError)
    return (
      <main className={styles.page}>
        <p className={styles.error} role="alert">
          {match.error?.message ??
            teams.error?.message ??
            roster.error?.message ??
            result.error?.message}
        </p>
      </main>
    );

  if (match.data.status === "FINISHED" && !roster.data.closureEditable)
    return (
      <ReadOnlyClosure
        matchId={matchId}
        result={result.data}
        roster={roster.data}
        sideByParticipant={sideByParticipant}
      />
    );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href={`/play/matches/${matchId}`}>← PARTIDO</Link>
        <div>
          <Text tone="accent" variant="label">
            CIERRE DE PARTIDO
          </Text>
          <Text as="h1" variant="display-lg">
            Lo que pasó en cancha.
          </Text>
        </div>
        <Progress step={step} />
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      )}

      {step === "INTRO" && (
        <section className={styles.intro}>
          <Text as="h2" variant="heading-lg">
            Partido en juego.
          </Text>
          <p>
            Al cerrar, vas a confirmar quiénes jugaron y cargar el resultado
            real.
          </p>
          <Button disabled={finish.isPending} onClick={() => finish.mutate()}>
            Cerrar partido
          </Button>
        </section>
      )}

      {step === "ATTENDANCE" && (
        <section className={styles.flow}>
          <div>
            <Text tone="accent" variant="label">
              PASO 1 · ASISTENCIA
            </Text>
            <Text as="h2" variant="heading-lg">
              ¿Quiénes jugaron?
            </Text>
            <p>
              Todos aparecen como jugaron. Desmarcá únicamente a quienes no
              estuvieron.
            </p>
          </div>
          <div className={styles.teamGrid}>
            <AttendanceTeam
              title="EQUIPO A"
              participants={grouped.TEAM_A}
              played={played}
              toggle={togglePlayed}
            />
            <AttendanceTeam
              title="EQUIPO B"
              participants={grouped.TEAM_B}
              played={played}
              toggle={togglePlayed}
            />
          </div>
          <div className={styles.stickyActions}>
            <Button
              disabled={saveAttendance.isPending}
              onClick={() => saveAttendance.mutate()}
            >
              Confirmar asistencia
            </Button>
          </div>
        </section>
      )}

      {step === "SCORING" && (
        <section className={styles.flow}>
          <div>
            <Text tone="accent" variant="label">
              PASOS 2 Y 3 · RESULTADO
            </Text>
            <Text as="h2" variant="heading-lg">
              Cargá el marcador.
            </Text>
          </div>
          <div className={styles.score}>
            <ScoreInput
              label="EQUIPO A"
              value={teamAGoals}
              setValue={setTeamAGoals}
            />
            <span>—</span>
            <ScoreInput
              label="EQUIPO B"
              value={teamBGoals}
              setValue={setTeamBGoals}
            />
          </div>
          <div className={styles.teamGrid}>
            <StatsTeam
              title="EQUIPO A"
              participants={grouped.TEAM_A.filter((item) =>
                played.has(item.participantId),
              )}
              stats={stats}
              setStat={setStat}
            />
            <StatsTeam
              title="EQUIPO B"
              participants={grouped.TEAM_B.filter((item) =>
                played.has(item.participantId),
              )}
              stats={stats}
              setStat={setStat}
            />
          </div>
          <div className={styles.stickyActions}>
            <Button onClick={() => setStep("ATTENDANCE")} variant="quiet">
              Corregir asistencia
            </Button>
            <Button
              disabled={saveDraft.isPending}
              onClick={() => saveDraft.mutate()}
            >
              Revisar cierre
            </Button>
          </div>
        </section>
      )}

      {step === "REVIEW" && (
        <Review
          played={playedParticipants}
          noShowCount={noShowCount}
          result={played.size === 0 ? null : { teamAGoals, teamBGoals }}
          stats={stats}
          validationErrors={closureValidationErrors}
          onBack={() => setStep(played.size === 0 ? "ATTENDANCE" : "SCORING")}
          onConfirm={() => {
            confirm.reset();
            confirmDialog.current?.showModal();
          }}
        />
      )}

      {step === "DONE" && (
        <section className={styles.done}>
          <Text tone="accent" variant="label">
            FINALIZADO
          </Text>
          <Text as="h2" variant="display-lg">
            {result.data.status === "NOT_PLAYED"
              ? "Partido no jugado."
              : `${result.data.teamAGoals} — ${result.data.teamBGoals}`}
          </Text>
          <p>
            {result.data.status === "NOT_PLAYED"
              ? "No hubo participantes que hayan jugado."
              : `Equipo A ${result.data.teamAGoals} · Equipo B ${result.data.teamBGoals}`}
          </p>
          <div className={styles.doneActions}>
            <Button
              onClick={() => {
                hydrateDraft();
                setStep(
                  result.data.status === "NOT_PLAYED"
                    ? "ATTENDANCE"
                    : "SCORING",
                );
              }}
              variant="secondary"
            >
              Corregir cierre
            </Button>
            <Link href={`/play/matches/${matchId}`}>VOLVER AL PARTIDO</Link>
          </div>
          <small>
            La votación se habilita automáticamente en la ventana indicada por
            el servidor. Hasta entonces, un manager autorizado puede corregir
            este cierre.
          </small>
        </section>
      )}

      <dialog className={styles.dialog} ref={confirmDialog}>
        <form method="dialog">
          <Text tone="accent" variant="label">
            FINALIZAR PARTIDO
          </Text>
          <Text as="h2" variant="heading-lg">
            Confirmar cierre deportivo.
          </Text>
          <p>
            Se validarán marcador, goles y asistencias contra los equipos
            guardados.
          </p>
          {confirm.error && (
            <p className={styles.error} role="alert">
              {confirm.error.message}
            </p>
          )}
          <div>
            <Button
              onClick={() => confirmDialog.current?.close()}
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button
              disabled={confirm.isPending}
              onClick={(event) => {
                event.preventDefault();
                confirm.mutate();
              }}
            >
              Finalizar
            </Button>
          </div>
        </form>
      </dialog>
    </main>
  );

  function hydrateDraft() {
    const savedPlayed = roster.data!.confirmedAt
      ? roster
          .data!.participants.filter((item) => item.attendance === "PLAYED")
          .map((item) => item.participantId)
      : roster.data!.participants.map((item) => item.participantId);
    setPlayed(new Set(savedPlayed));
    setStats(
      Object.fromEntries(
        result.data!.participants.map((item) => [
          item.participantId,
          { goals: item.goals, assists: item.assists },
        ]),
      ),
    );
    setTeamAGoals(result.data!.teamAGoals ?? 0);
    setTeamBGoals(result.data!.teamBGoals ?? 0);
    setStep(
      match.data!.status === "STARTED"
        ? "INTRO"
        : result.data!.status === "CONFIRMED" ||
            result.data!.status === "NOT_PLAYED"
          ? "DONE"
          : roster.data!.confirmedAt
            ? "SCORING"
            : "ATTENDANCE",
    );
  }
  function togglePlayed(id: string) {
    setPlayed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function setStat(id: string, key: keyof Stat, value: number) {
    setStats((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? { goals: 0, assists: 0 }),
        [key]: Math.max(0, value),
      },
    }));
  }
}

function ReadOnlyClosure({
  matchId,
  result,
  roster,
  sideByParticipant,
}: Readonly<{
  matchId: string;
  result: Awaited<ReturnType<typeof api.result>>;
  roster: Awaited<ReturnType<typeof api.finalRoster>>;
  sideByParticipant: ReadonlyMap<string, TeamSide>;
}>) {
  const stats = new Map(
    result.participants.map((item) => [item.participantId, item]),
  );
  const teams = (["TEAM_A", "TEAM_B"] as const).map((side) => ({
    side,
    participants: roster.participants.filter(
      (participant) =>
        sideByParticipant.get(participant.participantId) === side,
    ),
  }));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href={`/play/matches/${matchId}`}>← PARTIDO</Link>
        <div>
          <Text tone="accent" variant="label">
            CIERRE DE PARTIDO
          </Text>
          <Text as="h1" variant="display-lg">
            Lo que pasó en cancha.
          </Text>
        </div>
      </header>

      <p className={styles.readOnlyNotice} role="status">
        {roster.votingStarted
          ? "CIERRE CONGELADO · La votación ya comenzó."
          : "CIERRE EN MODO CONSULTA"}
      </p>

      <section className={styles.done}>
        <Text tone="accent" variant="label">
          RESULTADO
        </Text>
        <Text as="h2" variant="display-lg">
          {result.status === "NOT_PLAYED"
            ? "PARTIDO NO JUGADO"
            : result.teamAGoals !== null && result.teamBGoals !== null
              ? `${result.teamAGoals} — ${result.teamBGoals}`
              : "CIERRE PENDIENTE"}
        </Text>
        <p>
          {
            roster.participants.filter((item) => item.attendance === "PLAYED")
              .length
          }{" "}
          jugaron ·{" "}
          {
            roster.participants.filter((item) => item.attendance === "NO_SHOW")
              .length
          }{" "}
          no-show
        </p>
      </section>

      <div className={styles.teamGrid}>
        {teams.map((team) => (
          <Surface className={styles.team} key={team.side}>
            <Text as="h2" variant="heading-lg">
              {team.side === "TEAM_A" ? "EQUIPO A" : "EQUIPO B"}
            </Text>
            {team.participants.map((participant) => {
              const participantStats = stats.get(participant.participantId);
              return (
                <article
                  className={styles.readOnlyPlayer}
                  key={participant.participantId}
                >
                  <div>
                    <strong>{participant.displayName}</strong>
                    {participant.kind === "GUEST" && <small>INVITADO</small>}
                  </div>
                  <span>
                    {participant.attendance === "PLAYED" ? "JUGÓ" : "NO-SHOW"}
                  </span>
                  {participant.attendance === "PLAYED" && (
                    <small>
                      {participantStats?.goals ?? 0} goles ·{" "}
                      {participantStats?.assists ?? 0} asistencias
                    </small>
                  )}
                </article>
              );
            })}
          </Surface>
        ))}
      </div>
    </main>
  );
}

type Participant = Awaited<
  ReturnType<typeof api.finalRoster>
>["participants"][number];
function AttendanceTeam({
  title,
  participants,
  played,
  toggle,
}: Readonly<{
  title: string;
  participants: Participant[];
  played: Set<string>;
  toggle: (id: string) => void;
}>) {
  return (
    <Surface as="section" className={styles.team}>
      <Text as="h3" variant="heading-lg">
        {title}
      </Text>
      {participants.map((item) => (
        <button
          aria-pressed={played.has(item.participantId)}
          className={styles.attendance}
          key={item.participantId}
          onClick={() => toggle(item.participantId)}
          type="button"
        >
          <span aria-hidden="true">
            {played.has(item.participantId) ? "✓" : "○"}
          </span>
          <strong>{item.displayName}</strong>
          {item.kind === "GUEST" && <small>INVITADO</small>}
          <em>{played.has(item.participantId) ? "JUGÓ" : "AUSENTE"}</em>
        </button>
      ))}
    </Surface>
  );
}
function StatsTeam({
  title,
  participants,
  stats,
  setStat,
}: Readonly<{
  title: string;
  participants: Participant[];
  stats: Record<string, Stat>;
  setStat: (id: string, key: keyof Stat, value: number) => void;
}>) {
  return (
    <Surface as="section" className={styles.team}>
      <Text as="h3" variant="heading-lg">
        {title}
      </Text>
      {participants.map((item) => {
        const value = stats[item.participantId] ?? { goals: 0, assists: 0 };
        return (
          <article className={styles.statRow} key={item.participantId}>
            <div>
              <strong>{item.displayName}</strong>
              {item.kind === "GUEST" && <small>INVITADO</small>}
            </div>
            <Stepper
              label={`Goles de ${item.displayName}`}
              value={value.goals}
              setValue={(next) => setStat(item.participantId, "goals", next)}
            />
            <Stepper
              label={`Asistencias de ${item.displayName}`}
              value={value.assists}
              setValue={(next) => setStat(item.participantId, "assists", next)}
            />
          </article>
        );
      })}
    </Surface>
  );
}
function Stepper({
  label,
  value,
  setValue,
}: Readonly<{
  label: string;
  value: number;
  setValue: (value: number) => void;
}>) {
  return (
    <div className={styles.stepper}>
      <span>{label.startsWith("Goles") ? "GOLES" : "ASIST."}</span>
      <button
        aria-label={`Restar ${label}`}
        disabled={value === 0}
        onClick={() => setValue(value - 1)}
        type="button"
      >
        −
      </button>
      <output aria-label={label}>{value}</output>
      <button
        aria-label={`Sumar ${label}`}
        onClick={() => setValue(value + 1)}
        type="button"
      >
        +
      </button>
    </div>
  );
}
function ScoreInput({
  label,
  value,
  setValue,
}: Readonly<{
  label: string;
  value: number;
  setValue: (value: number) => void;
}>) {
  return (
    <label>
      <span>{label}</span>
      <input
        aria-label={`Goles ${label}`}
        min="0"
        onChange={(event) => setValue(Math.max(0, Number(event.target.value)))}
        step="1"
        type="number"
        value={value}
      />
    </label>
  );
}
function Review({
  played,
  noShowCount,
  result,
  stats,
  validationErrors,
  onBack,
  onConfirm,
}: Readonly<{
  played: Participant[];
  noShowCount: number;
  result: { teamAGoals: number; teamBGoals: number } | null;
  stats: Record<string, Stat>;
  validationErrors: readonly string[];
  onBack: () => void;
  onConfirm: () => void;
}>) {
  const scorers = played.filter(
    (item) => (stats[item.participantId]?.goals ?? 0) > 0,
  );
  return (
    <section className={styles.review}>
      <Text tone="accent" variant="label">
        PASO 4 · REVISAR
      </Text>
      <Text as="h2" variant="display-lg">
        {result
          ? `${result.teamAGoals} — ${result.teamBGoals}`
          : "PARTIDO NO JUGADO"}
      </Text>
      <p>
        {played.length} jugaron · {noShowCount}{" "}
        {noShowCount === 1 ? "ausente" : "ausentes"}
      </p>
      {validationErrors.length > 0 && (
        <div className={styles.error} role="alert">
          {validationErrors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
      {scorers.length > 0 && (
        <div>
          <strong>GOLES</strong>
          {scorers.map((item) => (
            <span key={item.participantId}>
              {item.displayName} · {stats[item.participantId]!.goals}
            </span>
          ))}
        </div>
      )}
      <div className={styles.stickyActions}>
        <Button onClick={onBack} variant="quiet">
          Corregir
        </Button>
        <Button disabled={validationErrors.length > 0} onClick={onConfirm}>
          Finalizar partido
        </Button>
      </div>
    </section>
  );
}
function Progress({ step }: Readonly<{ step: Step }>) {
  const labels = ["Asistencia", "Resultado", "Stats", "Revisar"];
  const active =
    step === "INTRO" || step === "ATTENDANCE"
      ? 0
      : step === "SCORING"
        ? 1
        : step === "REVIEW" || step === "DONE"
          ? 3
          : 4;
  return (
    <ol className={styles.progress} aria-label="Progreso del cierre">
      {labels.map((label, index) => (
        <li aria-current={index === active ? "step" : undefined} key={label}>
          {index + 1}
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}
