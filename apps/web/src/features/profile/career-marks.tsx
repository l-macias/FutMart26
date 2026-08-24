import { Text } from "@football/ui";

import { profileMock } from "./profile-mock-content";
import styles from "./profile.module.css";

export function CareerMarks() {
  return (
    <section aria-labelledby="marks-title" className={styles.panelSection}>
      <Text as="h2" id="marks-title" variant="heading-lg">
        Logros
      </Text>
      <div className={styles.markGroup}>
        <div>
          <Text as="span" tone="accent" variant="label">
            Achievements
          </Text>
          <Text tone="muted">Hitos verificables de carrera.</Text>
        </div>
        <ul className={styles.achievementList}>
          {profileMock.achievements.map((achievement) => (
            <li
              className={
                achievement.status === "locked" ? styles.locked : undefined
              }
              key={achievement.label}
            >
              <span aria-hidden="true" className={styles.achievementMark} />
              <Text as="span" variant="label">
                {achievement.label}
              </Text>
              <Text as="span" tone="muted" variant="metadata">
                {achievement.status === "locked" ? "Bloqueado" : "Conseguido"}
              </Text>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.markGroup}>
        <div>
          <Text as="span" className={styles.positive} variant="label">
            Awards
          </Text>
          <Text tone="muted">Reconocimientos por rendimiento.</Text>
        </div>
        <ul className={styles.awardList}>
          {profileMock.awards.map((award) => (
            <li key={award}>
              <span aria-hidden="true" />
              <Text as="span" variant="heading-md">
                {award}
              </Text>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
