"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type {
  GlobalRankingResponse,
  GroupRankingResponse,
  RankingContextsResponse,
  TerritorialRankingResponse,
} from "@football/contracts";
import { Button, Text } from "@football/ui";

import {
  V4Portrait,
  V4RewardBadge,
  V4TierPlate,
} from "@/components/visual-v4/profile-assets";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import { rankingHref, type RankingScope } from "./rankings-navigation";
import styles from "./rankings.module.css";

type Props = {
  scope: RankingScope;
  groupId?: string;
  cityKey?: string;
  venueId?: string;
};
type RankingItem = GlobalRankingResponse["items"][number];
type RankingPage = {
  items: RankingItem[];
  me: GlobalRankingResponse["me"];
  nextCursor: string | null;
};

const scopeLabels: Record<RankingScope, string> = {
  global: "GLOBAL",
  group: "GRUPO",
  city: "CIUDAD",
  venue: "SEDE",
};

export function RankingsScreen(props: Readonly<Props>) {
  const router = useRouter();
  const contexts = useQuery({
    queryKey: queryKeys.rankingContexts,
    queryFn: api.rankingContexts,
  });
  const selected = selectContext(props, contexts.data);

  function selectScope(scope: RankingScope) {
    router.push(rankingHref(scope, defaultContext(scope, contexts.data)));
  }

  return (
    <div className={`${styles.page} ui-visual-v4`}>
      <header className={styles.header}>
        <img
          alt=""
          className={styles.competitionScene}
          src="/fifar-v4/group-ranking-scenes/rankings-arena-night.webp"
        />
        <V4RewardBadge label="Competencia F5" seed="rankings-f5" size="large" />
        <div className={styles.headerIdentity}>
          <Text tone="accent" variant="label">
            COMPETENCIA F5
          </Text>
          <Text as="h1" variant="display-lg">
            Rankings
          </Text>
          <span>MEDÍ TU NIVEL. ENCONTRÁ TU LUGAR.</span>
        </div>
        <strong className={styles.competitionMark}>F5</strong>
      </header>

      <nav aria-label="Ámbito del ranking" className={styles.scopes}>
        {(Object.keys(scopeLabels) as RankingScope[]).map((scope) => (
          <button
            aria-current={props.scope === scope ? "page" : undefined}
            className={styles.scopeButton}
            key={scope}
            onClick={() => selectScope(scope)}
            type="button"
          >
            {scopeLabels[scope]}
          </button>
        ))}
      </nav>

      {props.scope !== "global" && (
        <ContextSelector
          contexts={contexts}
          onChange={(value) => {
            if (props.scope === "group")
              router.push(rankingHref("group", { groupId: value }));
            if (props.scope === "city")
              router.push(rankingHref("city", { cityKey: value }));
            if (props.scope === "venue")
              router.push(rankingHref("venue", { venueId: value }));
          }}
          scope={props.scope}
          value={selected?.id}
        />
      )}

      {props.scope === "global" ? (
        <GlobalRanking />
      ) : contexts.isPending ? (
        <State text="Buscando tus contextos competitivos…" />
      ) : contexts.isError ? (
        <State alert text="No pudimos cargar los ámbitos disponibles." />
      ) : !selected ? (
        <ScopeEmpty scope={props.scope} />
      ) : props.scope === "group" ? (
        <GroupRanking groupId={selected.id} />
      ) : props.scope === "city" ? (
        <CityRanking cityKey={selected.id} />
      ) : (
        <VenueRanking venueId={selected.id} />
      )}
    </div>
  );
}

