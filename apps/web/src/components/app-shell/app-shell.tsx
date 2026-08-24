"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { IconButton, Text } from "@football/ui";

import styles from "./app-shell.module.css";

const navigation = [
  { href: "/", label: "Home", mark: "01" },
  { href: "/play", label: "Jugar", mark: "02" },
  { href: "/groups", label: "Grupos", mark: "03" },
  { href: "/rankings", label: "Rankings", mark: "04" },
  { href: "/profile", label: "Perfil", mark: "05" },
] as const;

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link aria-label="F5 Groups, inicio" className={styles.brand} href="/">
          <span aria-hidden="true" className={styles.brandMark}>
            F5
          </span>
          <span>
            <Text as="span" variant="heading-md">
              Groups
            </Text>
            <Text as="span" tone="muted" variant="metadata">
              Night football
            </Text>
          </span>
        </Link>

        <div className={styles.utilities}>
          <IconButton disabled label="Notificaciones, próximamente">
            <NotificationIcon />
          </IconButton>
          <Link
            aria-label="Abrir perfil"
            className="ui-icon-button"
            href="/profile"
          >
            <ProfileIcon />
          </Link>
        </div>
      </header>

      <div className={styles.frame}>
        <nav aria-label="Navegación principal" className={styles.navigation}>
          {navigation.map((item) => {
            const active =
              item.href === "/"
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={styles.navigationItem}
                href={item.href}
                key={item.href}
              >
                <span aria-hidden="true" className={styles.navigationMark}>
                  {item.mark}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

function NotificationIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M6.5 16.5h11l-1.5-2V10a4 4 0 0 0-8 0v4.5l-1.5 2Z" />
      <path d="M10 19h4" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3" />
      <path d="M6.5 19a5.5 5.5 0 0 1 11 0" />
    </svg>
  );
}
