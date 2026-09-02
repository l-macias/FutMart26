import { Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import styles from "./profile.module.css";

type Performance = Awaited<ReturnType<typeof api.performance>>;
type Preferences = Awaited<ReturnType<typeof api.preferences>>;
type Groups = Awaited<ReturnType<typeof api.groups>>;

export function ProfileSummary({
  performance,
  preferences,
  groups,
}: Readonly<{
  performance: Performance;
  preferences: Preferences;
  groups: Groups;
}>) {
  return (
    <section aria-labelledby="summary-title" className={styles.panelSection}>
      <Text as="h2" id="summary-title" variant="heading-lg">
        Resumen
      </Text>
      <dl className={styles.metricList}>
        <div>
          <dt>OVR actual</dt>
          <dd>{Math.round(performance.overall)}</dd>
        </div>
        <div>
          <dt>Partidos procesados</dt>
          <dd>{performance.processedMatchCount}</dd>
        </div>
        <div>
          <dt>Perfil de rating</dt>
          <dd>{performance.ratingProfile}</dd>
        </div>
        <div>
          <dt>Arquero disponible</dt>
          <dd>{preferences.willingToPlayGoalkeeper ? "Sí" : "No"}</dd>
        </div>
      </dl>
      <div className={styles.signalGrid}>
        <div>
          <Text as="span" className={styles.positive} variant="label">
            Fortalezas declaradas
          </Text>
          <Text>
            {preferences.strengths.length > 0
              ? preferences.strengths.join(" · ")
              : "Sin fortalezas declaradas"}
          </Text>
        </div>
        <div>
          <Text as="span" tone="accent" variant="label">
            Roles preferidos
          </Text>
          <Text>
            {preferences.preferredRoles.length > 0
              ? preferences.preferredRoles.join(" · ")
              : "Sin roles configurados"}
          </Text>
        </div>
      </div>
      <div className={styles.groupMemberships}>
        <Text as="h3" variant="heading-md">
          Grupos
        </Text>
        <Text tone="muted">
          {groups.length > 0
            ? groups.map((group) => group.name).join(" · ")
            : "Todavía no pertenecés a ningún grupo."}
        </Text>
      </div>
    </section>
  );
}
