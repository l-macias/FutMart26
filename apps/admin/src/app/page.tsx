"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { AdminAuditEvent, AdminSystemStatus } from "@football/contracts";
import { adminApi } from "../lib/api";
import { auditActionLabel } from "../lib/admin-copy";

interface Overview {
  openReportCount: number;
  suspendedAccountCount: number;
  recentAudit: AdminAuditEvent[];
}

export default function AdminHomePage() {
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => adminApi<Overview>("/admin/overview"),
  });
  const system = useQuery({
    queryKey: ["admin", "system"],
    queryFn: () => adminApi<AdminSystemStatus>("/admin/system"),
  });
  return (
    <main>
      <header className="page-header">
        <span className="eyebrow">OPERACIONES</span>
        <h1>Resumen</h1>
        <p className="muted">Estado actual y trabajo que requiere atención.</p>
      </header>
      <section className="section-stack" aria-labelledby="system-status">
        <div className="toolbar">
          <h2 id="system-status">Estado del sistema</h2>
          <Link className="button-link button-quiet" href="/system">
            Ver sistema
          </Link>
        </div>
        {system.isPending ? <p className="muted">Verificando checks…</p> : null}
        {system.isError ? (
          <p className="error">No pudimos verificar el sistema.</p>
        ) : null}
        {system.data ? (
          <div className="metric-grid">
            <StatusMetric label="API" value={system.data.api} />
            <StatusMetric label="Base de datos" value={system.data.database} />
            <StatusMetric label="Storage" value={system.data.storageStatus} />
            <StatusMetric
              label="Mail"
              value={
                system.data.mailConfigured ? "CONFIGURED" : "NOT_CONFIGURED"
              }
            />
          </div>
        ) : null}
      </section>
      <section className="section-stack" aria-labelledby="attention">
        <h2 id="attention">Requiere atención</h2>
        {overview.isPending ? (
          <p className="muted">Cargando operación…</p>
        ) : null}
        {overview.isError ? (
          <p className="error">No pudimos cargar el resumen.</p>
        ) : null}
        {overview.data ? (
          <div className="metric-grid">
            <Link className="metric" href="/reports">
              <span className="metadata">Reportes abiertos</span>
              <strong>{overview.data.openReportCount}</strong>
            </Link>
            <Link className="metric" href="/players">
              <span className="metadata">Cuentas suspendidas</span>
              <strong>{overview.data.suspendedAccountCount}</strong>
            </Link>
          </div>
        ) : null}
      </section>
      <section className="section-stack" aria-labelledby="recent-audit">
        <div className="toolbar">
          <h2 id="recent-audit">Auditoría reciente</h2>
          <Link className="button-link button-quiet" href="/audit">
            Ver auditoría
          </Link>
        </div>
        {overview.data?.recentAudit.length ? (
          <ul className="compact-list">
            {overview.data.recentAudit.map((event) => (
              <li key={event.id}>
                <span>
                  {auditActionLabel(event.action)}
                  <small className="muted">
                    {" "}
                    · {event.actorEmail ?? "operador"}
                  </small>
                </span>
                <time className="metadata" dateTime={event.createdAt}>
                  {formatDate(event.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : overview.data ? (
          <p className="empty">Todavía no hay actividad administrativa.</p>
        ) : null}
      </section>
      <nav aria-label="Accesos operativos" className="actions">
        <Link className="button-link" href="/reports">
          Ver reportes
        </Link>
        <Link className="button-link" href="/errors">
          Ver errores
        </Link>
        <Link className="button-link" href="/audit">
          Ver auditoría
        </Link>
      </nav>
    </main>
  );
}

function StatusMetric({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  const okay = [
    "READY",
    "ready",
    "configured",
    "CONFIGURED",
    "disabled",
  ].includes(value);
  return (
    <div className="metric">
      <span className="metadata">{label}</span>
      <span className="status" data-tone={okay ? "success" : "warning"}>
        {statusLabel(value)}
      </span>
    </div>
  );
}

function statusLabel(value: string) {
  if (["READY", "ready"].includes(value)) return "OK";
  if (["configured", "CONFIGURED"].includes(value)) return "CONFIGURADO";
  if (["disabled", "NOT_CONFIGURED"].includes(value)) return "NO CONFIGURADO";
  return "DEGRADADO";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(new Date(value));
}
