import { Text } from "@football/ui";

import { profileMock } from "./profile-mock-content";
import styles from "./profile.module.css";

const summaryItems = [
  ["OVR actual", profileMock.overall],
  ["Personal best", profileMock.personalBest],
  ["Forma reciente", profileMock.recentRating],
  ["Partidos", profileMock.stats.matches],
  ["Último partido", profileMock.lastMatch],
] as const;

export function ProfileSummary() {
  return (
    <section aria-labelledby="summary-title" className={styles.panelSection}>
      <Text as="h2" id="summary-title" variant="heading-lg">
        Resumen
      </Text>
      <dl className={styles.metricList}>
        {summaryItems.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.signalGrid}>
        <div>
          <Text as="span" className={styles.positive} variant="label">
            Fortalezas actuales
          </Text>
          <Text>{profileMock.strengths.join(" · ")}</Text>
        </div>
        <div>
          <Text as="span" className={styles.negative} variant="label">
            Foco actual
          </Text>
          <Text>{profileMock.currentFocus}</Text>
        </div>
      </div>
      <div className={styles.groupMemberships}>
        <Text as="h3" variant="heading-md">
          Grupos
        </Text>
        <Text tone="muted">
          {profileMock.groups.map((group) => group.name).join(" · ")}
        </Text>
      </div>
    </section>
  );
}
