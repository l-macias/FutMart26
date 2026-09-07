"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { adminApi } from "../../lib/api";

interface ErrorEvent {
  id: string;
  timestamp: string;
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  errorCode: string;
  safeMessage: string;
}

export default function ErrorsPage() {
  const [status, setStatus] = useState("");
  const [route, setRoute] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const errors = useQuery({
    queryKey: ["admin", "errors", status, route, errorCode, from, to],
    queryFn: () =>
      adminApi<{
        items: ErrorEvent[];
        retention: { kind: "MEMORY"; capacity: number };
      }>(
        `/admin/errors?status=${status}&route=${encodeURIComponent(route)}&errorCode=${encodeURIComponent(errorCode)}&from=${from}&to=${to ? `${to}T23:59:59.999Z` : ""}&limit=100`,
      ),
  });
  return (
    <main>
      <header className="page-header">
        <span className="eyebrow">DIAGNÓSTICO SEGURO</span>
        <h1>Errores recientes</h1>
        <p className="muted">
          Eventos sanitizados del proceso actual. No es un visor de logs.
        </p>
      </header>
      <div className="toolbar">
        <label>
          Estado
          <input
            inputMode="numeric"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            placeholder="Ej. 500"
          />
        </label>
        <label>
          Ruta
          <input
            value={route}
            onChange={(event) => setRoute(event.target.value)}
            placeholder="Ej. /groups"
          />
        </label>
        <label>
          Código seguro
          <input
            value={errorCode}
            onChange={(event) => setErrorCode(event.target.value)}
            placeholder="Ej. internal_server_error"
          />
        </label>
        <label>
          Desde
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>
      {errors.data ? (
        <p className="metadata">
          Retención en memoria: últimos {errors.data.retention.capacity}{" "}
          eventos; se reinicia con el proceso.
        </p>
      ) : null}
      {errors.isPending ? (
        <p className="muted">Cargando errores…</p>
      ) : errors.isError ? (
        <p className="error" role="alert">
          No pudimos cargar los errores recientes.
        </p>
      ) : errors.data.items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Ruta</th>
                <th>Código</th>
                <th>Resumen</th>
                <th>Duración</th>
                <th>Request</th>
              </tr>
            </thead>
            <tbody>
              {errors.data.items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Fecha">{formatDate(item.timestamp)}</td>
                  <td data-label="Estado">
                    <span
                      className="status"
                      data-tone={item.status >= 500 ? "danger" : "warning"}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td data-label="Ruta">
                    <span className="mono">
                      {item.method} {item.route}
                    </span>
                  </td>
                  <td data-label="Código">{item.errorCode}</td>
                  <td data-label="Resumen">{item.safeMessage}</td>
                  <td data-label="Duración">{item.durationMs} ms</td>
                  <td data-label="Request">
                    <span className="mono" title={item.requestId}>
                      {item.requestId.slice(0, 8)}…
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No hay errores recientes con estos filtros.</p>
      )}
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
    hourCycle: "h23",
  }).format(new Date(value));
}
