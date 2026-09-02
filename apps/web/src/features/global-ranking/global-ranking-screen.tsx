"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";

import type { GlobalRankingResponse } from "@football/contracts";
import { Button, Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "../group-ranking/group-ranking.module.css";

type RankingItem = GlobalRankingResponse["items"][number];

export function GlobalRankingScreen() {
  const ranking = useInfiniteQuery({
    queryKey: queryKeys.globalRanking,
    queryFn: ({ pageParam }) => api.globalRanking(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  if (ranking.isPending) return <State text="Armando el ranking global F5…" />;
  if (ranking.isError)
    return <State alert text="No pudimos cargar el ranking global." />;

  const first = ranking.data.pages[0]!;
  const items = [
    ...new Map(
      ranking.data.pages
        .flatMap((page) => page.items)
        .map((item) => [item.player.id, item]),
    ).values(),
  ];
  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/players">
        ← JUGADORES
      </Link>
      <header className={styles.hero}>
        <div>
          <Text as="span" tone="accent" variant="label">
            RANKING GLOBAL · F5
          </Text>
          <Text as="h1" variant="display-lg">
            La tabla
          </Text>
          <Text tone="muted">
            OVR F5 actual de todos los jugadores con partidos procesados.
          </Text>
        </div>
        <div className={styles.myRank}>
          <span>Tu posición</span>
          <strong>{first.me.ranked ? `#${first.me.position}` : "—"}</strong>
          <small>
            {first.me.ranked
              ? `${Math.round(Number(first.me.overall))} OVR`
              : "Procesá tu primer partido para ingresar"}
          </small>
        </div>
      </header>
      <ol className={styles.list} aria-label="Ranking global F5">
        {items.map((item) => (
          <Row item={item} key={item.player.id} />
        ))}
      </ol>
      {ranking.hasNextPage && (
        <Button
          disabled={ranking.isFetchingNextPage}
          onClick={() => void ranking.fetchNextPage()}
          variant="secondary"
        >
          {ranking.isFetchingNextPage ? "Cargando…" : "Cargar más"}
        </Button>
      )}
    </div>
  );
}

function Row({ item }: Readonly<{ item: RankingItem }>) {
  return (
    <li
      className={`${styles.row} ${item.position <= 3 ? styles.podium : ""} ${item.isCurrentPlayer ? styles.current : ""}`}
    >
      <Link
        className={styles.rowLink}
        href={item.isCurrentPlayer ? "/profile" : `/players/${item.player.id}`}
      >
        <span className={styles.position}>{item.position}</span>
        <span className={styles.identity}>
          <strong>{item.player.displayName}</strong>
          <small>{item.performance.processedMatchCount} partidos</small>
        </span>
        <span className={styles.form}>F5</span>
        <strong className={styles.ovr}>
          {Math.round(Number(item.performance.overall))}
        </strong>
      </Link>
    </li>
  );
}

function State({
  text,
  alert = false,
}: Readonly<{ text: string; alert?: boolean }>) {
  return (
    <div className={styles.state}>
      <p role={alert ? "alert" : "status"}>{text}</p>
    </div>
  );
}
