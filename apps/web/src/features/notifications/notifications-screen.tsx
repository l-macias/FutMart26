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

import { TacticalDivider } from "@football/football-ui";
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

  if (inbox.isPending) return <PageState title="Buscando novedades…" />;
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

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <Text as="span" tone="accent" variant="label">
            Tu historial
          </Text>
          <Text as="h1" variant="display-lg">
            Notificaciones
          </Text>
          <Text tone="muted">
            Todo lo que pasó y lo que todavía requiere tu atención.
          </Text>
        </div>
        {(unread.data?.count ?? 0) > 0 ? (
          <Button
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
            variant="quiet"
          >
            {markAll.isPending ? "Marcando…" : "Marcar todas como leídas"}
          </Button>
        ) : null}
      </header>
      <TacticalDivider />

      <div className={styles.toolbar}>
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
        <div className={styles.emptyState}>
          <Text as="h2" variant="heading-lg">
            {unreadOnly
              ? "No tenés notificaciones sin leer"
              : "No tenés notificaciones"}
          </Text>
          <Text tone="muted">
            {unreadOnly
              ? "Todo está al día. Las notificaciones informativas siguen disponibles en Todas."
              : "Cuando haya novedades importantes las vas a encontrar acá."}
          </Text>
        </div>
      ) : (
        <section className={styles.inbox}>
          <ol className={`${styles.notificationList} ui-list`}>
            {items.map((item) => (
              <li
                className={item.readAt ? styles.read : styles.unread}
                key={item.id}
              >
                <Link
                  aria-label={`${item.title}. Abrir destino`}
                  className={`${styles.notificationRow} ui-row`}
                  href={item.target.href}
                  onClick={(event) => openNotification(event, item)}
                >
                  <span aria-hidden="true" className={styles.eventMark} />
                  <span className={styles.notificationContent}>
                    <Text as="span" tone="muted" variant="metadata">
                      {notificationEventLabel(item.type)} ·{" "}
                      <time dateTime={item.createdAt}>
                        {formatNotificationTimestamp(item.createdAt)}
                      </time>
                    </Text>
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
                      : "→"}
                  </span>
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
              {inbox.isFetchingNextPage ? "Cargando…" : "Cargar más"}
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

function PageState({
  alert,
  title,
}: Readonly<{ alert?: boolean; title: string }>) {
  return (
    <div className={styles.page}>
      <Text as="h1" role={alert ? "alert" : "status"} variant="heading-lg">
        {title}
      </Text>
    </div>
  );
}
