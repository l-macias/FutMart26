import { Text } from "@football/ui";

import { profileMock } from "./profile-mock-content";
import styles from "./profile.module.css";

export function PlayerCardMock() {
  return (
    <figure
      aria-label={`${profileMock.name}, ${profileMock.overall} OVR, ${profileMock.discipline}, tier ${profileMock.tier}`}
      className={styles.playerCard}
    >
      <div aria-hidden="true" className={styles.skinLayer}>
        <span />
        <span />
      </div>
      <div
        aria-label="Área reservada para artwork futuro del jugador"
        className={styles.artworkLayer}
      >
        <div aria-hidden="true" className={styles.playerSilhouette} />
        <Text as="span" tone="muted" variant="metadata">
          Artwork futuro
        </Text>
      </div>
      <div className={styles.dataLayer}>
        <header className={styles.cardTop}>
          <span>
            <Text as="span" className={styles.cardOverall} variant="score">
              {profileMock.overall}
            </Text>
            <Text as="span" variant="metadata">
              OVR
            </Text>
          </span>
          <Text
            as="span"
            className={styles.cardDiscipline}
            variant="heading-md"
          >
            {profileMock.discipline}
          </Text>
        </header>
        <div aria-hidden="true" />
        <Text as="span" className={styles.cardName} variant="display-lg">
          {profileMock.name}
        </Text>
        <dl className={styles.cardStats}>
          {profileMock.attributes.map((attribute) => (
            <div key={attribute.code} title={attribute.label}>
              <dt>{attribute.code}</dt>
              <dd>{attribute.value}</dd>
            </div>
          ))}
        </dl>
        <Text as="span" className={styles.cardTier} variant="label">
          {profileMock.tier}
        </Text>
      </div>
    </figure>
  );
}
