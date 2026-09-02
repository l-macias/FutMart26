"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";

import type { TerritorialRankingResponse } from "@football/contracts";
import { Button, Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "../group-ranking/group-ranking.module.css";

type RankingItem = TerritorialRankingResponse["items"][number];
type Props =
  | { type: "VENUE"; scopeId: string }
  | { type: "CITY"; scopeId: string }
  | { type: "PROVINCE"; scopeId: string }
  | { type: "COUNTRY"; scopeId: string };

export function TerritorialRankingScreen(props: Readonly<Props>) {
  const ranking = useInfiniteQuery({
    queryKey: rankingQueryKey(props),
    queryFn: ({ pageParam }) => loadRanking(props, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  if (ranking.isPending)
    return <State text="Armando el ranking territorial…" />;
  if (ranking.isError)
    return <State alert text="No pudimos cargar este ranking F5." />;

  const first = ranking.data.pages[0]!;
  const items = uniqueItems(ranking.data.pages.flatMap((page) => page.items));
  const scopeLabel = scopeLabels[first.scope.type];

  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/play">
        ← PARTIDOS
      </Link>
      <header className={styles.hero}>
        <div>
          <Text as="span" tone="accent" variant="label">
            RANKING DE {scopeLabel} · F5
          </Text>
          <Text as="h1" variant="display-lg">
            {first.scope.name}
          </Text>
          <Text tone="muted">
            OVR F5 actual de quienes jugaron al menos un partido en este ámbito.
          </Text>
        </div>
        {first.me.ranked ? (
          <div className={styles.myRank}>
            <span>Tu posición</span>
            <strong>#{first.me.position}</strong>
            <small>
              {formatOvr(first.me.overall)} OVR ·{" "}
              {first.me.scopeStats.matchesPlayed} en {scopeLabel.toLowerCase()}
            </small>
          </div>
        ) : (
          <div className={styles.myRank}>
            <span>Tu posición</span>
            <strong>—</strong>
            <small>Jugá acá para ingresar al ranking</small>
          </div>
        )}
      </header>

      {first.scope.type === "VENUE" && (
        <Link
          className={styles.back}
          href={`/rankings/cities/${first.scope.cityKey}`}
        >
          VER RANKING DE {first.scope.city.toLocaleUpperCase("es-AR")} →
        </Link>
      )}
      <ParentRankingLinks scope={first.scope} />

      {items.length === 0 ? (
        <section className={styles.empty}>
          <Text as="h2" variant="heading-lg">
            Todavía no hay jugadores rankeados
          </Text>
          <Text tone="muted">
            El ranking aparecerá con el primer partido procesado.
          </Text>
        </section>
      ) : (
        <ol
          className={styles.list}
          aria-label={`Ranking F5 de ${first.scope.name}`}
        >
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

const scopeLabels = {
  VENUE: "SEDE",
  CITY: "CIUDAD",
  PROVINCE: "PROVINCIA",
  COUNTRY: "PAÍS",
} as const;

function rankingQueryKey(props: Props) {
  switch (props.type) {
    case "VENUE":
      return queryKeys.venueRanking(props.scopeId);
    case "CITY":
      return queryKeys.cityRanking(props.scopeId);
    case "PROVINCE":
      return queryKeys.provinceRanking(props.scopeId);
    case "COUNTRY":
      return queryKeys.countryRanking(props.scopeId);
  }
}

function loadRanking(props: Props, cursor?: string) {
  switch (props.type) {
    case "VENUE":
      return api.venueRanking(props.scopeId, cursor);
    case "CITY":
      return api.cityRanking(props.scopeId, cursor);
    case "PROVINCE":
      return api.provinceRanking(props.scopeId, cursor);
    case "COUNTRY":
      return api.countryRanking(props.scopeId, cursor);
  }
}

function ParentRankingLinks({
  scope,
}: Readonly<{ scope: TerritorialRankingResponse["scope"] }>) {
  const province =
    scope.type === "VENUE" || scope.type === "CITY" ? scope.province : null;
  const country = scope.type === "COUNTRY" ? null : scope.country;
  if (!province && !country) return null;
  return (
    <nav aria-label="Rankings territoriales relacionados">
      {province && (
        <Link
          className={styles.back}
          href={`/rankings/provinces/${province.key}`}
        >
          RANKING DE {province.name.toLocaleUpperCase("es-AR")} →
        </Link>
      )}
      {country && (
        <Link
          className={styles.back}
          href={`/rankings/countries/${country.key}`}
        >
          RANKING DE {country.name.toLocaleUpperCase("es-AR")} →
        </Link>
      )}
    </nav>
  );
}

function RankingRow({ item }: Readonly<{ item: RankingItem }>) {
  const content = (
    <>
      <span className={styles.position}>{item.position}</span>
      <span className={styles.identity}>
        <strong>{item.player.displayName}</strong>
        <small>
          {item.scopeStats.matchesPlayed}{" "}
          {item.scopeStats.matchesPlayed === 1 ? "partido" : "partidos"} aquí ·{" "}
          {item.performance.processedMatchCount} F5 globales
        </small>
      </span>
      <span className={styles.form}>
        {new Date(item.scopeStats.lastPlayedAt).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "short",
        })}
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
