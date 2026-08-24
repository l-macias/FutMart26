import { Text } from "@football/ui";

import { profileMock } from "./profile-mock-content";
import styles from "./profile.module.css";

export function PlayerStats() {
  return (
    <section aria-labelledby="stats-title" className={styles.panelSection}>
      <Text as="h2" id="stats-title" variant="heading-lg">
        Stats
      </Text>
      <dl className={styles.openStats}>
        <div>
          <dt>Partidos</dt>
          <dd>{profileMock.stats.matches}</dd>
        </div>
        <div>
          <dt>Goles</dt>
          <dd>{profileMock.stats.goals}</dd>
        </div>
        <div>
          <dt>Asistencias</dt>
          <dd>{profileMock.stats.assists}</dd>
        </div>
      </dl>
      <div className={styles.groupBreakdown}>
        <Text as="h3" variant="heading-md">
          Actividad por grupo
        </Text>
        <Text tone="muted" variant="metadata">
          El OVR F5 es único. Este desglose muestra actividad.
        </Text>
        <ul>
          {profileMock.groups.map((group) => (
            <li key={group.name}>
              <Text as="span" variant="label">
                {group.name}
              </Text>
              <Text as="span" tone="muted">
                {group.matches} partidos
              </Text>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
