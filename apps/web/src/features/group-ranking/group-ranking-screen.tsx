"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";

import type { GroupRankingResponse } from "@football/contracts";
import { Button, Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "./group-ranking.module.css";

type RankingItem = GroupRankingResponse["items"][number];

export function GroupRankingScreen({ groupId }: Readonly<{ groupId: string }>) {
  const ranking = useInfiniteQuery({
    queryKey: queryKeys.groupRanking(groupId),
    queryFn: ({ pageParam }) =>
      api.groupRanking(groupId, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  if (ranking.isPending) return <State text="Armando la tabla F5…" />;
  if (ranking.isError)
    return <State alert text="No pudimos cargar el ranking del grupo." />;

  const first = ranking.data.pages[0]!;
  const items = uniqueItems(ranking.data.pages.flatMap((page) => page.items));

  return (
    <div className={styles.page}>
      <Link className={styles.back} href={`/groups/${groupId}`}>
        ← {first.group.name}
      </Link>
      <header className={styles.hero}>
        <div>
          <Text as="span" tone="accent" variant="label">
            RANKING DEL GRUPO · F5
          </Text>
          <Text as="h1" variant="display-lg">
            La tabla
          </Text>
          <Text tone="muted">
            Rendimiento F5 actual de quienes ya procesaron al menos un partido.
          </Text>
        </div>
        {first.me.ranked ? (
          <div className={styles.myRank}>
            <span>Tu posición</span>
            <strong>#{first.me.position}</strong>
            <small>{formatOvr(first.me.overall)} OVR</small>
          </div>
        ) : (
          <div className={styles.myRank}>
            <span>Tu posición</span>
            <strong>—</strong>
            <small>Jugá tu primer partido para entrar al ranking</small>
          </div>
        )}
      </header>

      {items.length === 0 ? (
        <section className={styles.empty}>
          <Text as="h2" variant="heading-lg">
            La competencia todavía no empezó
          </Text>
          <Text tone="muted">
            El ranking aparecerá cuando un miembro procese su primer partido.
          </Text>
        </section>
      ) : (
        <ol className={styles.list} aria-label="Ranking F5">
          {items.map((item) => (
            <RankingRow item={item} key={item.player.id} />
          ))}
        </ol>
      )}

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

function RankingRow({ item }: Readonly<{ item: RankingItem }>) {
  const delta = item.recent ? Number(item.recent.ovrDelta) : null;
  const content = (
    <>
      <span className={styles.position}>{item.position}</span>
      <span className={styles.identity}>
        <strong>{item.player.displayName}</strong>
        <small>{item.performance.processedMatchCount} partidos</small>
      </span>
      <span className={styles.form}>
        {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`}
        <small>último</small>
      </span>
      <strong className={styles.ovr}>
        {formatOvr(item.performance.overall)}
      </strong>
    </>
  );
  return (
    <li
      className={`${styles.row} ${item.position <= 3 ? styles.podium : ""} ${item.isCurrentPlayer ? styles.current : ""}`}
    >
      {item.isCurrentPlayer ? (
        <Link
          aria-label="Ver mi perfil"
          className={styles.rowLink}
          href="/profile"
        >
          {content}
        </Link>
      ) : (
        <Link
          aria-label={`Ver ficha de ${item.player.displayName}`}
          className={styles.rowLink}
          href={`/players/${item.player.id}`}
        >
          {content}
        </Link>
      )}
    </li>
  );
}

function formatOvr(value: string) {
  return Math.round(Number(value));
}

function uniqueItems(items: RankingItem[]) {
  return [...new Map(items.map((item) => [item.player.id, item])).values()];
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
