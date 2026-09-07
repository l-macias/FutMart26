"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { queryPolicy } from "@/lib/api/query-policy";
import {
  formatNotificationTimestamp,
  type NotificationItem,
} from "./notification-copy";
import { refreshNotificationState } from "./notification-state";

import styles from "./notification-dropdown.module.css";

export function NotificationDropdown({ unreadCount }: { unreadCount: number }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const preview = useQuery({
    ...queryPolicy.volatile,
    queryKey: queryKeys.notificationPreview,
    queryFn: () => api.notifications(undefined, 5),
    enabled: open,
  });
  const markOne = useMutation({
    mutationFn: (item: NotificationItem) => api.markNotificationRead(item.id),
    onSuccess: async (_, item) => {
      await refreshNotificationState(queryClient);
      setOpen(false);
      router.push(item.target.href);
    },
  });
  const markAll = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => refreshNotificationState(queryClient),
  });

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function openItem(item: NotificationItem) {
    if (item.readAt) {
      setOpen(false);
      router.push(item.target.href);
      return;
    }
    markOne.mutate(item);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        aria-controls="notification-preview"
        aria-expanded={open}
        aria-label={
          unreadCount > 0
            ? `Notificaciones, ${unreadCount} sin leer`
            : "Notificaciones"
        }
        className={`${styles.trigger} ui-icon-button`}
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
        type="button"
      >
        <NotificationIcon />
        {unreadCount > 0 ? (
          <span aria-hidden="true" className={styles.unreadBadge}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          aria-label="Notificaciones recientes"
          className={styles.popover}
          id="notification-preview"
        >
          <div className={styles.header}>
            <Text as="h2" variant="heading-md">
              Notificaciones
            </Text>
            {unreadCount > 0 ? (
              <button
                className={styles.textAction}
                disabled={markAll.isPending}
                onClick={() => markAll.mutate()}
                type="button"
              >
                {markAll.isPending ? "Marcando…" : "Marcar todas como leídas"}
              </button>
            ) : null}
          </div>

          {preview.isPending ? <p role="status">Cargando…</p> : null}
          {preview.isError ? (
            <p className={styles.error} role="alert">
              No pudimos cargar las notificaciones.
            </p>
          ) : null}
          {preview.data?.items.length === 0 ? (
            <Text tone="muted">No tenés notificaciones.</Text>
          ) : null}
          {preview.data?.items.length ? (
            <ol className={styles.list}>
              {preview.data.items.map((item) => (
                <li
                  className={item.readAt ? styles.read : styles.unread}
                  key={item.id}
                >
                  <button
                    aria-label={`${item.title}. Abrir`}
                    disabled={markOne.isPending}
                    onClick={() => openItem(item)}
                    type="button"
                  >
                    <span aria-hidden="true" className={styles.statusMark} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.body}</small>
                      <time dateTime={item.createdAt}>
                        {formatNotificationTimestamp(item.createdAt)}
                      </time>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
          {markOne.isError || markAll.isError ? (
            <p className={styles.error} role="alert">
              No pudimos actualizar tus notificaciones.
            </p>
          ) : null}
          <Link
            className={styles.allLink}
            href="/notifications"
            onClick={() => setOpen(false)}
          >
            Ver todas
          </Link>
        </section>
      ) : null}
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
