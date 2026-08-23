import { MatchStateMark } from "@football/football-ui";
import { Text } from "@football/ui";

import { playMockContent } from "./play-mock-content";
import styles from "./play.module.css";

export function UpcomingMatches() {
  return (
    <section aria-labelledby="upcoming-title" className={styles.upcoming}>
      <Text as="h2" id="upcoming-title" variant="heading-lg">
        Próximos partidos
      </Text>
      <ol className={styles.upcomingList}>
        {playMockContent.upcomingMatches.map((match, index) => (
          <li
            className={styles.upcomingRow}
            key={`${match.time}-${match.name}`}
          >
            <span className={styles.matchIndex}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <Text as="span" tone="muted" variant="metadata">
                {match.time}
              </Text>
              <Text as="h3" variant="heading-md">
                {match.name}
              </Text>
            </div>
            <MatchStateMark tone={match.tone}>{match.state}</MatchStateMark>
          </li>
        ))}
      </ol>
    </section>
  );
}
