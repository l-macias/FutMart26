"use client";
import { useQuery } from "@tanstack/react-query";
import type { AdminAuditEvent } from "@football/contracts";
import { adminApi } from "../../lib/api";
export default function AuditPage() {
  const audit = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => adminApi<{ items: AdminAuditEvent[] }>("/admin/audit"),
  });
  return (
    <main>
      <h1>Auditoría</h1>
      <p>
        Registro append-only; no existe edición ni borrado desde la consola.
      </p>
      {audit.data ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Target</th>
                <th>Actor</th>
                <th>Motivo</th>
                <th>Request</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.items.map((event) => (
                <tr key={event.id}>
                  <td>{event.createdAt}</td>
                  <td>{event.action}</td>
                  <td>
                    {event.targetType}:{event.targetId}
                  </td>
                  <td>{event.actorAuthUserId}</td>
                  <td>{event.reason}</td>
                  <td>{event.requestId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Cargando…</p>
      )}
    </main>
  );
}
