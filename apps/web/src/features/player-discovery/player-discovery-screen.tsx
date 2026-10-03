"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button, Text } from "@football/ui";

import {
  V4GroupCrest,
  V4Portrait,
  V4TierPlate,
} from "@/components/visual-v4/profile-assets";
import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";
import { queryPolicy } from "@/lib/api/query-policy";

import styles from "./player-discovery.module.css";

const SEARCH_DELAY_MS = 300;

export function PlayerDiscoveryScreen({
  initialQuery = "",
}: {
  initialQuery?: string;
}) {
  const normalizedInitialQuery = initialQuery.trim().slice(0, 100);
  const [input, setInput] = useState(normalizedInitialQuery);
  const [query, setQuery] = useState(
    normalizedInitialQuery.length >= 2 ? normalizedInitialQuery : "",
  );
  const router = useRouter();
  const search = useQuery({
    ...queryPolicy.volatile,
    queryKey: queryKeys.globalSearch(query),
    queryFn: ({ signal }) => api.globalSearch(query, 5, signal),
    enabled: query.length >= 2,
  });

  useEffect(() => {
    const normalized = input.trim();
    if (normalized.length < 2) {
      setQuery("");
      router.replace("/search", { scroll: false });
      return;
    }
    const timer = window.setTimeout(() => {
      setQuery(normalized);
      router.replace(`/search?q=${encodeURIComponent(normalized)}`, {
        scroll: false,
      });
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [input, router]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = input.trim();
    if (normalized.length < 2) return;
    setQuery(normalized);
    router.replace(`/search?q=${encodeURIComponent(normalized)}`, {
      scroll: false,
    });
  }

  const hasResults = Boolean(
    search.data &&
    (search.data.players.length > 0 || search.data.groups.length > 0),
  );

  return (
    <div className={`${styles.page} ui-visual-v4`}>
      <header className={styles.discoveryHeader}>
        <img
          alt=""
          className={styles.headerScene}
          src="/fifar-v4/backgrounds-raster/players-tunnel.webp"
        />
        <div className={styles.headerCopy}>
          <Text as="span" tone="accent" variant="label">
            PERSONAS · GRUPOS · FÚTBOL
          </Text>
          <Text as="h1" variant="display-lg">
            Buscar
          </Text>
          <Text tone="muted">Encontrá tu próxima conexión en FIFAR.</Text>
        </div>

        <form className={styles.search} onSubmit={submit} role="search">
          <label htmlFor="global-search">Jugadores o grupos</label>
          <div className={styles.searchControl}>
            <span aria-hidden="true" className={styles.searchIcon}>
              <SearchIcon />
            </span>
            <input
              aria-describedby="search-hint"
              autoComplete="off"
              autoFocus
              id="global-search"
              maxLength={100}
              minLength={2}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Jugador o grupo"
              type="search"
              value={input}
            />
            <Button disabled={input.trim().length < 2} type="submit">
              BUSCAR
            </Button>
          </div>
          <Text as="span" id="search-hint" tone="muted" variant="metadata">
            Escribí al menos 2 caracteres.
          </Text>
        </form>
      </header>

      {query.length < 2 ? (
        <DiscoveryState
          body="Buscá por nombre. Los perfiles y grupos privados siguen protegidos."
          title="La cancha empieza acá"
        />
      ) : null}

      {search.isFetching ? <SearchLoading /> : null}

      {search.isError ? (
        <section className={styles.errorState} role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>No pudimos completar la búsqueda</strong>
            <small>Revisá tu conexión e intentá nuevamente.</small>
          </div>
        </section>
      ) : null}

      {search.data && !hasResults ? (
        <DiscoveryState
          body={`No encontramos jugadores o grupos para “${query}”.`}
          title="Sin coincidencias"
        />
      ) : null}

      {hasResults ? (
        <div className={styles.resultsLayout}>
          {search.data?.players.length ? (
            <section
              className={styles.playerSection}
              aria-labelledby="players-results"
            >
              <ResultHeading
                count={search.data.players.length}
                id="players-results"
                kicker="IDENTIDAD FUTBOLÍSTICA"
                title="Jugadores"
              />
              <ul
                className={styles.playerGrid}
                aria-label="Jugadores encontrados"
              >
                {search.data.players.map((item) => (
                  <li
                    className={styles.playerResult}
                    data-current={item.isCurrentPlayer || undefined}
                    key={item.player.id}
                  >
                    <Link href={`/players/${item.player.id}`}>
                      <span aria-hidden="true" className={styles.playerScene} />
                      <V4Portrait name={item.player.displayName} />
                      <span className={styles.playerIdentity}>
                        {item.isCurrentPlayer ? <small>TU PERFIL</small> : null}
                        <strong>{item.player.displayName}</strong>
                        <span>
                          {item.performance.processedMatchCount}{" "}
                          {item.performance.processedMatchCount === 1
                            ? "partido procesado"
                            : "partidos procesados"}
                        </span>
                      </span>
                      {item.performance.overall === null ? (
                        <span className={styles.unrated}>
                          <strong>—</strong>
                          <small>SIN OVR</small>
                        </span>
                      ) : (
                        <V4TierPlate
                          compact
                          overall={item.performance.overall}
                        />
                      )}
                      <span aria-hidden="true" className={styles.openMark}>
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {search.data?.groups.length ? (
            <section
              className={styles.groupSection}
              aria-labelledby="groups-results"
            >
              <ResultHeading
                count={search.data.groups.length}
                id="groups-results"
                kicker="COMUNIDADES F5"
                title="Grupos"
              />
              <ul className={styles.groupGrid} aria-label="Grupos encontrados">
                {search.data.groups.map((group) => (
                  <li
                    className={styles.groupResult}
                    data-navigable={Boolean(group.target) || undefined}
                    key={group.id}
                  >
                    {group.target ? (
                      <Link href={group.target.href}>
                        <GroupResultContent group={group} />
                      </Link>
                    ) : (
                      <div>
                        <GroupResultContent group={group} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ResultHeading({
  count,
  id,
  kicker,
  title,
}: Readonly<{ count: number; id: string; kicker: string; title: string }>) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <Text tone="accent" variant="label">
          {kicker}
        </Text>
        <Text as="h2" id={id} variant="heading-lg">
          {title}
        </Text>
      </div>
      <strong>{String(count).padStart(2, "0")}</strong>
    </div>
  );
}

function GroupResultContent({
  group,
}: Readonly<{
  group: {
    id: string;
    name: string;
    target: { href: string } | null;
  };
}>) {
  return (
    <>
      <span aria-hidden="true" className={styles.groupScene} />
      <V4GroupCrest name={group.name} seed={group.id} size="large" />
      <span className={styles.groupIdentity}>
        <small>{group.target ? "SOS MIEMBRO" : "GRUPO PÚBLICO"}</small>
        <strong>{group.name}</strong>
        <span>Comunidad FIFAR · Fútbol F5</span>
      </span>
      {group.target ? (
        <span aria-hidden="true" className={styles.groupOpenMark}>
          ›
        </span>
      ) : (
        <span className={styles.publicMark}>PÚBLICO</span>
      )}
    </>
  );
}

function DiscoveryState({
  body,
  title,
}: Readonly<{ body: string; title: string }>) {
  return (
    <section className={styles.discoveryState}>
      <span aria-hidden="true" className={styles.discoveryScene} />
      <div aria-hidden="true" className={styles.discoveryEntities}>
        <V4Portrait name="FIFAR discovery player" size="large" />
        <V4GroupCrest
          name="FIFAR discovery group"
          seed="discovery-group"
          size="large"
        />
      </div>
      <div className={styles.discoveryStateCopy}>
        <Text tone="accent" variant="label">
          DESCUBRÍ FIFAR
        </Text>
        <Text as="h2" variant="display-lg">
          {title}
        </Text>
        <Text tone="muted">{body}</Text>
      </div>
    </section>
  );
}

function SearchLoading() {
  return (
    <div aria-label="Buscando…" className={styles.loadingGrid} role="status">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </svg>
  );
}
