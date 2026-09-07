"use client";

import type { AdminAuditEvent } from "@football/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { adminApi } from "../../lib/api";
import { auditActionLabel, targetTypeLabel } from "../../lib/admin-copy";

export default function AuditPage() {
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [targetType, setTargetType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const audit = useQuery({
    queryKey: ["admin", "audit", action, actor, targetType, from, to],
    queryFn: () =>
      adminApi<{ items: AdminAuditEvent[] }>(
        `/admin/audit?action=${encodeURIComponent(action)}&actor=${encodeURIComponent(actor)}&targetType=${targetType}&from=${from}&to=${to ? `${to}T23:59:59.999Z` : ""}&limit=100`,
      ),
  });
  return (
    <main>
      <header className="page-header">
        <span className="eyebrow">EVIDENCIA ADMINISTRATIVA</span>
        <h1>Auditoría</h1>
        <p className="muted">
          Registro append-only. La consola no permite editar ni borrar eventos.
        </p>
      </header>
      <div className="toolbar">
        <label>
          Acción
          <input
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="Ej. suspender"
          />
        </label>
        <label>
          Operador
          <input
            value={actor}
            onChange={(event) => setActor(event.target.value)}
            placeholder="Email"
          />
        </label>
        <label>
          Entidad
          <select
            value={targetType}
            onChange={(event) => setTargetType(event.target.value)}
          >
            <option value="">Todas</option>
            <option value="ACCOUNT">Cuenta</option>
            <option value="PLAYER">Jugador</option>
            <option value="GROUP">Grupo</option>
            <option value="MATCH">Partido</option>
            <option value="REPORT">Reporte</option>
            <option value="BALLOT">Boleta</option>
            <option value="INVITATION">Invitación</option>
          </select>
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
      {audit.isPending ? (
        <p className="muted">Cargando auditoría…</p>
      ) : audit.isError ? (
        <p className="error" role="alert">
          No pudimos cargar la auditoría.
        </p>
      ) : audit.data.items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Operador</th>
                <th>Entidad</th>
                <th>Motivo</th>
                <th>Referencia</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.items.map((event) => (
                <tr key={event.id}>
                  <td data-label="Fecha">{formatDate(event.createdAt)}</td>
                  <td data-label="Acción">{auditActionLabel(event.action)}</td>
                  <td data-label="Operador">
                    {event.actorEmail ?? "Cuenta no disponible"}
                  </td>
                  <td data-label="Entidad">
                    {targetTypeLabel(event.targetType)}
                  </td>
                  <td data-label="Motivo">{event.reason}</td>
                  <td data-label="Referencia">
                    <span className="mono" title={event.requestId}>
                      {event.requestId.slice(0, 8)}…
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No hay eventos para estos filtros.</p>
      )}
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(new Date(value));
}
