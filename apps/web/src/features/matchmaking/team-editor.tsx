import { Surface, Text } from "@football/ui";

import type { MockPlayer } from "./matchmaking-mock-content";
import styles from "./matchmaking.module.css";

export function TeamEditor({
  editing,
  name,
  onMoveHere,
  onSelect,
  players,
  selectedId,
  selectedName,
  showMoveTarget,
}: Readonly<{
  editing: boolean;
  name: string;
  onMoveHere: () => void;
  onSelect: (id: string) => void;
  players: MockPlayer[];
  selectedId: string | null;
  selectedName: string | null;
  showMoveTarget: boolean;
}>) {
  return (
    <Surface as="section" className={styles.team}>
      <div className={styles.teamHeading}>
        <Text as="h3" variant="heading-lg">
          {name}
        </Text>
        <Text as="span" tone="muted" variant="metadata">
          {players.length} jugadores
        </Text>
      </div>
      <ol>
        {players.map((player, index) => {
          const selected = selectedId === player.id;
          return (
            <li key={player.id}>
              <button
                aria-pressed={selected}
                className={styles.playerButton}
                disabled={!editing}
                onClick={() => onSelect(player.id)}
                type="button"
              >
                <span aria-hidden="true" className={styles.playerNode}>
                  {index + 1}
                </span>
                <span className={styles.playerIdentity}>
                  {player.guest ? (
                    <span className={styles.guestMark}>Guest</span>
                  ) : null}
                  <Text as="span" variant="label">
                    {player.name}
                  </Text>
                </span>
                <span className={styles.playerRole}>
                  <Text as="span" tone="muted" variant="metadata">
                    {player.role}
                    {player.canKeep ? " · Puede atajar" : ""}
                  </Text>
                </span>
                {selected ? (
                  <span className={styles.selectedMark}>Seleccionado</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
      {showMoveTarget && selectedName ? (
        <button
          className={styles.moveTarget}
          onClick={onMoveHere}
          type="button"
        >
          <span aria-hidden="true">+</span> Mover {selectedName} acá
        </button>
      ) : null}
    </Surface>
  );
}
