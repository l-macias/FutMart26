"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

import type { NotificationListResponse } from "@football/contracts";
import { TacticalDivider } from "@football/football-ui";
import { Button, Surface, Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { queryPolicy } from "@/lib/api/query-policy";

import styles from "./notifications.module.css";

type NotificationItem = NotificationListResponse["items"][number];

export function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inbox = useInfiniteQuery({
    ...queryPolicy.volatile,
    queryKey: queryKeys.notifications,
    queryFn: ({ pageParam }) => api.notifications(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const markRead = useMutation({
    mutationFn: ({ id }: { id: string; href: string }) =>
      api.markNotificationRead(id),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.notificationUnreadCount,
        }),
      ]);
      router.push(variables.href);
    },
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
        <Text as="span" tone="accent" variant="label">
          Bandeja del jugador
        </Text>
        <Text as="h1" variant="display-lg">
          Notificaciones
        </Text>
        <Text tone="muted">
          Votaciones, progreso y cambios importantes de tus partidos.
        </Text>
      </header>
      <TacticalDivider />

      {items.length === 0 ? (
        <Surface className={styles.emptyState}>
          <span aria-hidden="true" className={styles.emptyMark}>
            F5
          </span>
          <Text as="h2" variant="heading-lg">
            Todo al día
          </Text>
          <Text tone="muted">
            Cuando haya una votación, un progreso o un partido cancelado lo vas
            a encontrar acá.
          </Text>
          <Link className="ui-button ui-button--primary" href="/play">
            Ir a jugar
          </Link>
        </Surface>
      ) : (
        <section className={styles.inbox}>
          <ol className={styles.notificationList}>
            {items.map((item) => (
              <li key={item.id}>
                <Surface
                  className={`${styles.notification} ${item.readAt ? styles.read : styles.unread}`}
                >
                  <span aria-hidden="true" className={styles.eventMark} />
                  <div>
                    <Text as="span" tone="muted" variant="metadata">
                      {eventLabel(item.type)} ·{" "}
                      {formatTimestamp(item.createdAt)}
                    </Text>
                    <Text as="h2" variant="heading-md">
                      {item.title}
                    </Text>
                    <Text tone="muted">{item.body}</Text>
                    <Link
                      aria-label={`${item.title}. Abrir destino`}
                      className={styles.notificationLink}
                      href={item.target.href}
                      onClick={(event) => openNotification(event, item)}
                    >
                      {markRead.isPending && markRead.variables?.id === item.id
                        ? "Abriendo…"
                        : "Ver detalle"}
                    </Link>
                  </div>
                </Surface>
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
          {markRead.isError ? (
            <p className={styles.error} role="alert">
              No pudimos marcar la notificación como leída.
            </p>
          ) : null}
        </section>
      )}
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

function eventLabel(type: NotificationItem["type"]) {
  return {
    VOTING_AVAILABLE: "Votación",
    PROGRESSION_AVAILABLE: "Progresión",
    MATCH_CANCELLED: "Partido",
    ACHIEVEMENT_EARNED: "Logro",
    AWARD_EARNED: "Premio",
    CONNECTION_REQUESTED: "Conexión",
    CONNECTION_ACCEPTED: "Conexión",
    GROUP_INVITATION_RECEIVED: "Invitación",
    MATCH_INVITATION_RECEIVED: "Invitación",
  }[type];
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
