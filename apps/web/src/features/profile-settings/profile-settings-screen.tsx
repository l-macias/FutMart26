import Link from "next/link";

import { Text } from "@football/ui";

import styles from "./profile-settings.module.css";

const sections = [
  {
    eyebrow: "PERFIL",
    title: "Identidad deportiva",
    description: "Nombre deportivo, foto y visibilidad.",
    links: [{ href: "/profile/edit", label: "Editar perfil" }],
  },
  {
    eyebrow: "FÚTBOL F5",
    title: "Fútbol F5",
    description: "Roles, fortalezas y disponibilidad para atajar.",
    links: [{ href: "/profile/preferences", label: "Preferencias de juego" }],
  },
  {
    eyebrow: "CUENTA Y SEGURIDAD",
    title: "Acceso y sesiones",
    description: "Contraseña y dispositivos donde tu cuenta sigue abierta.",
    links: [{ href: "/profile/account", label: "Cuenta y seguridad" }],
  },
] as const;

export function ProfileSettingsScreen() {
  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/profile">
        ← MI PERFIL
      </Link>
      <header className={styles.header}>
        <Text as="span" tone="accent" variant="label">
          MI CUENTA
        </Text>
        <Text as="h1" variant="heading-lg">
          Configuración
        </Text>
        <Text tone="muted">
          Estos ajustes cambian cómo te mostrás o cómo accedés. Tu carrera y
          rendimiento se mantienen separados.
        </Text>
      </header>

      <div className={styles.sections}>
        {sections.map((section) => (
          <section className={styles.section} key={section.title}>
            <div>
              <Text as="span" tone="accent" variant="label">
                {section.eyebrow}
              </Text>
              <Text as="h2" variant="heading-lg">
                {section.title}
              </Text>
              <Text tone="muted">{section.description}</Text>
            </div>
            {section.links.map((link) => (
              <Link
                className="ui-button ui-button--secondary"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </section>
        ))}
        <section className={styles.section}>
          <div>
            <Text as="span" tone="accent" variant="label">
              LEGAL Y PRIVACIDAD
            </Text>
            <Text as="h2" variant="heading-lg">
              Políticas y soporte
            </Text>
            <Text tone="muted">
              Consultá las políticas vigentes y los canales de soporte.
            </Text>
          </div>
          <nav aria-label="Legal y privacidad" className={styles.links}>
            <Link href="/terms">Términos</Link>
            <Link href="/privacy">Privacidad</Link>
            <Link href="/support">Soporte</Link>
          </nav>
        </section>
        <section className={`${styles.section} ${styles.danger}`}>
          <div>
            <Text as="span" tone="muted" variant="label">
              ZONA DE RIESGO
            </Text>
            <Text as="h2" variant="heading-lg">
              Eliminar cuenta
            </Text>
            <Text tone="muted">
              Elimina el acceso y anonimiza la identidad conservando la
              evidencia deportiva histórica necesaria.
            </Text>
          </div>
          <Link
            className="ui-button ui-button--danger"
            href="/profile/account#delete-account"
          >
            Revisar eliminación
          </Link>
        </section>
      </div>
    </main>
  );
}
