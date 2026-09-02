"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { adminApi } from "../lib/api";

type ResourceKind = "players" | "groups" | "matches";

export function ResourceScreen({
  kind,
  id,
}: Readonly<{ kind: ResourceKind; id: string }>) {
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [confirmation, setConfirmation] = useState<{
    suffix: string;
    extra: Record<string, string>;
  } | null>(null);
  const resource = useQuery({
    queryKey: ["admin", kind, id],
    queryFn: () => adminApi<Record<string, unknown>>(`/admin/${kind}/${id}`),
  });
  const action = useMutation({
    mutationFn: ({
      path,
      body,
    }: {
      path: string;
      body: Record<string, string>;
    }) => adminApi<void>(path, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => {
      setReason("");
      setName("");
      await client.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  const run = (suffix: string, extra: Record<string, string> = {}) => {
    if (reason.trim().length < 5) return;
    action.mutate({
      path: `/admin/${kind}/${id}/${suffix}`,
      body: { reason, ...extra },
    });
  };
  const requestAction = (suffix: string, extra: Record<string, string> = {}) =>
    setConfirmation({ suffix, extra });
  if (resource.isPending)
    return (
      <main>
        <p>Cargando…</p>
      </main>
    );
  if (resource.isError)
    return (
      <main>
        <h1>No disponible</h1>
        <p className="error">No se pudo abrir el recurso.</p>
      </main>
    );
  return (
    <main>
      <h1>{kind.slice(0, -1).toUpperCase()}</h1>
      <pre>{JSON.stringify(resource.data, null, 2)}</pre>
      <section className="danger">
        <h2>Acciones auditadas</h2>
        <label>
          Motivo
          <input
            value={reason}
            minLength={5}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {kind !== "matches" ? (
          <label>
            Nombre seguro
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        ) : null}
        <div className="actions">
          {kind === "players" ? (
            <>
              <button onClick={() => requestAction("suspend")}>
                Suspender
              </button>
              <button onClick={() => requestAction("reactivate")}>
                Reactivar
              </button>
              <button
                onClick={() =>
                  requestAction("moderate-name", { displayName: name })
                }
              >
                Moderar nombre
              </button>
              <button onClick={() => requestAction("remove-avatar")}>
                Quitar avatar
              </button>
            </>
          ) : null}
          {kind === "groups" ? (
            <>
              <button onClick={() => requestAction("force-private")}>
                Forzar privado
              </button>
              <button onClick={() => requestAction("moderate-name", { name })}>
                Moderar nombre
              </button>
              <button onClick={() => requestAction("archive")}>Archivar</button>
            </>
          ) : null}
          {kind === "matches" ? (
            <button onClick={() => requestAction("cancel")}>
              Cancelar Match
            </button>
          ) : null}
        </div>
        {confirmation ? (
          <div className="confirm-panel" role="alertdialog" aria-modal="true">
            <strong>
              Confirmá {confirmation.suffix} sobre {id}
            </strong>
            <p>Motivo auditado: {reason}</p>
            <div className="actions">
              <button
                onClick={() => {
                  run(confirmation.suffix, confirmation.extra);
                  setConfirmation(null);
                }}
              >
                Confirmar acción
              </button>
              <button onClick={() => setConfirmation(null)}>Cancelar</button>
            </div>
          </div>
        ) : null}
        {action.isError ? (
          <p className="error">
            La operación fue rechazada o no está disponible.
          </p>
        ) : null}
        {action.isSuccess ? (
          <p className="success">Acción registrada.</p>
        ) : null}
      </section>
    </main>
  );
}