function ContextSelector({
  contexts,
  onChange,
  scope,
  value,
}: Readonly<{
  contexts: ReturnType<typeof useQuery<RankingContextsResponse>>;
  onChange: (value: string) => void;
  scope: Exclude<RankingScope, "global">;
  value?: string;
}>) {
  if (!contexts.data) return null;
  const options = contextOptions(scope, contexts.data);
  if (options.length === 0) return null;
  return (
    <label className={styles.context}>
      <span>{scopeLabels[scope]}</span>
      <select
        aria-label={`Seleccionar ${scopeLabels[scope].toLocaleLowerCase("es-AR")}`}
        onChange={(event) => onChange(event.target.value)}
        value={value ?? options[0]!.id}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function GlobalRanking() {
  const query = useInfiniteQuery({
    queryKey: queryKeys.globalRanking,
    queryFn: ({ pageParam }) => api.globalRanking(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  return (
    <RankingResult query={query} empty="Todavía no hay jugadores rankeados." />
  );
}

function GroupRanking({ groupId }: Readonly<{ groupId: string }>) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.groupRanking(groupId),
    queryFn: ({ pageParam }) =>
      api.groupRanking(groupId, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    select: (data) => ({
      ...data,
      pages: data.pages.map(adaptGroupPage),
    }),
  });
  return (
    <RankingResult
      query={query}
      empty="No pertenecés a ningún grupo con ranking disponible."
    />
  );
}

function CityRanking({ cityKey }: Readonly<{ cityKey: string }>) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.cityRanking(cityKey),
    queryFn: ({ pageParam }) =>
      api.cityRanking(cityKey, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    select: (data) => ({
      ...data,
      pages: data.pages.map(adaptTerritorialPage),
    }),
  });
  return (
    <RankingResult
      query={query}
      empty="No hay suficiente actividad registrada en esta ciudad."
    />
  );
}

function VenueRanking({ venueId }: Readonly<{ venueId: string }>) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.venueRanking(venueId),
    queryFn: ({ pageParam }) =>
      api.venueRanking(venueId, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    select: (data) => ({
      ...data,
      pages: data.pages.map(adaptTerritorialPage),
    }),
  });
  return (
    <RankingResult
      query={query}
      empty="Todavía no hay ranking disponible para esta sede."
    />
  );
}

type RankingQuery = ReturnType<typeof useInfiniteQuery<RankingPage>>;

function RankingResult({
  query,
  empty,
}: Readonly<{ query: RankingQuery; empty: string }>) {
  if (query.isPending) return <State text="Armando el ranking F5…" />;
  if (query.isError)
    return <State alert text="No pudimos cargar este ranking." />;
  const first = query.data.pages[0]!;
  const items = [
    ...new Map(
      query.data.pages
        .flatMap((page) => page.items)
        .map((item) => [item.player.id, item]),
    ).values(),
  ];
  const topPlayers = items.slice(0, 3);
  const rankedPlayers = items.slice(3);
  return (
    <div className={styles.rankingExperience}>
      {topPlayers.length > 0 && (
        <section className={styles.topZone} aria-labelledby="top-zone-title">
          <div className={styles.topZoneHeading}>
            <div>
              <span>FIGURAS DEL ÁMBITO</span>
              <Text as="h2" id="top-zone-title" variant="heading-lg">
                Top 3
              </Text>
            </div>
            <strong>OVR · F5</strong>
          </div>
          <div className={styles.topGrid}>
            {topPlayers.map((item) => (
              <RankingTopPlayer item={item} key={item.player.id} />
            ))}
          </div>
        </section>
      )}
      <section className={styles.positionCard} aria-labelledby="my-rank-title">
        <V4Portrait name="Tu jugador" size="large" />
        <div className={styles.positionIdentity}>
          <span id="my-rank-title">TU POSICIÓN</span>
          {first.me.ranked ? (
            <>
              <strong>#{first.me.position}</strong>
              <small>VOS · CLASIFICACIÓN ACTUAL</small>
            </>
          ) : (
            <p>
              Aún no tenés evidencia suficiente para aparecer en este ranking.
            </p>
          )}
        </div>
        {first.me.ranked && <V4TierPlate overall={Number(first.me.overall)} />}
      </section>
      <section aria-labelledby="ranking-list-title" className={styles.ranking}>
        <div className={styles.listHeading}>
          <div>
            <span>CLASIFICACIÓN COMPLETA</span>
            <Text as="h2" id="ranking-list-title" variant="heading-lg">
              Competidores
            </Text>
          </div>
          <strong>POS · JUGADOR · OVR</strong>
        </div>
        {items.length === 0 ? (
          <p className={styles.empty}>{empty}</p>
        ) : rankedPlayers.length === 0 ? (
          <p className={styles.compactComplete}>Top 3 completo.</p>
        ) : (
          <ol className={styles.list}>
            {rankedPlayers.map((item) => (
              <li
                className={`${styles.row} ${item.isCurrentPlayer ? styles.current : ""}`}
                key={item.player.id}
              >
                <Link
                  aria-current={item.isCurrentPlayer ? "true" : undefined}
                  href={
                    item.isCurrentPlayer
                      ? "/profile"
                      : `/players/${item.player.id}`
                  }
                >
                  <span className={styles.rank}>#{item.position}</span>
                  <V4Portrait name={item.player.displayName} />
                  <span className={styles.playerIdentity}>
                    <strong>{item.player.displayName}</strong>
                    <small>
                      {item.isCurrentPlayer ? "VOS · JUGADOR F5" : "JUGADOR F5"}
                    </small>
                  </span>
                  <V4TierPlate
                    compact
                    overall={Number(item.performance.overall)}
                  />
                </Link>
              </li>
            ))}
          </ol>
        )}
        {query.hasNextPage && (
          <Button
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
            variant="secondary"
          >
            {query.isFetchingNextPage ? "Cargando…" : "Cargar más"}
          </Button>
        )}
      </section>
    </div>
  );
}

