"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { IconButton } from "@football/ui";

import { NotificationDropdown } from "@/features/notifications/notification-dropdown";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { authClient } from "@/lib/auth/auth-client";
import styles from "./app-shell.module.css";

const navigation = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/play", label: "Jugar", icon: "play" },
  { href: "/groups", label: "Grupos", icon: "groups" },
  { href: "/rankings", label: "Rankings", icon: "rankings" },
  { href: "/profile", label: "Perfil", icon: "profile" },
] as const;

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const unread = useQuery({
    queryKey: queryKeys.notificationUnreadCount,
    queryFn: api.notificationUnreadCount,
  });
  return (
    <div className={`${styles.shell} ui-visual-v3 ui-visual-v4`}>
      <header className={styles.header}>
        <Link aria-label="F5 Groups, inicio" className={styles.brand} href="/">
          <span aria-hidden="true" className={styles.brandMark}>
            F5
          </span>
          <span className={styles.brandIdentity} aria-hidden="true">
            FIFAR<small>FÚTBOL REAL</small>
          </span>
        </Link>

        <div className={styles.utilities}>
          <Link
            aria-label="Buscar jugadores o grupos"
            className="ui-icon-button"
            href="/search"
          >
            <SearchIcon />
          </Link>
          <NotificationDropdown unreadCount={unread.data?.count ?? 0} />
          <Link
            aria-label="Abrir perfil"
            className="ui-icon-button"
            href="/profile"
          >
            <ProfileIcon />
          </Link>
          <span className={styles.logoutAction}>
            <IconButton
              label="Cerrar sesión"
              onClick={() => {
                void authClient.signOut().then((result) => {
                  if (result.error) return;
                  queryClient.clear();
                  router.replace("/auth");
                });
              }}
            >
              <LogoutIcon />
            </IconButton>
          </span>
        </div>
      </header>

      <div className={styles.frame}>
        <nav aria-label="Navegación principal" className={styles.navigation}>
          {navigation.map((item) => {
            const active =
              item.href === "/"
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={styles.navigationItem}
                href={item.href}
                key={item.href}
              >
                <span aria-hidden="true" className={styles.navigationIcon}>
                  <NavigationIcon icon={item.icon} />
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

function NavigationIcon({
  icon,
}: Readonly<{ icon: (typeof navigation)[number]["icon"] }>) {
  if (icon === "home")
    return (
      <svg viewBox="0 0 24 24">
        <path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4Z" />
      </svg>
    );
  if (icon === "play")
    return (
      <svg viewBox="0 0 24 24">
        <path d="M6 5h12v14H6zM9 8l7 4-7 4z" />
      </svg>
    );
  if (icon === "groups")
    return (
      <svg viewBox="0 0 24 24">
        <circle cx="8" cy="9" r="3" />
        <circle cx="17" cy="10" r="2.5" />
        <path d="M2.5 20c0-4 2-6 5.5-6s5.5 2 5.5 6M13 20c.2-3 1.7-4.5 4.5-4.5S22 17 22 20" />
      </svg>
    );
  if (icon === "rankings")
    return (
      <svg viewBox="0 0 24 24">
        <path d="M5 20V11h4v9M10 20V5h4v15M15 20v-7h4v7" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4 4" />
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

function LogoutIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M10 5H5v14h5" />
      <path d="M13 8l4 4-4 4M8 12h9" />
    </svg>
  );
}
