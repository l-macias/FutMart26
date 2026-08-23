import Link from "next/link";

import { Text } from "@football/ui";

import styles from "./play.module.css";

export function LastMatchSummary() {
  return (
    <section aria-labelledby="last-match-title" className={styles.lastMatch}>
      <Text as="span" tone="accent" variant="label">
        Último partido
      </Text>
      <Text as="h2" id="last-match-title" variant="heading-lg">
        Los del martes
      </Text>
      <div className={styles.ratingSummary}>
        <div>
          <span className={styles.ratingValue}>7.8</span>
          <Text as="span" tone="muted" variant="metadata">
            Rating del partido
          </Text>
        </div>
        <strong className={styles.ratingDelta}>+1 OVR</strong>
      </div>
      <Link className={styles.textLink} href="/play/results-demo">
        Ver resultado →
      </Link>
    </section>
  );
}
