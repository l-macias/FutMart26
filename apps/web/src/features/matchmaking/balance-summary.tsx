import { MatchStateMark } from "@football/football-ui";
import { Text } from "@football/ui";

import type { MockComposition } from "./matchmaking-mock-content";
import styles from "./matchmaking.module.css";

export function BalanceSummary({
  composition,
  editing,
}: Readonly<{ composition: MockComposition; editing: boolean }>) {
  return (
    <section
      aria-labelledby="balance-title"
      className={`${styles.balance} ${editing ? styles.balanceEditing : ""}`}
    >
      <div>
        <span className={styles.balanceValue}>{composition.balance}</span>
        <Text as="h2" id="balance-title" variant="label">
          Balance
        </Text>
      </div>
      <div className={styles.balanceMessage}>
        <Text as="p" variant="heading-md">
          {composition.balanceMessage}
        </Text>
        <Text tone="muted" variant="metadata">
          {composition.label}
        </Text>
      </div>
      {composition.warnings.length > 0 ? (
        <div className={styles.warnings}>
          {composition.warnings.map((warning) => (
            <MatchStateMark key={warning} tone="warning">
              {warning}
            </MatchStateMark>
          ))}
        </div>
      ) : null}
    </section>
  );
}
