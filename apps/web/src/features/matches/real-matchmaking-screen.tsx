"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { MatchStateMark } from "@football/football-ui";
import { Button, Surface, Text } from "@football/ui";

import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "./real-matchmaking.module.css";

type Teams = Awaited<ReturnType<typeof api.teams>>;
type Participant = Teams["TEAM_A"]["participants"][number];
type Draft = { TEAM_A: Participant[]; TEAM_B: Participant[] };

export function RealMatchmakingScreen({
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
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);
  const official = teams.data;
  const composition =
    draft ??
    (official
      ? {
          TEAM_A: official.TEAM_A.participants,
          TEAM_B: official.TEAM_B.participants,
        }
      : { TEAM_A: [], TEAM_B: [] });
  const selected = [...composition.TEAM_A, ...composition.TEAM_B].find(
    (participant) => participant.participantId === selectedId,
  );
  const selectedSide = composition.TEAM_A.some(
    (participant) => participant.participantId === selectedId,
  )
    ? "TEAM_A"
    : "TEAM_B";
  const unsaved = draft !== null && !sameComposition(draft, official);

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  async function refreshAfterStart() {
    setDraft(null);
    setSelectedId(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.match(matchId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.teams(matchId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roster(matchId) }),
    ]);
  }
  const generate = useMutation({
    mutationFn: () => api.generateTeams(matchId),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.teams(matchId), result);
      setDraft(null);
      setSelectedId(null);
    },
  });
  const save = useMutation({
    mutationFn: () =>
      api.saveTeams(matchId, {
        assignments: [
          ...draft!.TEAM_A.map((participant) => ({
            participantId: participant.participantId,
            side: "TEAM_A" as const,
          })),
          ...draft!.TEAM_B.map((participant) => ({
            participantId: participant.participantId,
            side: "TEAM_B" as const,
          })),
        ],
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.teams(matchId), result);
      setDraft(null);
      setSelectedId(null);
    },
  });
  const start = useMutation({
    mutationFn: () => api.startMatch(matchId),
    onSuccess: async () => {
      confirmDialog.current?.close();
      await refreshAfterStart();
    },
  });

  function beginEditing() {
    if (!official) return;
    setDraft({
      TEAM_A: [...official.TEAM_A.participants],
      TEAM_B: [...official.TEAM_B.participants],
    });
    setSelectedId(null);
  }

  function moveSelected(target: "TEAM_A" | "TEAM_B") {
    if (!draft || !selected || target === selectedSide) return;
    const notSelected = (participant: Participant) =>
      participant.participantId !== selectedId;
    setDraft({
      TEAM_A:
        target === "TEAM_A"
          ? [...draft.TEAM_A.filter(notSelected), selected]
          : draft.TEAM_A.filter(notSelected),
      TEAM_B:
        target === "TEAM_B"
          ? [...draft.TEAM_B.filter(notSelected), selected]
          : draft.TEAM_B.filter(notSelected),
    });
  }

  function regenerate() {
    if (unsaved || (official?.assignedCount ?? 0) > 0) {
      setRegenerateConfirmOpen(true);
      return;
    }
    generate.mutate();
  }

  if (match.isPending || teams.isPending)
    return (
      <main className={styles.page}>
        <p role="status">Preparando equipos…</p>
      </main>
    );
  if (match.isError || teams.isError)
    return (
      <main className={styles.page}>
        <p className={styles.error} role="alert">
          {match.error?.message ?? teams.error?.message}
        </p>
      </main>
    );

  const locked = match.data.status === "STARTED" || teams.data.locked;
  const error = generate.error ?? save.error ?? start.error;
  const hasTeams = teams.data.assignedCount > 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href={`/play/matches/${matchId}`}>
          ← PARTIDO
        </Link>
        <div>
          <Text tone="accent" variant="label">
            {locked ? "PARTIDO EN JUEGO" : "ARMAR EQUIPOS"}
          </Text>
          <Text as="h1" variant="display-lg">
            Equipo A vs Equipo B.
          </Text>
          <Text tone="muted">
            F5 · {formatDate(match.data.scheduledAt)} ·{" "}
            {match.data.locationText}
          </Text>
        </div>
      </header>

      {teams.data.rosterChanged && (
        <div className={styles.stale} role="alert">
          <strong>CAMBIÓ LA LISTA DE JUGADORES</strong>
          <span>Revisá o regenerá los equipos antes de iniciar.</span>
        </div>
      )}

      {hasTeams && (
        <section className={styles.balance} aria-label="Resumen del balance">
          <div>
            <strong>{formatAverage(teams.data.TEAM_A.averageOvr)}</strong>
            <span>OVR PROMEDIO A</span>
          </div>
          <div>
            <Text tone="accent" variant="label">
              {teams.data.diagnostics[0] === "BALANCED"
                ? "EQUIPOS BALANCEADOS"
                : diagnosticLabel(teams.data.diagnostics[0])}
            </Text>
            <span>
              DIFERENCIA · {formatDifference(teams.data.averageOvrDifference)}
            </span>
            <small>
              {draft
                ? unsaved
                  ? "CAMBIOS SIN GUARDAR"
                  : "EDITANDO"
                : teams.data.source === "INTELLIGENT"
                  ? "PROPUESTA INTELIGENTE"
                  : "AJUSTE MANUAL"}
            </small>
          </div>
          <div>
            <strong>{formatAverage(teams.data.TEAM_B.averageOvr)}</strong>
            <span>OVR PROMEDIO B</span>
          </div>
        </section>
      )}

      {!hasTeams ? (
        <section className={styles.empty}>
          <Text as="h2" variant="heading-lg">
            Los equipos todavía no fueron armados.
          </Text>
          {teams.data.canManage && match.data.status === "OPEN" ? (
            <Button
              disabled={generate.isPending}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? "Generando…" : "Generar equipos"}
            </Button>
          ) : (
            <Text tone="muted">
              El organizador todavía no publicó una propuesta.
            </Text>
          )}
        </section>
      ) : (
        <>
          <div className={styles.teams}>
            <Team
              side="TEAM_A"
              players={composition.TEAM_A}
              editing={draft !== null}
              selectedId={selectedId}
              selectedName={selected?.displayName ?? null}
              showMove={draft !== null && selectedSide === "TEAM_B"}
              onMove={() => moveSelected("TEAM_A")}
              onSelect={(id) =>
                setSelectedId((current) => (current === id ? null : id))
              }
            />
            <Team
              side="TEAM_B"
              players={composition.TEAM_B}
              editing={draft !== null}
              selectedId={selectedId}
              selectedName={selected?.displayName ?? null}
              showMove={draft !== null && selectedSide === "TEAM_A"}
              onMove={() => moveSelected("TEAM_B")}
              onSelect={(id) =>
                setSelectedId((current) => (current === id ? null : id))
              }
            />
          </div>
          <div
            className={styles.versus}
            aria-label={`${composition.TEAM_A.length} contra ${composition.TEAM_B.length}`}
          >
            {composition.TEAM_A.length} VS {composition.TEAM_B.length}
          </div>
        </>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      )}

      {teams.data.canManage && match.data.status === "OPEN" && (
        <section className={styles.actions} aria-label="Acciones de equipos">
          {hasTeams && !draft && (
            <Button onClick={beginEditing} variant="secondary">
              Editar equipos
            </Button>
          )}
          {hasTeams && !draft && (
            <Button
              disabled={generate.isPending}
              onClick={regenerate}
              variant="quiet"
            >
              Regenerar equipos
            </Button>
          )}
          {draft && (
            <>
              {selected && (
                <button
                  className={styles.mobileMove}
                  onClick={() =>
                    moveSelected(
                      selectedSide === "TEAM_A" ? "TEAM_B" : "TEAM_A",
                    )
                  }
                  type="button"
                >
                  Mover {selected.displayName} a{" "}
                  {selectedSide === "TEAM_A" ? "Equipo B" : "Equipo A"}
                </button>
              )}
              <Button
                onClick={() => {
                  setDraft(null);
                  setSelectedId(null);
                }}
                variant="quiet"
              >
                Cancelar
              </Button>
              <Button
                disabled={!unsaved || save.isPending}
                onClick={() => save.mutate()}
              >
                Guardar equipos
              </Button>
            </>
          )}
          {!draft && (
            <Button
              disabled={!teams.data.readyToStart || start.isPending}
              onClick={() => confirmDialog.current?.showModal()}
            >
              Iniciar partido
            </Button>
          )}
          {unsaved && <small>Guardá los cambios antes de iniciar.</small>}
          {!teams.data.readyToStart && (
            <small>
              Todos los confirmados deben tener un equipo antes de iniciar.
            </small>
          )}
        </section>
      )}

      {locked && (
        <section className={styles.started}>
          <MatchStateMark tone="positive">PARTIDO EN JUEGO</MatchStateMark>
          <Text as="h2" variant="heading-lg">
            Inscripciones y equipos bloqueados.
          </Text>
          <Text tone="muted">
            Cuando termine el partido, el cierre permitirá cargar asistencia,
            resultado y estadísticas.
          </Text>
        </section>
      )}

      <ConfirmDialog
        confirmDisabled={generate.isPending}
        confirmLabel="Reemplazar equipos"
        eyebrow="REGENERAR EQUIPOS"
        message="La propuesta actual será reemplazada por una nueva distribución automática."
        onCancel={() => setRegenerateConfirmOpen(false)}
        onConfirm={() => {
          setRegenerateConfirmOpen(false);
          generate.mutate();
        }}
        open={regenerateConfirmOpen}
        title="¿Generar equipos nuevamente?"
      />

      <dialog className={styles.dialog} ref={confirmDialog}>
        <form method="dialog">
          <Text tone="accent" variant="label">
            INICIAR PARTIDO
          </Text>
          <Text as="h2" variant="heading-lg">
            {teams.data.confirmedCount} jugadores
          </Text>
          <p>
            Equipo A · {composition.TEAM_A.length}
            <br />
            Equipo B · {composition.TEAM_B.length}
          </p>
          <p>Al iniciar se bloquearán inscripciones y equipos.</p>
          <div>
            <Button value="cancel" variant="secondary">
              Cancelar
            </Button>
            <Button
              disabled={start.isPending}
              onClick={(event) => {
                event.preventDefault();
                start.mutate();
              }}
            >
              Iniciar
            </Button>
          </div>
        </form>
      </dialog>
    </main>
  );
}

