import { TacticalDivider } from "@football/football-ui";
import { Text } from "@football/ui";

import { CapacityStatus } from "./capacity-status";
import { LastMatchSummary } from "./last-match-summary";
import { NextMatchPanel } from "./next-match-panel";
import { PendingActions } from "./pending-actions";
import styles from "./play.module.css";
import { UpcomingMatches } from "./upcoming-matches";

export function PlayScreen() {
  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <Text as="span" tone="accent" variant="label">
          Jugar
        </Text>
        <Text as="h1" variant="display-lg">
          Lo que viene.
        </Text>
        <Text tone="muted" variant="body">
          Tus partidos, estados y acciones pendientes.
        </Text>
      </header>

      <div className={styles.primaryZone}>
        <div className={styles.matchColumn}>
          <NextMatchPanel />
          <CapacityStatus />
        </div>
        <PendingActions />
      </div>

      <TacticalDivider />

      <div className={styles.secondaryZone}>
        <UpcomingMatches />
        <LastMatchSummary />
      </div>
    </div>
  );
}
