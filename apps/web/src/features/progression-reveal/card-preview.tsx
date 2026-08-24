import { Text } from "@football/ui";

import styles from "./progression-reveal.module.css";

export function CardPreview() {
  return (
    <figure className={styles.cardPreview}>
      <div
        aria-label="Área reservada para artwork futuro"
        className={styles.cardArtwork}
      >
        <span aria-hidden="true" />
        <Text as="span" tone="muted" variant="metadata">
          Artwork futuro
        </Text>
      </div>
      <figcaption className={styles.cardData}>
        <Text as="span" className={styles.cardOverall} variant="score">
          71
        </Text>
        <span>
          <Text as="span" className={styles.cardName} variant="heading-md">
            Lucas
          </Text>
          <Text as="span" tone="muted" variant="metadata">
            F5 · Silver
          </Text>
        </span>
      </figcaption>
    </figure>
  );
}
