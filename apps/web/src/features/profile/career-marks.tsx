import { Text } from "@football/ui";
import type { OwnPlayerProfile } from "@football/contracts";

import styles from "./profile.module.css";

export function CareerMarks({
  rewards,
}: Readonly<{ rewards: OwnPlayerProfile["rewards"] }>) {
  return (
    <section aria-labelledby="marks-title" className={styles.panelSection}>
      <Text as="h2" id="marks-title" variant="heading-lg">
        Logros y premios
      </Text>
      <div className={styles.markGroup}>
        <div>
          <Text as="h3" tone="accent" variant="heading-sm">
            Logros
          </Text>
          <Text tone="muted">Hitos verificables de carrera.</Text>
        </div>
        <ul className={styles.achievementList}>
          {rewards.achievements.map((achievement) => (
            <li key={achievement.type}>
              <span aria-hidden="true" className={styles.achievementMark} />
              <Text as="span" variant="label">
                {achievement.title}
              </Text>
              <Text as="span" tone="muted" variant="metadata">
                {achievement.description}
              </Text>
            </li>
          ))}
          {rewards.achievements.length === 0 ? (
            <li>
              <Text tone="muted">Tus primeros hitos aparecerán acá.</Text>
            </li>
          ) : null}
        </ul>
      </div>
      <div className={styles.markGroup}>
        <div>
          <Text as="h3" className={styles.positive} variant="heading-sm">
            Premios
          </Text>
          <Text tone="muted">Reconocimientos por rendimiento.</Text>
        </div>
        <ul className={styles.awardList}>
          {rewards.awardSummary.map((award) => (
            <li key={award.type}>
              <span aria-hidden="true" />
              <span>
                <Text as="span" variant="heading-md">
                  {award.title}
                  {award.count > 1 ? ` ×${award.count}` : ""}
                </Text>
                <Text as="span" tone="muted" variant="metadata">
                  {award.description}
                </Text>
              </span>
            </li>
          ))}
          {rewards.awardSummary.length === 0 ? (
            <li>
              <span aria-hidden="true" />
              <Text tone="muted">Todavía no recibiste premios de partido.</Text>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
