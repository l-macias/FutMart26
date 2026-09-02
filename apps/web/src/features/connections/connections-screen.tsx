"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";

import { Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "./connections.module.css";

type Direction = "incoming" | "outgoing";

export function ConnectionsScreen() {
  const connections = useInfiniteQuery({
    queryKey: queryKeys.connections,
    queryFn: ({ pageParam }) => api.connections(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const incoming = useConnectionRequests("incoming");
  const outgoing = useConnectionRequests("outgoing");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Text as="span" tone="accent" variant="label">
          RED DE JUEGO
        </Text>
        <Text as="h1" variant="display-lg">
          Conexiones
        </Text>
        <Text tone="muted">
          Jugadores con los que elegiste mantener contacto deportivo.
        </Text>
      </header>
      <RequestSection
        direction="incoming"
        query={incoming}
        title="Solicitudes recibidas"
      />
      <RequestSection
        direction="outgoing"
        query={outgoing}
        title="Solicitudes enviadas"
      />
      <section className={styles.section}>
        <Text as="h2" variant="heading-lg">
          Mis conexiones
        </Text>
        {connections.isPending && (
          <Text tone="muted">Cargando conexiones…</Text>
        )}
        {connections.isError && (
          <Text tone="muted">No pudimos cargar tus conexiones.</Text>
        )}
        <ul className={styles.list}>
          {connections.data?.pages
            .flatMap((page) => page.items)
            .map((item) => (
              <li key={item.player.id}>
                <Link href={`/players/${item.player.id}`}>
                  <strong>{item.player.displayName}</strong>
                  <span>
                    {item.overall === null
                      ? "OVR —"
                      : `OVR ${Math.round(item.overall)}`}{" "}
                    · {item.processedMatchCount} partidos
                  </span>
                </Link>
              </li>
            ))}
        </ul>
        {connections.data?.pages[0]?.items.length === 0 && (
          <Text tone="muted">Todavía no tenés conexiones.</Text>
        )}
        {connections.hasNextPage && (
          <button
            className="ui-button ui-button--secondary"
            onClick={() => void connections.fetchNextPage()}
            type="button"
          >
            Cargar más
          </button>
        )}
      </section>
    </main>
  );
}

function useConnectionRequests(direction: Direction) {
  return useInfiniteQuery({
    queryKey: queryKeys.connectionRequests(direction),
    queryFn: ({ pageParam }) => api.connectionRequests(direction, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

function RequestSection({
  direction,
  query,
  title,
}: Readonly<{
  direction: Direction;
  query: ReturnType<typeof useConnectionRequests>;
  title: string;
}>) {
  const queryClient = useQueryClient();
  const action = useMutation({
    mutationFn: ({
      playerId,
      action,
    }: {
      playerId: string;
      action: "accept" | "reject" | "cancel";
    }) =>
      action === "accept"
        ? api.acceptConnection(playerId)
        : action === "reject"
          ? api.rejectConnection(playerId)
          : api.cancelConnection(playerId),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.connections }),
        queryClient.invalidateQueries({
          queryKey: ["me", "connections", "requests"],
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.connectionStatus(variables.playerId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.notificationUnreadCount,
        }),
      ]);
    },
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className={styles.section}>
      <Text as="h2" variant="heading-lg">
        {title}
      </Text>
      {query.isPending && <Text tone="muted">Cargando…</Text>}
      {query.isError && (
        <Text tone="muted">No pudimos cargar las solicitudes.</Text>
      )}
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.player.id}>
            <div>
              <Link href={`/players/${item.player.id}`}>
                <strong>{item.player.displayName}</strong>
              </Link>
              <span>
                {new Date(item.requestedAt).toLocaleDateString("es-AR")}
              </span>
            </div>
            <div className={styles.actions}>
              {direction === "incoming" ? (
                <>
                  <button
                    className="ui-button ui-button--primary"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        playerId: item.player.id,
                        action: "accept",
                      })
                    }
                    type="button"
                  >
                    Aceptar
                  </button>
                  <button
                    className="ui-button ui-button--secondary"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        playerId: item.player.id,
                        action: "reject",
                      })
                    }
                    type="button"
                  >
                    Rechazar
                  </button>
                </>
              ) : (
                <button
                  className="ui-button ui-button--secondary"
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate({
                      playerId: item.player.id,
                      action: "cancel",
                    })
                  }
                  type="button"
                >
                  Cancelar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 && !query.isPending && (
        <Text tone="muted">
          {direction === "incoming"
            ? "No tenés solicitudes pendientes."
            : "No tenés solicitudes enviadas."}
        </Text>
      )}
      {query.hasNextPage && (
        <button
          className="ui-button ui-button--secondary"
          onClick={() => void query.fetchNextPage()}
          type="button"
        >
          Cargar más
        </button>
      )}
    </section>
  );
}
