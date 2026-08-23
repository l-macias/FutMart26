import { TacticalDivider } from "@football/football-ui";
import { Surface, Text } from "@football/ui";

import styles from "./placeholder-screen.module.css";

export interface PlaceholderScreenProps {
  index: string;
  title: string;
}

export function PlaceholderScreen({ index, title }: PlaceholderScreenProps) {
  return (
    <section className={styles.screen}>
      <Text as="span" tone="accent" variant="label">
        Destino {index}
      </Text>
      <Text as="h1" variant="display-lg">
        {title}
      </Text>
      <TacticalDivider />
      <Surface className={styles.note}>
        <Text tone="muted" variant="body">
          Esta ruta sólo valida el ritmo y la navegación del shell. Su
          experiencia real todavía no está implementada.
        </Text>
      </Surface>
    </section>
  );
}
