"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button, Text } from "@football/ui";

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
    <div className={styles.page}>
      <header className={styles.header}>
        <Text as="h1" variant="display-lg">
          Buscar
        </Text>
        <Text tone="muted">Encontrá jugadores o grupos por nombre.</Text>
      </header>

      <form className={styles.search} onSubmit={submit} role="search">
        <label htmlFor="global-search">Jugadores o grupos</label>
        <div>
          <input
            aria-describedby="search-hint"
            autoComplete="off"
            autoFocus
            id="global-search"
            maxLength={100}
            minLength={2}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ej. Lucas o Los del Parque"
            type="search"
            value={input}
          />
          <Button disabled={input.trim().length < 2} type="submit">
            Buscar
          </Button>
        </div>
        <Text as="span" id="search-hint" tone="muted" variant="metadata">
          Escribí al menos 2 caracteres.
        </Text>
      </form>

      {query.length < 2 ? (
        <div className={styles.compactState}>
          <Text tone="muted">Buscá jugadores o grupos.</Text>
        </div>
      ) : null}
      {search.isFetching ? (
        <div
          aria-label="Buscando…"
          className={styles.loadingRows}
          role="status"
        >
          <span />
          <span />
        </div>
      ) : null}
      {search.isError ? (
        <p className={styles.error} role="alert">
          No pudimos completar la búsqueda. Revisá tu conexión e intentá
          nuevamente.
        </p>
      ) : null}
      {search.data && !hasResults ? (
        <section className={styles.empty}>
          <Text as="h2" variant="heading-lg">
            Sin coincidencias
          </Text>
          <Text tone="muted">
            No encontramos jugadores o grupos para “{query}”.
          </Text>
        </section>
      ) : null}

      {search.data?.players.length ? (
        <section
          className={styles.resultSection}
          aria-labelledby="players-results"
        >
          <div className={styles.sectionHeading}>
            <Text as="h2" id="players-results" variant="heading-lg">
              Jugadores
            </Text>
            <Text tone="muted" variant="metadata">
              {search.data.players.length} resultados
            </Text>
          </div>
          <ul
            className={`${styles.results} ui-list`}
            aria-label="Jugadores encontrados"
          >
            {search.data.players.map((item) => (
              <li className="ui-row" key={item.player.id}>
                <Link
                  className={styles.resultLink}
                  href={`/players/${item.player.id}`}
                >
                  <span aria-hidden="true" className={styles.avatarFallback}>
                    {item.player.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="ui-row__content">
                    <strong>{item.player.displayName}</strong>
                    <small>
                      {item.performance.processedMatchCount} partidos procesados
                    </small>
                  </span>
                  <span className={`${styles.ovr} ui-row__metric`}>
                    {item.performance.overall === null
                      ? "—"
                      : Math.round(item.performance.overall)}
                    <small>OVR</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {search.data?.groups.length ? (
        <section
          className={styles.resultSection}
          aria-labelledby="groups-results"
        >
          <div className={styles.sectionHeading}>
            <Text as="h2" id="groups-results" variant="heading-lg">
              Grupos
            </Text>
            <Text tone="muted" variant="metadata">
              {search.data.groups.length} resultados
            </Text>
          </div>
          <ul
            className={`${styles.results} ui-list`}
            aria-label="Grupos encontrados"
          >
            {search.data.groups.map((group) => (
              <li className="ui-row" key={group.id}>
                {group.target ? (
                  <Link className={styles.resultLink} href={group.target.href}>
                    <span aria-hidden="true" className={styles.groupMark}>
                      F5
                    </span>
                    <span className="ui-row__content">
                      <strong>{group.name}</strong>
                      <small>Grupo público · Sos miembro</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <div className={styles.resultLink}>
                    <span aria-hidden="true" className={styles.groupMark}>
                      F5
                    </span>
                    <span className="ui-row__content">
                      <strong>{group.name}</strong>
                      <small>Grupo público</small>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
