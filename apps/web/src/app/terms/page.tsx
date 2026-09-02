import Link from "next/link";
import { Text } from "@football/ui";
import styles from "../legal.module.css";

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <header>
        <Text tone="accent" variant="label">
          TÉRMINOS · V1
        </Text>
        <Text as="h1" variant="display-lg">
          Reglas de uso de la beta
        </Text>
        <Text tone="muted">Vigentes desde el 1 de septiembre de 2026.</Text>
      </header>
      <section>
        <h2>Acceso</h2>
        <p>
          La beta está disponible únicamente para personas de 18 años o más. La
          cuenta es personal y cada usuario debe proteger sus credenciales.
        </p>
      </section>
      <section>
        <h2>Organización deportiva</h2>
        <p>
          Los grupos, partidos, resultados, votos y rankings son herramientas de
          coordinación amateur. Los organizadores siguen siendo responsables por
          la seguridad física, las instalaciones y el desarrollo de cada
          partido.
        </p>
      </section>
      <section>
        <h2>Conducta</h2>
        <p>
          No se permite acoso, suplantación, spam, contenido ilegal ni uso
          abusivo. Podemos investigar reportes y limitar cuentas para proteger a
          la comunidad.
        </p>
      </section>
      <section>
        <h2>Disponibilidad y cambios</h2>
        <p>
          La plataforma se ofrece en beta y puede tener interrupciones. Las
          reglas deportivas confirmadas preservan su evidencia; los cambios de
          producto se aplican de forma prospectiva salvo correcciones de
          integridad.
        </p>
      </section>
      <section>
        <h2>Contacto</h2>
        <p>
          Consultas o reportes: <Link href="/support">Soporte</Link>. La
          política de datos está en <Link href="/privacy">Privacidad</Link>.
        </p>
      </section>
    </main>
  );
}
