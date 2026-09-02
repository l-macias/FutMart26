import Link from "next/link";
import { Text } from "@football/ui";
import styles from "../legal.module.css";

export default function SupportPage() {
  const email = process.env.SUPPORT_EMAIL;
  return (
    <main className={styles.page}>
      <header>
        <Text tone="accent" variant="label">
          SOPORTE Y CONFIANZA
        </Text>
        <Text as="h1" variant="display-lg">
          Estamos para ayudarte.
        </Text>
        <Text tone="muted">
          Problemas de acceso, privacidad, seguridad o conducta.
        </Text>
      </header>
      <section>
        <h2>Contacto</h2>
        {email ? (
          <p>
            Escribinos a <a href={`mailto:${email}`}>{email}</a>.
          </p>
        ) : (
          <p>
            El canal de soporte todavía no está configurado en este entorno. En
            producción, la aplicación requiere <code>SUPPORT_EMAIL</code>.
          </p>
        )}
      </section>
      <section>
        <h2>Reportar contenido o conducta</h2>
        <p>
          En perfiles, grupos y partidos autenticados vas a encontrar la acción
          REPORTAR. No uses el reporte para emergencias.
        </p>
      </section>
      <section>
        <h2>Documentos</h2>
        <p>
          <Link href="/terms">Términos</Link> ·{" "}
          <Link href="/privacy">Privacidad</Link>
        </p>
      </section>
    </main>
  );
}
