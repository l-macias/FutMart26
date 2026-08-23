import { Text } from "@football/ui";

import { matchDetailMockContent } from "./match-detail-mock-content";
import styles from "./match-detail.module.css";

export function LifecyclePreview() {
  return (
    <section aria-labelledby="lifecycle-title" className={styles.lifecycle}>
      <div>
        <Text as="span" tone="accent" variant="metadata">
          Estado del partido
        </Text>
        <Text as="h2" id="lifecycle-title" variant="heading-md">
          Lifecycle
        </Text>
      </div>
      <ol>
        {matchDetailMockContent.lifecycle.map((step, index) => (
          <li aria-current={index === 0 ? "step" : undefined} key={step}>
            <span aria-hidden="true" className={styles.lifecycleNode}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <Text
              as="span"
              tone={index === 0 ? "accent" : "muted"}
              variant="metadata"
            >
              {step}
            </Text>
          </li>
        ))}
      </ol>
    </section>
  );
}