function RankingTopPlayer({ item }: Readonly<{ item: RankingItem }>) {
  return (
    <Link
      aria-current={item.isCurrentPlayer ? "true" : undefined}
      className={styles.topPlayer}
      data-rank={item.position}
      href={item.isCurrentPlayer ? "/profile" : `/players/${item.player.id}`}
    >
      <span className={styles.topRank}>#{item.position}</span>
      <div className={styles.topPortrait}>
        <V4Portrait name={item.player.displayName} size="large" />
      </div>
      <span className={styles.topIdentity}>
        <strong>{item.player.displayName}</strong>
        <small>{item.isCurrentPlayer ? "VOS · F5" : "COMPETIDOR F5"}</small>
      </span>
      <V4TierPlate overall={Number(item.performance.overall)} />
    </Link>
  );
}

function adaptGroupPage(page: GroupRankingResponse): RankingPage {
  return { items: page.items, me: page.me, nextCursor: page.nextCursor };
}

function adaptTerritorialPage(page: TerritorialRankingResponse): RankingPage {
  return { items: page.items, me: page.me, nextCursor: page.nextCursor };
}

function contextOptions(
  scope: Exclude<RankingScope, "global">,
  contexts: RankingContextsResponse,
) {
  if (scope === "group")
    return contexts.groups.map((group) => ({
      id: group.id,
      label: group.name,
    }));
  if (scope === "city")
    return contexts.cities.map((city) => ({ id: city.key, label: city.name }));
  return contexts.venues.map((venue) => ({
    id: venue.id,
    label: `${venue.name} · ${venue.city}`,
  }));
}

function selectContext(props: Props, contexts?: RankingContextsResponse) {
  if (!contexts || props.scope === "global") return undefined;
  const options = contextOptions(props.scope, contexts);
  const requested =
    props.scope === "group"
      ? props.groupId
      : props.scope === "city"
        ? props.cityKey
        : props.venueId;
  return options.find((option) => option.id === requested) ?? options[0];
}

function defaultContext(
  scope: RankingScope,
  contexts?: RankingContextsResponse,
) {
  if (!contexts || scope === "global") return undefined;
  if (scope === "group") return { groupId: contexts.groups[0]?.id };
  if (scope === "city") return { cityKey: contexts.cities[0]?.key };
  return { venueId: contexts.venues[0]?.id };
}

function ScopeEmpty({ scope }: Readonly<{ scope: RankingScope }>) {
  const messages: Record<RankingScope, string> = {
    global: "Todavía no hay jugadores rankeados.",
    group: "No pertenecés a ningún grupo con ranking disponible.",
    city: "No hay suficiente actividad registrada en una ciudad disponible.",
    venue: "Todavía no hay una sede con ranking disponible.",
  };
  return <State text={messages[scope]} />;
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
