"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import type {
  FeaturedGroupsResponse,
  FeaturedPlayersResponse,
} from "@football/contracts";
import { Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { queryPolicy } from "@/lib/api/query-policy";

import styles from "./global-home.module.css";

type Period = "7d" | "30d";
type PlayerCategory = "OVR" | "GOALS" | "ASSISTS" | "AWARDS";

export function GlobalHomeScreen() {
  const [period, setPeriod] = useState<Period>("30d");
  const [playerCategory, setPlayerCategory] = useState<PlayerCategory>("OVR");
  const ranking = useQuery({
    ...queryPolicy.semiStable,
    queryKey: queryKeys.globalRankingPreview,
    queryFn: () => api.globalRanking(undefined, 5),
  });
  const currentPlayers = useQuery({
    ...queryPolicy.semiStable,
    queryKey: queryKeys.featuredPlayers("30d"),
    queryFn: () => api.featuredPlayers("30d"),
  });
  const temporalPlayers = useQuery({
    ...queryPolicy.semiStable,
    queryKey: queryKeys.featuredPlayers(period),
    queryFn: () => api.featuredPlayers(period),
  });
  const rising = useQuery({
    ...queryPolicy.semiStable,
    queryKey: queryKeys.risingPlayers(period),
    queryFn: () => api.risingPlayers(period),
  });
  const groups = useQuery({
    ...queryPolicy.semiStable,
    queryKey: queryKeys.featuredGroups(period),
    queryFn: () => api.featuredGroups(period),
  });

  const featured =
    playerCategory === "OVR" ? currentPlayers.data : temporalPlayers.data;
  const featuredItems = featured
    ? selectFeaturedPlayers(featured, playerCategory)
    : [];

  return (
    <div className={styles.page}>
      <HeroSearch />

      <section
        aria-labelledby="global-ranking-title"
        className={styles.ranking}
      >
        <SectionHeader
          eyebrow="RANKING GLOBAL · F5"
          href="/rankings/global"
          id="global-ranking-title"
          link="VER RANKING COMPLETO"
          title="La cancha completa."
        />
        <QueryState
          empty="Todavía no hay jugadores rankeados."
          error="No pudimos cargar el ranking global."
          loading="Armando el ranking global…"
          query={ranking}
        >
          {ranking.data && ranking.data.items.length > 0 ? (
            <>
              <ol className={styles.podium} aria-label="Top global F5">
                {ranking.data.items.slice(0, 3).map((item) => (
                  <li key={item.player.id}>
                    <Link
                      href={
                        item.isCurrentPlayer
                          ? "/profile"
                          : `/players/${item.player.id}`
                      }
                    >
                      <span className={styles.podiumPosition}>
                        #{item.position}
                      </span>
                      <strong>{item.player.displayName}</strong>
                      <span className={styles.podiumOvr}>
                        {Math.round(Number(item.performance.overall))}
                        <small>OVR</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
              <ol className={styles.rankingRows} start={4}>
                {ranking.data.items.slice(3).map((item) => (
                  <li key={item.player.id}>
                    <Link
                      href={
                        item.isCurrentPlayer
                          ? "/profile"
                          : `/players/${item.player.id}`
                      }
                    >
                      <span>#{item.position}</span>
                      <strong>{item.player.displayName}</strong>
                      <span>
                        {Math.round(Number(item.performance.overall))} OVR
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
              <div className={styles.myPosition}>
                <span>TU POSICIÓN</span>
                <strong>
                  {ranking.data.me.ranked
                    ? `#${ranking.data.me.position}`
                    : "—"}
                </strong>
                <small>
                  {ranking.data.me.ranked
                    ? `${Math.round(Number(ranking.data.me.overall))} OVR`
                    : "Jugá tu primer partido procesado para entrar"}
                </small>
              </div>
            </>
          ) : null}
        </QueryState>
      </section>

      <section aria-labelledby="featured-title" className={styles.featured}>
        <div className={styles.sectionTopline}>
          <div>
            <Text as="span" tone="accent" variant="label">
              JUGADORES DESTACADOS
            </Text>
            <Text as="h2" id="featured-title" variant="display-lg">
              Por qué están arriba.
            </Text>
          </div>
          <PeriodSelector period={period} setPeriod={setPeriod} />
        </div>
        <div
          aria-label="Categoría de jugadores destacados"
          className={styles.categorySelector}
        >
          {(["OVR", "GOALS", "ASSISTS", "AWARDS"] as const).map((category) => (
            <button
              aria-pressed={playerCategory === category}
              key={category}
              onClick={() => setPlayerCategory(category)}
              type="button"
            >
              {playerCategoryLabel(category)}
            </button>
          ))}
        </div>
        <QueryState
          empty={featuredEmpty(playerCategory, period)}
          error="No pudimos cargar los jugadores destacados."
          loading="Buscando protagonistas…"
          query={playerCategory === "OVR" ? currentPlayers : temporalPlayers}
        >
          {featuredItems.length > 0 ? (
            <div className={styles.featuredPlayers}>
              <Link
                className={styles.featuredLead}
                href={`/players/${featuredItems[0]!.player.id}`}
              >
                <span>01 · F5</span>
                <strong>{featuredItems[0]!.player.displayName}</strong>
                <Metric item={featuredItems[0]!} />
              </Link>
              <ol className={styles.featuredRows} start={2}>
                {featuredItems.slice(1).map((item, index) => (
                  <li key={item.player.id}>
                    <Link href={`/players/${item.player.id}`}>
                      <span>{String(index + 2).padStart(2, "0")}</span>
                      <strong>{item.player.displayName}</strong>
                      <Metric item={item} />
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </QueryState>
      </section>

      <section aria-labelledby="rising-title" className={styles.rising}>
        <SectionHeader
          eyebrow="EN ASCENSO"
          id="rising-title"
          title="El próximo salto."
        />
        <QueryState
          empty="Todavía no hay jugadores en ascenso con suficiente actividad."
          error="No pudimos cargar los jugadores en ascenso."
          loading="Leyendo la evolución reciente…"
          query={rising}
        >
          {rising.data && rising.data.items.length > 0 ? (
            <ol className={styles.risingList}>
              {rising.data.items.map((item) => (
                <li key={item.player.id}>
                  <Link href={`/players/${item.player.id}`}>
                    <span>
                      <strong>{item.player.displayName}</strong>
                      <small>
                        {item.matchesProcessedInPeriod} partidos ·{" "}
                        {periodLabel(period)}
                      </small>
                    </span>
                    <span className={styles.risingOvr}>
                      {Math.round(Number(item.currentOverall))} OVR
                    </span>
                    <strong className={styles.gain}>
                      +{formatDecimal(item.netOvrGain)} OVR
                    </strong>
                  </Link>
                </li>
              ))}
            </ol>
          ) : null}
        </QueryState>
      </section>

      <section aria-labelledby="groups-title" className={styles.groups}>
        <SectionHeader
          eyebrow={`GRUPOS · ${periodLabel(period).toUpperCase()}`}
          id="groups-title"
          title="Donde más rueda la pelota."
        />
        <QueryState
          empty="Sin actividad suficiente en este período."
          error="No pudimos cargar la actividad de los grupos."
          loading="Midiendo la actividad de los grupos…"
          query={groups}
        >
          {groups.data ? <FeaturedGroups data={groups.data} /> : null}
        </QueryState>
      </section>

      <footer className={styles.discoveryFooter}>
        <div>
          <Text tone="accent" variant="label">
            TU PRÓXIMA JUGADA
          </Text>
          <Text as="h2" variant="heading-lg">
            Volvé a tu fútbol.
          </Text>
        </div>
        <Link href="/play">IR A JUGAR →</Link>
        <Link href="/players">BUSCAR JUGADORES →</Link>
      </footer>
    </div>
  );
}

function HeroSearch() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const normalized = input.normalize("NFKC").trim().replace(/\s+/g, " ");
    const timer = window.setTimeout(
      () => setQuery(normalized.length >= 2 ? normalized : ""),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [input]);

  const search = useQuery({
    queryKey: queryKeys.globalSearch(query),
    queryFn: ({ signal }) => api.globalSearch(query, 5, signal),
    enabled: query.length >= 2,
  });
  const hasResults = Boolean(
    search.data &&
    (search.data.players.length > 0 || search.data.groups.length > 0),
  );

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      container.current?.querySelector("input")?.focus();
    }
  }

  return (
    <header className={styles.hero} onKeyDown={closeOnEscape} ref={container}>
      <div className={styles.heroCopy}>
        <Text as="span" tone="accent" variant="label">
          F5 GROUPS · FÚTBOL AMATEUR
        </Text>
        <Text as="h1" variant="display-lg">
          La cancha no termina en tu grupo.
        </Text>
        <Text tone="muted" variant="body">
          Descubrí quién está creciendo, dónde se juega y cómo se mueve el F5.
        </Text>
        <div className={styles.heroActions}>
          <Link href="/play">IR A JUGAR</Link>
          <Link href="/rankings/global">RANKING GLOBAL</Link>
        </div>
      </div>
      <div className={styles.searchBox}>
        <label htmlFor="global-home-search">BUSCAR JUGADOR O GRUPO</label>
        <input
          aria-controls="global-home-results"
          aria-expanded={open && query.length >= 2}
          autoComplete="off"
          id="global-home-search"
          onChange={(event) => {
            setInput(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Lucas, Los Pibes…"
          type="search"
          value={input}
        />
        {open && query.length >= 2 && (
          <div className={styles.searchResults} id="global-home-results">
            {search.isFetching && <p role="status">Buscando…</p>}
            {search.isError && (
              <p role="alert">No pudimos completar la búsqueda.</p>
            )}
            {search.data && !hasResults && <p>Sin coincidencias.</p>}
            {search.data && search.data.players.length > 0 && (
              <section aria-labelledby="home-player-results">
                <h2 id="home-player-results">JUGADORES</h2>
                <ul>
                  {search.data.players.map((item) => (
                    <li key={item.player.id}>
                      <Link href={`/players/${item.player.id}`}>
                        <strong>{item.player.displayName}</strong>
                        <span>
                          {item.performance.overall === null
                            ? "SIN OVR"
                            : `${Math.round(item.performance.overall)} OVR`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {search.data && search.data.groups.length > 0 && (
              <section aria-labelledby="home-group-results">
                <h2 id="home-group-results">GRUPOS</h2>
                <ul>
                  {search.data.groups.map((group) => (
                    <li className={styles.groupResult} key={group.id}>
                      <strong>{group.name}</strong>
                      <span>GRUPO PRIVADO</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function PeriodSelector({
  period,
  setPeriod,
}: Readonly<{ period: Period; setPeriod: (period: Period) => void }>) {
  return (
    <div aria-label="Período de actividad" className={styles.periodSelector}>
      {(["7d", "30d"] as const).map((value) => (
        <button
          aria-pressed={period === value}
          key={value}
          onClick={() => setPeriod(value)}
          type="button"
        >
          {value === "7d" ? "7 DÍAS" : "30 DÍAS"}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  id,
  href,
  link,
}: Readonly<{
  eyebrow: string;
  title: string;
  id: string;
  href?: string;
  link?: string;
}>) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        <Text as="span" tone="accent" variant="label">
          {eyebrow}
        </Text>
        <Text as="h2" id={id} variant="display-lg">
          {title}
        </Text>
      </div>
      {href && link ? <Link href={href}>{link} →</Link> : null}
    </div>
  );
}

function QueryState({
  query,
  loading,
  error,
  empty,
  children,
}: Readonly<{
  query: { isPending: boolean; isError: boolean; data?: unknown };
  loading: string;
  error: string;
  empty: string;
  children: ReactNode;
}>) {
  if (query.isPending) return <p className={styles.state}>{loading}</p>;
  if (query.isError)
    return (
      <p className={styles.state} role="alert">
        {error}
      </p>
    );
  if (!query.data || !children) return <p className={styles.state}>{empty}</p>;
  return children;
}

function selectFeaturedPlayers(
  data: FeaturedPlayersResponse,
  category: PlayerCategory,
) {
  if (category === "OVR") return data.currentTopOvr;
  if (category === "GOALS") return data.topScorers;
  if (category === "ASSISTS") return data.topAssists;
  return data.mostAwarded;
}

type FeaturedItem = ReturnType<typeof selectFeaturedPlayers>[number];

function Metric({ item }: Readonly<{ item: FeaturedItem }>) {
  const unit =
    item.metric.type === "TOP_OVR"
      ? "OVR"
      : item.metric.type === "TOP_SCORERS"
        ? "GOLES"
        : item.metric.type === "TOP_ASSISTS"
          ? "ASISTENCIAS"
          : "PREMIOS";
  return (
    <span className={styles.metric}>
      {item.metric.type === "TOP_OVR"
        ? Math.round(Number(item.overall))
        : item.metric.value}
      <small>{unit}</small>
    </span>
  );
}

function FeaturedGroups({ data }: Readonly<{ data: FeaturedGroupsResponse }>) {
  const categories = [
    ["MÁS ACTIVOS", data.mostActive],
    ["MÁS JUGADORES ACTIVOS", data.mostActivePlayers],
    ["MÁS GOLES", data.mostGoals],
  ] as const;
  if (categories.every(([, items]) => items.length === 0))
    return (
      <p className={styles.state}>Sin actividad suficiente en este período.</p>
    );
  return (
    <div className={styles.groupCategories}>
      {categories.map(([title, items]) => (
        <article key={title}>
          <h3>{title}</h3>
          {items.length === 0 ? (
            <p>Sin actividad en este período.</p>
          ) : (
            <ol>
              {items.slice(0, 3).map((item) => (
                <li key={item.group.id}>
                  <strong>{item.group.name}</strong>
                  <span>
                    {item.metric.value} {groupMetricUnit(item.metric.type)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </article>
      ))}
    </div>
  );
}

function groupMetricUnit(type: string) {
  if (type === "MOST_ACTIVE") return "PARTIDOS";
  if (type === "MOST_ACTIVE_PLAYERS") return "JUGADORES ACTIVOS";
  return "GOLES";
}

function playerCategoryLabel(category: PlayerCategory) {
  if (category === "GOALS") return "GOLES";
  if (category === "ASSISTS") return "ASISTENCIAS";
  if (category === "AWARDS") return "PREMIOS";
  return "OVR";
}

function featuredEmpty(category: PlayerCategory, period: Period) {
  if (category === "OVR") return "Todavía no hay jugadores con OVR procesado.";
  if (category === "GOALS")
    return `Sin goles registrados en ${periodLabel(period)}.`;
  if (category === "ASSISTS")
    return `Sin asistencias registradas en ${periodLabel(period)}.`;
  return `Sin premios registrados en ${periodLabel(period)}.`;
}

function periodLabel(period: Period) {
  return period === "7d" ? "7 días" : "30 días";
}

function formatDecimal(value: string) {
  return Number(value).toFixed(1);
}
