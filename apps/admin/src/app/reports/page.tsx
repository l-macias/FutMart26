"use client";

import type { AdminReport } from "@football/contracts";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { adminApi } from "../../lib/api";
import { reportReasonLabel } from "../../lib/admin-copy";

const statusCopy = {
  OPEN: "ABIERTOS",
  RESOLVED: "RESUELTOS",
  DISMISSED: "DESCARTADOS",
} as const;
const typeCopy = {
  PLAYER: "JUGADOR",
  GROUP: "GRUPO",
  MATCH: "PARTIDO",
} as const;

export default function ReportsPage() {
  const [status, setStatus] = useState<keyof typeof statusCopy>("OPEN");
  const [targetType, setTargetType] = useState("");
  const [reason, setReason] = useState("");
  const reports = useQuery({
    queryKey: ["admin", "reports", status, targetType, reason],
    queryFn: () =>
      adminApi<{ items: AdminReport[] }>(
        `/admin/reports?status=${status}&targetType=${targetType}&reason=${reason}`,
      ),
  });
  return (
    <main>
      <header className="page-header">
        <span className="eyebrow">MODERACIÓN</span>
        <h1>Reportes</h1>
        <p className="muted">
          Priorizá, inspeccioná evidencia y registrá una resolución.
        </p>
      </header>
      <div className="toolbar">
        <label>
          Estado
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as keyof typeof statusCopy)
            }
          >
            {Object.entries(statusCopy).map(([value, copy]) => (
              <option key={value} value={value}>
                {copy}
              </option>
            ))}
          </select>
        </label>
        <label>
          Entidad
          <select
            value={targetType}
            onChange={(event) => setTargetType(event.target.value)}
          >
            <option value="">Todas</option>
            {Object.entries(typeCopy).map(([value, copy]) => (
              <option key={value} value={value}>
                {copy}
              </option>
            ))}
          </select>
        </label>
        <label>
          Motivo
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            <option value="">Todos</option>
            <option value="HARASSMENT">Acoso</option>
            <option value="INAPPROPRIATE_CONTENT">Contenido inapropiado</option>
            <option value="IMPERSONATION">Suplantación</option>
            <option value="SPAM">Spam</option>
            <option value="SAFETY">Seguridad</option>
            <option value="OTHER">Otro</option>
          </select>
        </label>
      </div>
      {reports.isPending ? (
        <p className="muted">Cargando reportes…</p>
      ) : reports.isError ? (
        <p className="error" role="alert">
          No pudimos cargar los reportes.
        </p>
      ) : reports.data.items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Entidad</th>
                <th>Motivo</th>
                <th>Reportó</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {reports.data.items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Fecha">
                    <Link href={`/reports/${item.id}`}>
                      {formatDate(item.createdAt)}
                    </Link>
                  </td>
                  <td data-label="Entidad">{typeCopy[item.targetType]}</td>
                  <td data-label="Motivo">{reportReasonLabel(item.reason)}</td>
                  <td data-label="Reportó">{item.reporter.displayName}</td>
                  <td data-label="Estado">
                    <span
                      className="status"
                      data-tone={item.status === "OPEN" ? "warning" : "success"}
                    >
                      {statusCopy[item.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No hay reportes con estos filtros.</p>
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
