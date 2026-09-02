"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { AdminReport } from "@football/contracts";
import { adminApi } from "../../lib/api";
export default function ReportsPage() {
  const reports = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: () =>
      adminApi<{ items: AdminReport[] }>("/admin/reports?status=OPEN"),
  });
  return (
    <main>
      <h1>Reportes abiertos</h1>
      {reports.isPending ? (
        <p>Cargando…</p>
      ) : reports.isError ? (
        <p className="error" role="alert">
          {reports.error.message === "network_error"
            ? "Operations no puede conectar con el API."
            : "No pudimos cargar los reportes."}
        </p>
      ) : reports.data?.items.length ? (
        <ul>
          {reports.data.items.map((item) => (
            <li key={item.id}>
              <Link href={`/reports/${item.id}`}>
                {item.targetType} · {item.reason} · {item.createdAt}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>No hay reportes abiertos.</p>
      )}
    </main>
  );
}
