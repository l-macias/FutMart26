import { Text } from "@football/ui";

import { homeMockContent } from "./home-mock-content";
import styles from "./home.module.css";

export function RisingPlayers() {
  return (
    <section aria-labelledby="rising-title" className={styles.rising}>
      <Text as="span" tone="accent" variant="metadata">
        Momentum
      </Text>
      <Text as="h2" id="rising-title" variant="heading-lg">
        En subida
      </Text>
      <div className={styles.risingList}>
        {homeMockContent.rising.map((entry) => (
          <article className={styles.risingPlayer} key={entry.name}>
            <div>
              <Text as="h3" variant="heading-md">
                {entry.name}
              </Text>
              <Text as="p" tone="muted" variant="metadata">
                {entry.period}
              </Text>
            </div>
            <strong className={styles.delta}>{entry.delta}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
