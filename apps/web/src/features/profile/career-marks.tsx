import { Text } from "@football/ui";
import type { OwnPlayerProfile } from "@football/contracts";

import { V4RewardBadge } from "@/components/visual-v4/profile-assets";
import styles from "./profile.module.css";

export function CareerMarks({
  rewards,
}: Readonly<{ rewards: OwnPlayerProfile["rewards"] }>) {
  return (
    <section
      aria-labelledby="marks-title"
      className={`${styles.panelSection} ${styles.rewardsModule}`}
    >
      <div className={styles.moduleTitle}>
        <Text tone="accent" variant="label">
          PALMARÉS
        </Text>
        <Text as="h2" id="marks-title" variant="heading-lg">
          Logros y premios
        </Text>
      </div>
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
              <V4RewardBadge
                label={achievement.title}
                seed={achievement.type}
                size="large"
              />
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
              <V4RewardBadge
                label={award.title}
                seed={award.type}
                size="large"
              />
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
