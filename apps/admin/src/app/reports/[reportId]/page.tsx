"use client";

import type { AdminReport } from "@football/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { use, useState } from "react";

import { ConfirmAction } from "../../../components/confirm-action";
import { reportReasonLabel } from "../../../lib/admin-copy";
import { adminApi } from "../../../lib/api";

type Outcome = "resolved" | "dismissed";

export default function ReportPage({
  params,
}: Readonly<{ params: Promise<{ reportId: string }> }>) {
  const { reportId } = use(params);
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Outcome | null>(null);
  const report = useQuery({
    queryKey: ["admin", "report", reportId],
    queryFn: () => adminApi<AdminReport>(`/admin/reports/${reportId}`),
  });
  const mutation = useMutation({
    mutationFn: (outcome: Outcome) =>
      adminApi<void>(`/admin/reports/${reportId}/${outcome}`, {
        method: "POST",
        body: JSON.stringify({ reason, resolutionNote: reason }),
      }),
    onSuccess: async () => {
      setPending(null);
      await client.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  if (report.isPending)
    return (
      <main>
        <p className="muted">Cargando reporte…</p>
      </main>
    );
  if (report.isError)
    return (
      <main>
        <h1>Reporte no disponible</h1>
        <p className="error">No pudimos abrir este reporte.</p>
      </main>
    );
  const item = report.data;
  const targetPath = `/${item.targetType.toLocaleLowerCase("en-US")}s/${item.targetId}`;
  return (
    <main>
      <header className="page-header">
        <Link className="button-link button-quiet" href="/reports">
          ← Volver
        </Link>
        <span className="eyebrow">REPORTE {label(item.status)}</span>
        <h1>{label(item.targetType)}</h1>
        <p className="muted">
          Creado {formatDate(item.createdAt)} por {item.reporter.displayName}
        </p>
      </header>
      <div className="detail-grid">
        <section className="detail-section">
          <h2>Evidencia reportada</h2>
          <dl>
            <div>
              <dt>Motivo</dt>
              <dd>{reportReasonLabel(item.reason)}</dd>
            </div>
            <div>
              <dt>Comentario</dt>
              <dd>{item.comment || "Sin comentario adicional."}</dd>
            </div>
          </dl>
        </section>
        <section className="detail-section">
          <h2>Entidad actual</h2>
          <p>Inspeccioná el estado actual antes de resolver.</p>
          <Link className="button-link" href={targetPath}>
            Abrir {label(item.targetType).toLocaleLowerCase("es-AR")}
          </Link>
        </section>
        {item.status !== "OPEN" ? (
          <section className="detail-section">
            <h2>Resolución</h2>
            <p>{item.resolutionNote || "Sin nota registrada."}</p>
            <p className="metadata">
              {item.handledAt
                ? formatDate(item.handledAt)
                : "Fecha no disponible"}
            </p>
          </section>
        ) : null}
      </div>
      {item.status === "OPEN" ? (
        <section className="risk-zone">
          <h2>Resolver reporte</h2>
          <label className="field">
            Motivo y resolución
            <textarea
              value={reason}
              minLength={5}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="actions">
            <button
              disabled={reason.trim().length < 5}
              onClick={() => setPending("resolved")}
            >
              Resolver
            </button>
            <button
              className="button-quiet"
              disabled={reason.trim().length < 5}
              onClick={() => setPending("dismissed")}
            >
              Descartar
            </button>
          </div>
          {mutation.isError ? (
            <p className="error" role="alert">
              No pudimos registrar la resolución. El texto se conserva.
            </p>
          ) : null}
        </section>
      ) : null}
      {pending ? (
        <ConfirmAction
          title={
            pending === "resolved" ? "Resolver reporte" : "Descartar reporte"
          }
          consequence="La decisión y el motivo quedarán registrados en Auditoría."
          pending={mutation.isPending}
          onCancel={() => setPending(null)}
          onConfirm={() => mutation.mutate(pending)}
        />
      ) : null}
    </main>
  );
}

function label(value: string) {
  return (
    (
      {
        OPEN: "ABIERTO",
        RESOLVED: "RESUELTO",
        DISMISSED: "DESCARTADO",
        PLAYER: "JUGADOR",
        GROUP: "GRUPO",
        MATCH: "PARTIDO",
      } as Record<string, string>
    )[value] ?? value
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(new Date(value));
}
