"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TacticalDivider } from "@football/football-ui";
import { Button, Text } from "@football/ui";

import { BalanceSummary } from "./balance-summary";
import {
  cloneMockComposition,
  fiveVsFourMock,
  type MockComposition,
  type MockRole,
  mockProposals,
} from "./matchmaking-mock-content";
import { PlayerRoleControls } from "./player-role-controls";
import styles from "./matchmaking.module.css";
import { TeamEditor } from "./team-editor";

export function MatchmakingScreen() {
  const [proposalIndex, setProposalIndex] = useState(0);
  const [applied, setApplied] = useState<MockComposition>(() =>
    cloneMockComposition(mockProposals[0]!),
  );
  const [draft, setDraft] = useState<MockComposition | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const composition = draft ?? applied;
  const editing = draft !== null;
  const selected = composition.teams
    .flatMap((team, teamIndex) => team.map((player) => ({ player, teamIndex })))
    .find(({ player }) => player.id === selectedId);

  useEffect(() => {
    if (!selectedId) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedId]);

  function startEditing() {
    setDraft(cloneMockComposition(applied));
    setSelectedId(null);
  }

  function rearm() {
    const nextIndex = proposalIndex === 0 ? 1 : 0;
    setProposalIndex(nextIndex);
    setApplied(cloneMockComposition(mockProposals[nextIndex]!));
    setDraft(null);
    setSelectedId(null);
  }

  function showFiveVsFour() {
    setApplied(cloneMockComposition(fiveVsFourMock));
    setDraft(null);
    setSelectedId(null);
  }

  function moveSelected(targetTeam: number) {
    if (!draft || !selectedId) return;

    const selectedPlayer = draft.teams
      .flat()
      .find((player) => player.id === selectedId);
    if (!selectedPlayer) return;

    setDraft({
      ...draft,
      balance: "86%",
      balanceMessage: "Ajuste manual pendiente",
      label: "Ajustada manualmente",
      warnings: [],
      teams: draft.teams.map((team, index) =>
        index === targetTeam
          ? [
              ...team.filter((player) => player.id !== selectedId),
              selectedPlayer,
            ]
          : team.filter((player) => player.id !== selectedId),
      ) as MockComposition["teams"],
    });
  }

  function changeSelectedRole(role: MockRole) {
    if (!draft || !selectedId) return;

    setDraft({
      ...draft,
      balance: "86%",
      balanceMessage: "Ajuste manual pendiente",
      label: "Ajustada manualmente",
      teams: draft.teams.map((team) =>
        team.map((player) =>
          player.id === selectedId ? { ...player, role } : player,
        ),
      ) as MockComposition["teams"],
    });
  }

  function cancelEditing() {
    setDraft(null);
    setSelectedId(null);
  }

  function applyEditing() {
    if (!draft) return;
    setApplied(cloneMockComposition(draft));
    setDraft(null);
    setSelectedId(null);
  }

  function toggleSelected(id: string) {
    setSelectedId((currentId) => (currentId === id ? null : id));
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backLink} href="/play/match-demo">
          ← Partido
        </Link>
        <div>
          <Text as="span" tone="accent" variant="label">
            Armar equipos
          </Text>
          <Text as="h1" variant="display-lg">
            Los del martes
          </Text>
          <Text tone="muted" variant="metadata">
            F5 · Martes 20:00
          </Text>
        </div>
      </header>

      <BalanceSummary composition={composition} editing={editing} />
      <TacticalDivider />

      <section aria-labelledby="teams-editor-title" className={styles.editor}>
        <div className={styles.editorHeading}>
          <div>
            <Text as="span" tone="accent" variant="metadata">
              {composition.label}
            </Text>
            <Text as="h2" id="teams-editor-title" variant="heading-lg">
              {editing ? "Seleccioná un jugador" : "Equipos propuestos"}
            </Text>
          </div>
          {editing ? (
            <Text as="span" tone="muted" variant="metadata">
              Tap para editar
            </Text>
          ) : null}
        </div>

        {editing && selected ? (
          <PlayerRoleControls
            onRoleChange={changeSelectedRole}
            player={selected.player}
          />
        ) : null}

        <div className={styles.teams}>
          {composition.teams.map((team, index) => (
            <TeamEditor
              editing={editing}
              key={`team-${index}`}
              name={`Equipo ${index === 0 ? "A" : "B"}`}
              onMoveHere={() => moveSelected(index)}
              onSelect={toggleSelected}
              players={team}
              selectedId={selectedId}
              selectedName={selected?.player.name ?? null}
              showMoveTarget={
                selected?.teamIndex !== index && Boolean(selected)
              }
            />
          ))}
        </div>

        <div className={styles.actions}>
          {editing ? (
            <>
              <Button onClick={cancelEditing} variant="secondary">
                Cancelar
              </Button>
              <Button onClick={applyEditing}>Aplicar cambios</Button>
            </>
          ) : (
            <>
              <Button onClick={rearm} variant="secondary">
                Rearmar
              </Button>
              <Button onClick={startEditing}>Editar equipos</Button>
              <Button onClick={showFiveVsFour} variant="quiet">
                Ver escenario 5 vs 4
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