function Team({
  side,
  players,
  editing,
  selectedId,
  selectedName,
  showMove,
  onMove,
  onSelect,
}: Readonly<{
  side: "TEAM_A" | "TEAM_B";
  players: Participant[];
  editing: boolean;
  selectedId: string | null;
  selectedName: string | null;
  showMove: boolean;
  onMove: () => void;
  onSelect: (id: string) => void;
}>) {
  return (
    <Surface as="section" className={styles.team}>
      <div className={styles.teamHeading}>
        <Text as="h2" variant="heading-lg">
          {side === "TEAM_A" ? "EQUIPO A" : "EQUIPO B"}
        </Text>
        <Text tone="muted" variant="metadata">
          {players.length} jugadores
        </Text>
      </div>
      <ol>
        {players.map((participant, index) => (
          <li key={participant.participantId}>
            <button
              aria-pressed={selectedId === participant.participantId}
              className={styles.player}
              disabled={!editing}
              onClick={() => onSelect(participant.participantId)}
              type="button"
            >
              <span className={styles.node} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.identity}>
                <strong>{participant.displayName}</strong>
                {participant.kind === "GUEST" && (
                  <small className={styles.guest}>INVITADO</small>
                )}
              </span>
              <span className={styles.details}>
                {participant.kind === "GUEST" ? (
                  "OVR —"
                ) : (
                  <>
                    {participant.preferredRoles.length
                      ? participant.preferredRoles.join(" · ")
                      : "LIBRE"}{" "}
                    · OVR {Math.round(Number(participant.internalOvr))}
                  </>
                )}
                {participant.willingToPlayGoalkeeper && (
                  <small>PUEDE ATAJAR</small>
                )}
              </span>
              {selectedId === participant.participantId && (
                <span className={styles.selected}>SELECCIONADO</span>
              )}
            </button>
          </li>
        ))}
      </ol>
      {showMove && selectedName && (
        <button className={styles.move} onClick={onMove} type="button">
          + Mover {selectedName} acá
        </button>
      )}
    </Surface>
  );
}

function sameComposition(draft: Draft, official: Teams | undefined) {
  if (!official) return false;
  const ids = (items: Participant[]) =>
    items
      .map((item) => item.participantId)
      .sort()
      .join(":");
  return (
    ids(draft.TEAM_A) === ids(official.TEAM_A.participants) &&
    ids(draft.TEAM_B) === ids(official.TEAM_B.participants)
  );
}
function formatAverage(value: string | null) {
  return value === null ? "—" : Number(value).toFixed(1);
}
function formatDifference(value: string | null) {
  return value === null ? "—" : Number(value).toFixed(1);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
function diagnosticLabel(value: Teams["diagnostics"][number] | undefined) {
  return value === "NO_KEEPER_COVERAGE"
    ? "SIN ARQUERO DEFINIDO"
    : "COBERTURA DE ARQUERO INCOMPLETA";
}
