import { Text } from "@football/ui";

import { profileMock } from "./profile-mock-content";
import styles from "./profile.module.css";

export function ProgressionTimeline() {
  return (
    <section
      aria-labelledby="progression-title"
      className={styles.panelSection}
    >
      <Text as="h2" id="progression-title" variant="heading-lg">
        Progresión
      </Text>
      <ol className={styles.timeline}>
        {profileMock.progression.map((event, index) => (
          <li key={`${event.date}-${event.label}`}>
            <span aria-hidden="true" className={styles.timelineNode}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <Text as="span" variant="metadata">
                {event.date}
              </Text>
              <Text as="h3" variant="heading-md">
                {event.label}
              </Text>
              <Text as="span" tone="accent" variant="label">
                {event.detail}
              </Text>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
