import { TacticalDivider } from "@football/football-ui";
import { Surface, Text } from "@football/ui";

import styles from "./page.module.css";

export default function HomeFoundationPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <Text as="span" tone="accent" variant="label">
          Visual foundation / v1
        </Text>
        <Text as="h1" variant="display-xl">
          Tu fútbol, después de que cae el sol.
        </Text>
        <Text className={styles.intro} tone="muted" variant="body">
          Una primera lectura del shell: nocturna, táctica y contenida. Las
          funciones del producto llegarán en las próximas etapas.
        </Text>
      </section>

      <TacticalDivider />

      <Surface
        as="section"
        className={styles.foundationNote}
        elevation="raised"
      >
        <span aria-hidden="true" className={styles.pitchLine} />
        <div>
          <Text as="span" tone="muted" variant="metadata">
            Estado de la superficie
          </Text>
          <Text as="h2" variant="heading-lg">
            Cancha preparada. Sin partido todavía.
          </Text>
        </div>
      </Surface>
    </div>
  );
}
