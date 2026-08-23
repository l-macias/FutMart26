import { Text } from "@football/ui";

import {
  type MockPlayer,
  type MockRole,
  mockRoles,
} from "./matchmaking-mock-content";
import styles from "./matchmaking.module.css";

export function PlayerRoleControls({
  onRoleChange,
  player,
}: Readonly<{
  onRoleChange: (role: MockRole) => void;
  player: MockPlayer;
}>) {
  return (
    <div
      aria-label={`Rol contextual de ${player.name}`}
      className={styles.roleBar}
    >
      <Text as="span" variant="label">
        {player.name} seleccionado
      </Text>
      <fieldset className={styles.roleControls}>
        <legend>Rol</legend>
        <div>
          {mockRoles.map((role) => (
            <button
              aria-pressed={player.role === role}
              key={role}
              onClick={() => onRoleChange(role)}
              type="button"
            >
              {role}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
