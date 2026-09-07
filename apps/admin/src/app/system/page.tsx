"use client";

import type { AdminSystemStatus } from "@football/contracts";
import { useQuery } from "@tanstack/react-query";

import { adminApi } from "../../lib/api";

export default function SystemPage() {
  const system = useQuery({
    queryKey: ["admin", "system"],
    queryFn: () => adminApi<AdminSystemStatus>("/admin/system"),
  });
  return (
    <main>
      <header className="page-header">
        <span className="eyebrow">PLATAFORMA</span>
        <h1>Sistema</h1>
        <p className="muted">
          Checks seguros del runtime. No se exponen secretos ni configuración
          sensible.
        </p>
      </header>
      {system.isPending ? (
        <p className="muted">Verificando sistema…</p>
      ) : system.isError ? (
        <p className="error" role="alert">
          No pudimos verificar el sistema.
        </p>
      ) : (
        <div className="detail-grid">
          <Section
            title="Servicios"
            rows={[
              ["API", state(system.data.api)],
              ["Base de datos", state(system.data.database)],
              ["Migraciones", state(system.data.migrationsStatus)],
              [
                "Storage",
                system.data.storageConfigured
                  ? state(system.data.storageStatus)
                  : "No configurado",
              ],
              [
                "Mail",
                system.data.mailConfigured ? "Configurado" : "No configurado",
              ],
            ]}
          />
          <Section
            title="Runtime"
            rows={[
              ["Ambiente", system.data.environment],
              ["Versión", system.data.appVersion ?? "No disponible"],
              ["Revisión", system.data.gitSha?.slice(0, 12) ?? "No disponible"],
              [
                "Build",
                system.data.buildTimestamp
                  ? formatDate(system.data.buildTimestamp)
                  : "No disponible",
              ],
              ["Uptime", duration(system.data.uptimeSeconds)],
            ]}
          />
          <Section
            title="Base de datos"
            rows={[
              [
                "Última migración",
                system.data.migration.id === null
                  ? "No disponible"
                  : `#${system.data.migration.id}`,
              ],
              [
                "Aplicada",
                system.data.migration.appliedAt
                  ? formatDate(system.data.migration.appliedAt)
                  : "No disponible",
              ],
            ]}
          />
        </div>
      )}
    </main>
  );
}

function Section({
  title,
  rows,
}: Readonly<{ title: string; rows: string[][] }>) {
  return (
    <section className="detail-section">
      <h2>{title}</h2>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
function state(value: string) {
  return ["READY", "ready", "configured"].includes(value)
    ? "OK"
    : value === "disabled"
      ? "Deshabilitado"
      : "Degradado";
}
function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} h ${minutes} min`;
}
function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No disponible";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(parsed);
}
