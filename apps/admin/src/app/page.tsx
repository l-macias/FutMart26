"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type {
  AdminSearchResponse,
  AdminSystemStatus,
} from "@football/contracts";
import { adminApi } from "../lib/api";
import { DirectActionForm } from "../components/direct-action-form";

export default function AdminHomePage() {
  const [query, setQuery] = useState("");
  const search = useQuery({
    queryKey: ["admin", "search", query],
    queryFn: () =>
      adminApi<AdminSearchResponse>(
        `/admin/search?q=${encodeURIComponent(query)}&limit=20`,
      ),
    enabled: query.trim().length > 0,
  });
  const system = useQuery({
    queryKey: ["admin", "system"],
    queryFn: () => adminApi<AdminSystemStatus>("/admin/system"),
  });
  return (
    <main>
      <h1>Operaciones</h1>
      <p>
        Lookup y estado técnico mínimo. Ninguna acción salta invariantes
        deportivas.
      </p>
      <section>
        <h2>Buscar</h2>
        <input
          aria-label="Buscar"
          placeholder="Player, email, Group o UUID de Match"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {search.isError ? <p className="error">No se pudo buscar.</p> : null}
        {search.data ? (
          <div className="results">
            <Result
              title="Players"
              items={search.data.players.map((item) => ({
                href: `/players/${item.id}`,
                label: `${item.displayName}${item.email ? ` · ${item.email}` : ""}${item.suspended ? " · SUSPENDIDO" : ""}`,
              }))}
            />
            <Result
              title="Groups"
              items={search.data.groups.map((item) => ({
                href: `/groups/${item.id}`,
                label: `${item.name} · ${item.status}`,
              }))}
            />
            <Result
              title="Matches"
              items={search.data.matches.map((item) => ({
                href: `/matches/${item.id}`,
                label: `${item.groupName} · ${item.status} · ${item.scheduledAt}`,
              }))}
            />
          </div>
        ) : null}
      </section>
      <section>
        <h2>Sistema</h2>
        {system.data ? (
          <dl>
            <dt>API / DB</dt>
            <dd>
              {system.data.api} / {system.data.database}
            </dd>
            <dt>Entorno</dt>
            <dd>{system.data.environment}</dd>
            <dt>Migration</dt>
            <dd>{system.data.migration.id ?? "sin dato"}</dd>
            <dt>Storage / Mail</dt>
            <dd>
              {system.data.storageConfigured ? "configurado" : "no configurado"}{" "}
              / {system.data.mailConfigured ? "configurado" : "no configurado"}
            </dd>
          </dl>
        ) : (
          <p>Cargando…</p>
        )}
      </section>
      <DirectActionForm />
    </main>
  );
}

function Result({
  title,
  items,
}: Readonly<{ title: string; items: Array<{ href: string; label: string }> }>) {
  return (
    <section>
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>Sin resultados.</p>
      )}
    </section>
  );
}
