import { Text } from "@football/ui";

import { homeMockContent } from "./home-mock-content";
import styles from "./home.module.css";

export function WeeklyActivity() {
  return (
    <section aria-labelledby="activity-title" className={styles.activity}>
      <Text as="h2" id="activity-title" variant="heading-lg">
        Esta semana
      </Text>
      <div className={styles.activityStats}>
        {homeMockContent.activity.map((stat) => (
          <div className={styles.activityStat} key={stat.label}>
            <span className={styles.activityValue}>{stat.value}</span>
            <Text as="span" tone="muted" variant="label">
              {stat.label}
            </Text>
          </div>
        ))}
      </div>
    </section>
  );
}
