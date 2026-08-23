import { Text } from "@football/ui";

import styles from "./match-detail.module.css";

export function MatchCapacity() {
  return (
    <section aria-labelledby="match-capacity-title" className={styles.capacity}>
      <div className={styles.sectionHeading}>
        <Text as="h2" id="match-capacity-title" variant="heading-md">
          Estado del cupo
        </Text>
        <Text as="span" tone="muted" variant="metadata">
          12 anotados
        </Text>
      </div>

      <div aria-hidden="true" className={styles.capacityTrack}>
        {Array.from({ length: 8 }, (_, index) => (
          <span className={styles.confirmedSpot} key={`confirmed-${index}`} />
        ))}
        {Array.from({ length: 2 }, (_, index) => (
          <span key={`open-${index}`} />
        ))}
        {Array.from({ length: 2 }, (_, index) => (
          <span className={styles.waitlistSpot} key={`waitlist-${index}`} />
        ))}
      </div>

      <div className={styles.capacityLegend}>
        <Text as="span" variant="label">
          8 confirmados
        </Text>
        <Text as="span" tone="muted" variant="label">
          2 lugares
        </Text>
        <Text as="span" tone="accent" variant="label">
          2 suplentes
        </Text>
      </div>
    </section>
  );
}
