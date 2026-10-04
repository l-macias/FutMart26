"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { adminApi } from "../lib/api";

interface PlayerItem {
  id: string;
  displayName: string;
  email: string | null;
  accountStatus: string;
  suspended: boolean;
  createdAt: string;
}
interface GroupItem {
  id: string;
  name: string;
  status: string;
  visibility: string;
  ownerName: string | null;
  memberCount: number;
  createdAt: string;
}
interface MatchItem {
  id: string;
  groupName: string;
  status: string;
  effectivePhase: string;
  scheduledAt: string;
  locationText: string;
  capacity: number;
  confirmedCount: number;
  scoreA: number | null;
  scoreB: number | null;
}

interface PageResult<T> {
  items: T[];
  hasMore: boolean;
}

const PAGE_SIZE = 25;

export function PlayersList() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const deferred = useDebouncedValue(query);
  useEffect(() => setPage(0), [deferred]);
  const result = useQuery({
    queryKey: ["admin", "players", deferred, page],
    queryFn: () =>
      adminApi<PageResult<PlayerItem>>(
        `/admin/players?q=${encodeURIComponent(deferred)}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      ),
  });
  return (
    <main>
      <PageHeader
        eyebrow="IDENTIDADES"
        title="Jugadores"
        copy="Buscá por nombre o email. El ID queda como herramienta secundaria."
      />
      <Filter
        label="Buscar jugadores"
        value={query}
        onChange={setQuery}
        placeholder="Nombre o email"
        count={result.data?.items.length}
      />
      {result.isPending ? (
        <Loading />
      ) : result.isError ? (
        <ErrorState />
      ) : result.data?.items.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Cuenta</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((item) => (
                  <tr key={item.id}>
                    <Cell label="Jugador">
                      <Link href={`/players/${item.id}`}>
                        {item.displayName}
                      </Link>
                    </Cell>
                    <Cell label="Cuenta">
                      {item.email ?? "Cuenta desvinculada"}
                    </Cell>
                    <Cell label="Estado">
                      <Status
                        value={
                          item.accountStatus === "ANONYMIZED"
                            ? "ANONIMIZADO"
                            : item.suspended
                              ? "SUSPENDIDO"
                              : "ACTIVO"
                        }
                        tone={
                          item.suspended
                            ? "danger"
                            : item.accountStatus === "ANONYMIZED"
                              ? "warning"
                              : "success"
                        }
                      />
                    </Cell>
                    <Cell label="Creado">{formatDate(item.createdAt)}</Cell>
                    <Cell label="Acción">
                      <Link href={`/players/${item.id}`}>Inspeccionar</Link>
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} hasMore={result.data.hasMore} onChange={setPage} />
        </>
      ) : (
        <Empty copy="No encontramos jugadores para esta búsqueda." />
      )}
    </main>
  );
}

export function GroupsList() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const deferred = useDebouncedValue(query);
  useEffect(() => setPage(0), [deferred]);
  const result = useQuery({
    queryKey: ["admin", "groups", deferred, page],
    queryFn: () =>
      adminApi<PageResult<GroupItem>>(
        `/admin/groups?q=${encodeURIComponent(deferred)}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      ),
  });
  return (
    <main>
      <PageHeader
        eyebrow="COMUNIDADES"
        title="Grupos"
        copy="Inspección operativa de estado, visibilidad y propiedad."
      />
      <Filter
        label="Buscar grupos"
        value={query}
        onChange={setQuery}
        placeholder="Nombre del grupo"
        count={result.data?.items.length}
      />
      {result.isPending ? (
        <Loading />
      ) : result.isError ? (
        <ErrorState />
      ) : result.data?.items.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Estado</th>
                  <th>Visibilidad</th>
                  <th>Miembros</th>
                  <th>Propietario</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((item) => (
                  <tr key={item.id}>
                    <Cell label="Grupo">
                      <Link href={`/groups/${item.id}`}>{item.name}</Link>
                    </Cell>
                    <Cell label="Estado">
                      <Status
                        value={statusLabel(item.status)}
                        tone={
                          item.status === "ARCHIVED" ? "warning" : "success"
                        }
                      />
                    </Cell>
                    <Cell label="Visibilidad">
                      {statusLabel(item.visibility)}
                    </Cell>
                    <Cell label="Miembros">{item.memberCount}</Cell>
                    <Cell label="Propietario">
                      {item.ownerName ?? "No disponible"}
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} hasMore={result.data.hasMore} onChange={setPage} />
        </>
      ) : (
        <Empty copy="No encontramos grupos para esta búsqueda." />
      )}
    </main>
  );
}

