import { Text } from "@football/ui";

import styles from "./match-detail.module.css";

export function MatchOperationsSummary() {
  return (
    <section aria-labelledby="operations-title" className={styles.operations}>
      <Text as="h2" id="operations-title" variant="heading-md">
        Operación
      </Text>
      <dl className={styles.operationsList}>
        <div>
          <dt>Organiza</dt>
          <dd>Lucas</dd>
        </div>
        <div>
          <dt>Veedor</dt>
          <dd>Sin asignar</dd>
        </div>
        <div>
          <dt>Invitados</dt>
          <dd>1</dd>
        </div>
      </dl>
    </section>
  );
}
