import { TacticalDivider } from "@football/football-ui";
import { Text } from "@football/ui";

import { NextMatchPreview } from "./next-match-preview";
import { RankingPreview } from "./ranking-preview";
import { RecentMilestones } from "./recent-milestones";
import { RisingPlayers } from "./rising-players";
import styles from "./home.module.css";
import { WeeklyActivity } from "./weekly-activity";

export function HomeScreen() {
  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <Text as="span" tone="accent" variant="label">
          F5 Groups
        </Text>
        <Text as="h1" variant="display-lg">
          Tu fútbol, partido a partido.
        </Text>
        <Text className={styles.introCopy} tone="muted" variant="body">
          Jugá, medí tu progreso y seguí el pulso de la cancha.
        </Text>
      </header>

      <NextMatchPreview />
      <TacticalDivider />

      <div className={styles.editorialGrid}>
        <RankingPreview />
        <RisingPlayers />
      </div>

      <WeeklyActivity />
      <TacticalDivider />
      <RecentMilestones />
    </div>
  );
}
