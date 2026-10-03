"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";

import { Button, Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { queryPolicy } from "@/lib/api/query-policy";
import {
  formatNotificationTimestamp,
  notificationEventLabel,
  type NotificationItem,
} from "./notification-copy";
import { refreshNotificationState } from "./notification-state";
import {
  NotificationVisual,
  notificationVisualKind,
} from "./notification-visual";

import styles from "./notifications.module.css";

export function NotificationsScreen() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const unread = useQuery({
    ...queryPolicy.volatile,
    queryKey: queryKeys.notificationUnreadCount,
    queryFn: api.notificationUnreadCount,
  });
  const inbox = useInfiniteQuery({
    ...queryPolicy.volatile,
    queryKey: queryKeys.notificationInbox(unreadOnly),
    queryFn: ({ pageParam }) =>
      api.notifications(pageParam ?? undefined, 20, unreadOnly),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const markRead = useMutation({
    mutationFn: ({ id }: { id: string; href: string }) =>
      api.markNotificationRead(id),
    onSuccess: async (_, variables) => {
      await refreshNotificationState(queryClient);
      router.push(variables.href);
    },
  });
  const markAll = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => refreshNotificationState(queryClient),
  });

  if (inbox.isPending) return <PageState title="Preparando tu actividad…" />;
  if (inbox.isError)
    return <PageState alert title="No pudimos cargar tus notificaciones." />;

  const items = [
    ...new Map(
      inbox.data.pages
        .flatMap((page) => page.items)
        .map((item) => [item.id, item]),
    ).values(),
  ];

  function openNotification(
    event: MouseEvent<HTMLAnchorElement>,
    item: NotificationItem,
  ) {
    if (item.readAt) return;
    event.preventDefault();
    markRead.mutate({ id: item.id, href: item.target.href });
  }

  const unreadCount = unread.data?.count ?? 0;

  return (
    <div className={`${styles.page} ui-visual-v4`}>
      <header className={styles.activityHeader}>
        <img
          alt=""
          className={styles.headerScene}
          src="/fifar-v4/backgrounds-raster/night-pitch.webp"
        />
        <div className={styles.headerCopy}>
          <Text as="span" tone="accent" variant="label">
            ACTIVIDAD FIFAR
          </Text>
          <Text as="h1" variant="display-lg">
            Notificaciones
          </Text>
          <Text tone="muted">
            Partidos, grupos, conexiones y reconocimientos.
          </Text>
        </div>
        <div className={styles.unreadSummary} data-empty={unreadCount === 0}>
          <strong>{String(unreadCount).padStart(2, "0")}</strong>
          <span>{unreadCount === 1 ? "PENDIENTE" : "PENDIENTES"}</span>
        </div>
        {unreadCount > 0 ? (
          <Button
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
            variant="quiet"
          >
            {markAll.isPending ? "MARCANDO…" : "MARCAR TODO COMO LEÍDO"}
          </Button>
        ) : null}
      </header>

      <div className={styles.activityToolbar}>
        <div className={styles.toolbarCopy}>
          <Text tone="accent" variant="label">
            TU ACTIVIDAD
          </Text>
          <Text as="h2" variant="heading-lg">
            Últimos movimientos
          </Text>
        </div>
        <div
          aria-label="Filtrar notificaciones"
          className={styles.filters}
          role="group"
        >
          <button
            aria-pressed={!unreadOnly}
            onClick={() => setUnreadOnly(false)}
            type="button"
          >
            Todas
          </button>
          <button
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly(true)}
            type="button"
          >
            No leídas
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <NotificationEmpty unreadOnly={unreadOnly} />
      ) : (
        <section className={styles.inbox} aria-label="Historial de actividad">
          <ol className={styles.notificationList}>
            {items.map((item) => (
              <li
                className={item.readAt ? styles.read : styles.unread}
                data-kind={notificationVisualKind(item.type)}
                key={item.id}
              >
                <Link
                  aria-label={`${item.title}. Abrir destino`}
                  className={styles.notificationRow}
                  href={item.target.href}
                  onClick={(event) => openNotification(event, item)}
                >
                  <NotificationVisual item={item} />
                  <span className={styles.notificationContent}>
                    <span className={styles.notificationMeta}>
                      <strong>{notificationEventLabel(item.type)}</strong>
                      <time dateTime={item.createdAt}>
                        {formatNotificationTimestamp(item.createdAt)}
                      </time>
                    </span>
                    <Text as="span" variant="heading-md">
                      {item.title}
                    </Text>
                    <Text as="span" tone="muted">
                      {item.body}
                    </Text>
                  </span>
                  <span aria-hidden="true" className={styles.rowAction}>
                    {markRead.isPending && markRead.variables?.id === item.id
                      ? "…"
                      : "›"}
                  </span>
                  {!item.readAt ? (
                    <span className={styles.unreadLabel}>NUEVA</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ol>
          {inbox.hasNextPage ? (
            <Button
              disabled={inbox.isFetchingNextPage}
              onClick={() => void inbox.fetchNextPage()}
              variant="secondary"
            >
              {inbox.isFetchingNextPage ? "CARGANDO…" : "CARGAR MÁS ACTIVIDAD"}
            </Button>
          ) : null}
          {inbox.isFetchNextPageError ? (
            <p className={styles.error} role="alert">
              No pudimos cargar más notificaciones.
            </p>
          ) : null}
        </section>
      )}
      {markRead.isError || markAll.isError ? (
        <p className={styles.error} role="alert">
          No pudimos actualizar tus notificaciones. Intentá nuevamente.
        </p>
      ) : null}
    </div>
  );
}

function NotificationEmpty({ unreadOnly }: Readonly<{ unreadOnly: boolean }>) {
  return (
    <section className={styles.emptyState}>
      <span aria-hidden="true" className={styles.emptyScene} />
      <span aria-hidden="true" className={styles.emptyBall}>
        F5
      </span>
      <div>
        <Text tone="accent" variant="label">
          TODO AL DÍA
        </Text>
        <Text as="h2" variant="display-lg">
          {unreadOnly ? "Sin pendientes" : "Todavía no pasó nada"}
        </Text>
        <Text tone="muted">
          {unreadOnly
            ? "Las notificaciones informativas siguen disponibles en Todas."
            : "Cuando haya actividad deportiva importante va a aparecer acá."}
        </Text>
      </div>
    </section>
  );
}

function PageState({
  alert,
  title,
}: Readonly<{ alert?: boolean; title: string }>) {
  return (
    <div className={`${styles.page} ui-visual-v4`}>
      <section className={styles.pageState}>
        <span aria-hidden="true">F5</span>
        <Text as="h1" role={alert ? "alert" : "status"} variant="heading-lg">
          {title}
        </Text>
      </section>
    </div>
  );
}
