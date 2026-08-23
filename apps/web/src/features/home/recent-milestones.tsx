import { Text } from "@football/ui";

import { homeMockContent } from "./home-mock-content";
import styles from "./home.module.css";

export function RecentMilestones() {
  return (
    <section aria-labelledby="milestones-title" className={styles.milestones}>
      <Text as="h2" id="milestones-title" variant="heading-lg">
        Últimos hitos
      </Text>
      <ol className={styles.timeline}>
        {homeMockContent.milestones.map((milestone) => (
          <li className={styles.timelineItem} key={milestone.detail}>
            <span aria-hidden="true" className={styles.timelineMark} />
            <div>
              <Text as="span" tone="accent" variant="metadata">
                {milestone.mark}
              </Text>
              <Text as="p" variant="body">
                {milestone.detail}
              </Text>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
