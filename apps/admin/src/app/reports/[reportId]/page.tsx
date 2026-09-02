"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { use, useState } from "react";
import Link from "next/link";
import type { AdminReport } from "@football/contracts";
import { adminApi } from "../../../lib/api";
export default function ReportPage({
  params,
}: Readonly<{ params: Promise<{ reportId: string }> }>) {
  const { reportId } = use(params);
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const report = useQuery({
    queryKey: ["admin", "report", reportId],
    queryFn: () => adminApi<AdminReport>(`/admin/reports/${reportId}`),
  });
  const mutation = useMutation({
    mutationFn: (outcome: "resolved" | "dismissed") =>
      adminApi<void>(`/admin/reports/${reportId}/${outcome}`, {
        method: "POST",
        body: JSON.stringify({ reason, resolutionNote: reason }),
      }),
    onSuccess: async () =>
      client.invalidateQueries({ queryKey: ["admin", "report"] }),
  });
  return (
    <main>
      <h1>Reporte</h1>
      {report.isPending ? <p>Cargando…</p> : null}
      {report.isError ? (
        <p className="error" role="alert">
          No pudimos cargar el reporte.
        </p>
      ) : null}
      {report.data ? <pre>{JSON.stringify(report.data, null, 2)}</pre> : null}
      {report.data ? (
        <p>
          <Link
            href={`/${report.data.targetType.toLowerCase()}s/${report.data.targetId}`}
          >
            Inspeccionar target actual
          </Link>
        </p>
      ) : null}
      <label>
        Motivo/resolución
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="actions">
        <button
          disabled={mutation.isPending || reason.trim().length < 5}
          onClick={() => mutation.mutate("resolved")}
        >
          Resolver
        </button>
        <button
          disabled={mutation.isPending || reason.trim().length < 5}
          onClick={() => mutation.mutate("dismissed")}
        >
          Descartar
        </button>
      </div>
      {mutation.isError ? (
        <p className="error" role="alert">
          La acción no pudo completarse; el motivo se conserva.
        </p>
      ) : null}
    </main>
  );
}
