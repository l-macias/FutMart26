import Link from "next/link";

import { Button, Surface, Text } from "@football/ui";

import { matchDetailMockContent } from "./match-detail-mock-content";
import styles from "./match-detail.module.css";

export function TeamPreview() {
  return (
    <section aria-labelledby="teams-title" className={styles.teams}>
      <div className={styles.teamsHeading}>
        <div>
          <Text as="span" tone="accent" variant="metadata">
            Propuesta editable
          </Text>
          <Text as="h2" id="teams-title" variant="heading-lg">
            Equipos propuestos
          </Text>
        </div>
        <div
          className={styles.balance}
          aria-label="Balance: 94%. Equipos parejos."
        >
          <span aria-hidden="true">94%</span>
          <Text as="span" tone="muted" variant="metadata">
            Balance · Equipos parejos
          </Text>
        </div>
      </div>

      <div className={styles.teamsBoard}>
        {matchDetailMockContent.teams.map((team) => (
          <Surface as="article" className={styles.team} key={team.name}>
            <Text as="h3" variant="heading-md">
              {team.name}
            </Text>
            <ol>
              {team.members.map((member, index) => (
                <li key={member.name}>
                  <span className={styles.teamNode}>{index + 1}</span>
                  <Text as="span" variant="label">
                    {member.name}
                  </Text>
                  <Text as="span" tone="muted" variant="metadata">
                    {member.position}
                  </Text>
                </li>
              ))}
            </ol>
          </Surface>
        ))}
      </div>

      <div className={styles.teamActions}>
        <Button
          disabled
          title="Matchmaking no disponible en este mock"
          variant="secondary"
        >
          Rearmar
        </Button>
        <Link
          className={styles.teamNavigationLink}
          href="/play/match-demo/matchmaking"
        >
          Editar equipos
        </Link>
      </div>
    </section>
  );
}
