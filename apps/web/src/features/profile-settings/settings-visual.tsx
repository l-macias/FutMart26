import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./settings-visual.module.css";

export type SettingsArea = "overview" | "profile" | "football" | "account";

const settingsDestinations = [
  { area: "overview", href: "/profile/settings", label: "Resumen", mark: "01" },
  { area: "profile", href: "/profile/edit", label: "Perfil", mark: "ID" },
  {
    area: "football",
    href: "/profile/preferences",
    label: "Fútbol F5",
    mark: "F5",
  },
  { area: "account", href: "/profile/account", label: "Cuenta", mark: "AC" },
] as const;

export function SettingsFrame({
  active,
  eyebrow,
  title,
  description,
  children,
}: Readonly<{
  active: SettingsArea;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <div className={`${styles.page} ui-visual-v4`}>
      <header className={styles.header}>
        <Link className={styles.back} href="/profile">
          <span aria-hidden="true">←</span> MI PERFIL
        </Link>
        <div className={styles.titleLockup}>
          <span className={styles.kicker}>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <span aria-hidden="true" className={styles.serial}>
          F5 / AJUSTES
        </span>
      </header>

      <div className={styles.layout}>
        <nav aria-label="Secciones de configuración" className={styles.nav}>
          <span className={styles.navLabel}>CONFIGURACIÓN</span>
          {settingsDestinations.map((destination) => (
            <Link
              aria-current={active === destination.area ? "page" : undefined}
              className={styles.navItem}
              href={destination.href}
              key={destination.area}
            >
              <SettingsGlyph label={destination.mark} />
              <span>{destination.label}</span>
              <span aria-hidden="true" className={styles.chevron}>
                ›
              </span>
            </Link>
          ))}
        </nav>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

export function SettingsGlyph({
  label,
  tone = "default",
}: Readonly<{ label: string; tone?: "default" | "danger" }>) {
  return (
    <span className={styles.glyph} data-tone={tone} aria-hidden="true">
      {label}
    </span>
  );
}

export function SettingsRow({
  href,
  mark,
  title,
  description,
  value,
  danger = false,
}: Readonly<{
  href: string;
  mark: string;
  title: string;
  description: string;
  value?: string;
  danger?: boolean;
}>) {
  return (
    <Link className={styles.row} data-danger={danger || undefined} href={href}>
      <SettingsGlyph label={mark} tone={danger ? "danger" : "default"} />
      <span className={styles.rowCopy}>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      {value ? <span className={styles.value}>{value}</span> : null}
      <span aria-hidden="true" className={styles.chevron}>
        ›
      </span>
    </Link>
  );
}
