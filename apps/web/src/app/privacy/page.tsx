import Link from "next/link";
import { Text } from "@football/ui";
import styles from "../legal.module.css";

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <header>
        <Text tone="accent" variant="label">
          PRIVACIDAD · V1
        </Text>
        <Text as="h1" variant="display-lg">
          Tus datos y tu historia deportiva
        </Text>
        <Text tone="muted">Vigente desde el 1 de septiembre de 2026.</Text>
      </header>
      <section>
        <h2>Datos que tratamos</h2>
        <p>
          Usamos datos de cuenta, fecha de nacimiento privada, identidad
          deportiva, preferencias, foto opcional, participación en grupos y
          partidos, estadísticas, votos agregados, rendimiento y premios.
        </p>
      </section>
      <section>
        <h2>Para qué</h2>
        <p>
          Los tratamos para autenticarte, operar partidos y grupos, calcular
          progresión y rankings, prevenir abuso y brindar soporte.
        </p>
      </section>
      <section>
        <h2>Visibilidad</h2>
        <p>
          Tu perfil puede ser público o privado dentro de la comunidad
          autenticada. La privacidad global no elimina evidencia contextual de
          grupos o partidos compartidos. Tu email, fecha de nacimiento, sesiones
          y datos de recuperación nunca forman parte del perfil deportivo
          público.
        </p>
      </section>
      <section>
        <h2>Conservación y eliminación</h2>
        <p>
          Al eliminar la cuenta borramos credenciales, sesiones, conexiones,
          invitaciones, preferencias declaradas y foto. Anonimizamos la
          identidad conservando evidencia deportiva que protege la integridad de
          partidos, resultados, progresión y premios.
        </p>
      </section>
      <section>
        <h2>Contacto</h2>
        <p>
          Para consultas, ejercicio de derechos o reportes, usá{" "}
          <Link href="/support">Soporte</Link>.
        </p>
      </section>
    </main>
  );
}
