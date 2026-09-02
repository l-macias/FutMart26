"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button, Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "./player-discovery.module.css";

export function PlayerDiscoveryScreen() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const search = useQuery({
    queryKey: queryKeys.globalSearch(query),
    queryFn: ({ signal }) => api.globalSearch(query, 5, signal),
    enabled: query.length >= 2,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(input.trim());
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Text as="span" tone="accent" variant="label">
          DISCOVERY F5
        </Text>
        <Text as="h1" variant="display-lg">
          Buscar jugadores y grupos
        </Text>
        <Text tone="muted">
          Encontrá identidades deportivas. Los datos privados siguen protegidos.
        </Text>
      </header>

      <form className={styles.search} onSubmit={submit}>
        <label htmlFor="player-search">Nombre deportivo</label>
        <div>
          <input
            autoComplete="off"
            id="player-search"
            minLength={2}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ej. Lucas o La Banda"
            required
            type="search"
            value={input}
          />
          <Button disabled={input.trim().length < 2} type="submit">
            Buscar
          </Button>
        </div>
      </form>

      {search.isFetching && <p role="status">Buscando jugadores…</p>}
      {search.isError && (
        <p className={styles.error} role="alert">
          No pudimos completar la búsqueda.
        </p>
      )}
      {search.data &&
        search.data.players.length === 0 &&
        search.data.groups.length === 0 && (
          <section className={styles.empty}>
            <Text as="h2" variant="heading-lg">
              Sin coincidencias
            </Text>
            <Text tone="muted">Probá con otro nombre.</Text>
          </section>
        )}
      {search.data && search.data.players.length > 0 && (
        <section>
          <Text as="h2" variant="heading-lg">
            Jugadores
          </Text>
          <ul className={styles.results} aria-label="Jugadores encontrados">
            {search.data.players.map((item) => (
              <li key={item.player.id}>
                <Link href={`/players/${item.player.id}`}>
                  <span>
                    <strong>{item.player.displayName}</strong>
                    <small>
                      {item.performance.processedMatchCount} partidos procesados
                    </small>
                  </span>
                  <span className={styles.ovr}>
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
      )}
      {search.data && search.data.groups.length > 0 && (
        <section>
          <Text as="h2" variant="heading-lg">
            Grupos
          </Text>
          <ul className={styles.results} aria-label="Grupos encontrados">
            {search.data.groups.map((group) => (
              <li key={group.id}>
                <div>
                  <span>
                    <strong>{group.name}</strong>
                    <small>Grupo privado · vista pública próximamente</small>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