export function MatchesList() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("");
  const [page, setPage] = useState(0);
  const deferred = useDebouncedValue(query);
  useEffect(() => setPage(0), [deferred, phase]);
  const result = useQuery({
    queryKey: ["admin", "matches", deferred, phase, page],
    queryFn: () =>
      adminApi<PageResult<MatchItem>>(
        `/admin/matches?q=${encodeURIComponent(deferred)}&phase=${phase}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      ),
  });
  return (
    <main>
      <PageHeader
        eyebrow="OPERACIÓN DEPORTIVA"
        title="Partidos"
        copy="Buscá por grupo o sede y filtrá por lifecycle."
      />
      <div className="toolbar">
        <Filter
          label="Buscar partidos"
          value={query}
          onChange={setQuery}
          placeholder="Grupo o sede"
          count={result.data?.items.length}
        />
        <label>
          Fase operativa
          <select
            value={phase}
            onChange={(event) => setPhase(event.target.value)}
          >
            <option value="">Todos</option>
            <option value="DRAFT">Borrador</option>
            <option value="OPEN">Abierto</option>
            <option value="IN_PROGRESS">En juego</option>
            <option value="AWAITING_RESULT">Esperando resultado</option>
            <option value="VOTING_OPEN">Votación abierta</option>
            <option value="FINISHED">Finalizado</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </label>
      </div>
      {result.isPending ? (
        <Loading />
      ) : result.isError ? (
        <ErrorState />
      ) : result.data?.items.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Grupo</th>
                  <th>Estado</th>
                  <th>Plantel</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((item) => (
                  <tr key={item.id}>
                    <Cell label="Fecha">
                      <Link href={`/matches/${item.id}`}>
                        {formatDate(item.scheduledAt)}
                      </Link>
                      <small className="muted">{item.locationText}</small>
                    </Cell>
                    <Cell label="Grupo">{item.groupName}</Cell>
                    <Cell label="Estado">
                      <Status
                        value={statusLabel(item.effectivePhase)}
                        tone={
                          item.effectivePhase === "IN_PROGRESS"
                            ? "success"
                            : item.effectivePhase === "CANCELLED"
                              ? "danger"
                              : "warning"
                        }
                      />
                    </Cell>
                    <Cell label="Plantel">
                      {item.confirmedCount}/{item.capacity}
                    </Cell>
                    <Cell label="Resultado">
                      {item.scoreA === null || item.scoreB === null
                        ? "—"
                        : `${item.scoreA} — ${item.scoreB}`}
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} hasMore={result.data.hasMore} onChange={setPage} />
        </>
      ) : (
        <Empty copy="No encontramos partidos con estos filtros." />
      )}
    </main>
  );
}

function PageHeader({
  eyebrow,
  title,
  copy,
}: Readonly<{ eyebrow: string; title: string; copy: string }>) {
  return (
    <header className="page-header">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p className="muted">{copy}</p>
    </header>
  );
}
function Filter({
  label,
  value,
  onChange,
  placeholder,
  count,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  count?: number;
}>) {
  return (
    <label>
      {label}
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <small className="metadata">
        {count === undefined ? "Consultando" : `${count} resultados`}
      </small>
    </label>
  );
}
function Cell({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <td>
      <span className="mobile-label">{label}</span>
      <span>{children}</span>
    </td>
  );
}
function Status({
  value,
  tone,
}: Readonly<{ value: string; tone: "success" | "warning" | "danger" }>) {
  return (
    <span className="status" data-tone={tone}>
      {value}
    </span>
  );
}
function Loading() {
  return (
    <div className="state-panel">
      <p>Cargando resultados…</p>
    </div>
  );
}
function ErrorState() {
  return (
    <div className="state-panel error" role="alert">
      No pudimos cargar los resultados. Intentá nuevamente.
    </div>
  );
}
function Empty({ copy }: Readonly<{ copy: string }>) {
  return <p className="empty">{copy}</p>;
}
function Pager({
  page,
  hasMore,
  onChange,
}: Readonly<{
  page: number;
  hasMore: boolean;
  onChange: (page: number) => void;
}>) {
  if (page === 0 && !hasMore) return null;
  return (
    <nav className="actions" aria-label="Paginación">
      <button
        className="button-quiet"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        Anterior
      </button>
      <span className="metadata">Página {page + 1}</span>
      <button
        className="button-quiet"
        disabled={!hasMore}
        onClick={() => onChange(page + 1)}
      >
        Siguiente
      </button>
    </nav>
  );
}
function useDebouncedValue(value: string) {
  const [deferred, setDeferred] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDeferred(value.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [value]);
  return deferred;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(new Date(value));
}
function statusLabel(value: string) {
  return (
    (
      {
        ACTIVE: "ACTIVO",
        ARCHIVED: "ARCHIVADO",
        PUBLIC: "PÚBLICO",
        PRIVATE: "PRIVADO",
        DRAFT: "BORRADOR",
        OPEN: "ABIERTO",
        STARTED: "EN JUEGO",
        IN_PROGRESS: "EN JUEGO",
        AWAITING_RESULT: "ESPERANDO RESULTADO",
        VOTING_OPEN: "VOTACIÓN ABIERTA",
        FINISHED: "FINALIZADO",
        CANCELLED: "CANCELADO",
      } as Record<string, string>
    )[value] ?? value
  );
}
