import { MatchStateMark } from "@football/football-ui";
import { Text } from "@football/ui";

import { matchDetailMockContent } from "./match-detail-mock-content";
import styles from "./match-detail.module.css";

export function MatchRoster() {
  return (
    <section aria-labelledby="roster-title" className={styles.roster}>
      <Text as="h2" id="roster-title" variant="heading-lg">
        Jugadores
      </Text>

      <div className={styles.rosterGroup}>
        <div className={styles.rosterGroupHeading}>
          <Text as="h3" variant="heading-md">
            Confirmados
          </Text>
          <Text as="span" tone="muted" variant="metadata">
            8 jugadores
          </Text>
        </div>
        <ol className={styles.playerList}>
          {matchDetailMockContent.confirmed.map((player, index) => (
            <li key={player.name}>
              <span aria-hidden="true" className={styles.playerToken}>
                {player.initials}
              </span>
              <span className={styles.playerOrder}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <Text as="span" variant="heading-md">
                {player.name}
              </Text>
              <Text as="span" tone="muted" variant="metadata">
                {player.role}
              </Text>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.rosterBottom}>
        <div className={styles.waitlist}>
          <div className={styles.rosterGroupHeading}>
            <Text as="h3" variant="heading-md">
              Suplentes
            </Text>
            <MatchStateMark tone="warning">En espera</MatchStateMark>
          </div>
          <ol>
            {matchDetailMockContent.waitlist.map((player) => (
              <li key={player.name}>
                <span>{player.order}</span>
                <Text as="span" variant="body">
                  {player.name}
                </Text>
              </li>
            ))}
          </ol>
        </div>

        <article className={styles.guest}>
          <Text as="span" tone="accent" variant="metadata">
            Guest
          </Text>
          <div>
            <span aria-hidden="true" className={styles.guestToken}>
              {matchDetailMockContent.guest.initials}
            </span>
            <Text as="h3" variant="heading-md">
              {matchDetailMockContent.guest.name}
            </Text>
          </div>
          <Text tone="muted" variant="metadata">
            Invitado cargado para este partido
          </Text>
        </article>
      </div>
    </section>
  );
}
