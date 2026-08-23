import Link from "next/link";

import { TacticalDivider } from "@football/football-ui";

import { LifecyclePreview } from "./lifecycle-preview";
import { MatchCapacity } from "./match-capacity";
import { MatchHero } from "./match-hero";
import { MatchOperationsSummary } from "./match-operations-summary";
import { MatchRoster } from "./match-roster";
import styles from "./match-detail.module.css";
import { TeamPreview } from "./team-preview";

export function MatchDetailScreen() {
  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/play">
        ← Jugar
      </Link>

      <div className={styles.overview}>
        <MatchHero />
        <aside className={styles.overviewAside}>
          <MatchCapacity />
        </aside>
      </div>

      <TacticalDivider />

      <div className={styles.matchBody}>
        <TeamPreview />
        <MatchRoster />
      </div>

      <MatchOperationsSummary />
      <LifecyclePreview />
    </div>
  );
}
