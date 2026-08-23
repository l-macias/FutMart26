import Link from "next/link";

import { Text } from "@football/ui";

import { homeMockContent } from "./home-mock-content";
import styles from "./home.module.css";

export function RankingPreview() {
  return (
    <section aria-labelledby="ranking-title" className={styles.ranking}>
      <div className={styles.sectionHeading}>
        <div>
          <Text as="span" tone="accent" variant="metadata">
            Global
          </Text>
          <Text as="h2" id="ranking-title" variant="heading-lg">
            Ranking F5
          </Text>
        </div>
        <Link className={styles.textLink} href="/rankings">
          Ver ranking <span aria-hidden="true">→</span>
        </Link>
      </div>
      <ol className={styles.rankingList}>
        {homeMockContent.ranking.map((entry, index) => (
          <li className={styles.rankingRow} key={entry.name}>
            <span className={styles.rankPosition}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <Text as="span" variant="heading-md">
              {entry.name}
            </Text>
            <span className={styles.rankLine} aria-hidden="true" />
            <span className={styles.rankOverall}>{entry.overall}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
