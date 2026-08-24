import { Text } from "@football/ui";

import styles from "./voting.module.css";

export function VotingModeSelection({
  onSelect,
}: Readonly<{ onSelect: (mode: "quick" | "full") => void }>) {
  return (
    <section
      aria-labelledby="mode-selection-title"
      className={styles.modeSelection}
    >
      <Text as="h2" id="mode-selection-title" variant="heading-lg">
        ¿Cómo querés votar?
      </Text>
      <div>
        <button onClick={() => onSelect("quick")} type="button">
          <Text as="span" variant="heading-lg">
            Rápido
          </Text>
          <Text as="span" tone="muted" variant="metadata">
            Elegí hasta 3 destacados y hasta 3 a mejorar.
          </Text>
        </button>
        <button onClick={() => onSelect("full")} type="button">
          <Text as="span" variant="heading-lg">
            Completo
          </Text>
          <Text as="span" tone="muted" variant="metadata">
            Evaluá jugador por jugador.
          </Text>
        </button>
      </div>
    </section>
  );
}
