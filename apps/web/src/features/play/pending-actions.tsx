import Link from "next/link";

import { MatchStateMark } from "@football/football-ui";
import { Text } from "@football/ui";

import { playMockContent } from "./play-mock-content";
import styles from "./play.module.css";

export function PendingActions() {
  const { voting, results, promotion } = playMockContent.pendingActions;

  return (
    <section aria-labelledby="pending-title" className={styles.pending}>
      <Text as="h2" id="pending-title" variant="heading-lg">
        Acciones pendientes
      </Text>

      <article className={styles.votingAction}>
        <MatchStateMark tone="warning">{voting.eyebrow}</MatchStateMark>
        <Text as="h3" variant="heading-md">
          {voting.title}
        </Text>
        <Text tone="muted" variant="body">
          {voting.detail}
        </Text>
        <Link className={styles.actionLink} href="/play/voting-demo">
          Votar →
        </Link>
      </article>

      <article className={styles.resultsAction}>
        <Text as="span" tone="accent" variant="label">
          {results.eyebrow}
        </Text>
        <Text as="h3" variant="heading-md">
          {results.title}
        </Text>
        <Text tone="muted" variant="body">
          {results.detail}
        </Text>
        <Link className={styles.actionLink} href="/play/results-demo">
          Ver resultados →
        </Link>
      </article>

      <article className={styles.promotionAction}>
        <MatchStateMark tone="positive">{promotion.eyebrow}</MatchStateMark>
        <Text variant="body">{promotion.detail}</Text>
      </article>
    </section>
  );
}
