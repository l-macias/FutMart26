"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { adminApi } from "../lib/api";

export function DirectActionForm() {
  const [type, setType] = useState<
    "BALLOT" | "GROUP_TOKEN" | "GROUP_DIRECTED" | "MATCH_DIRECTED"
  >("BALLOT");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      type === "BALLOT"
        ? adminApi<void>(`/admin/voting/ballots/${targetId}/void`, {
            method: "POST",
            body: JSON.stringify({ reason }),
          })
        : adminApi<void>(`/admin/invitations/${targetId}/revoke`, {
            method: "POST",
            body: JSON.stringify({ kind: type, reason }),
          }),
    onSuccess: () => {
      setTargetId("");
      setReason("");
      setConfirmed(false);
    },
  });
  return (
    <section className="danger">
      <h2>Comando operacional por ID</h2>
      <p>
        Sólo para Ballot void pre-Progression o revocación de una invitación
        activa.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="stack"
      >
        <label>
          Acción
          <select
            value={type}
            onChange={(event) => setType(event.target.value as typeof type)}
          >
            <option value="BALLOT">Void ballot</option>
            <option value="GROUP_TOKEN">Revocar token Group</option>
            <option value="GROUP_DIRECTED">
              Revocar invitación Group dirigida
            </option>
            <option value="MATCH_DIRECTED">
              Revocar invitación Match dirigida
            </option>
          </select>
        </label>
        <label>
          Target ID
          <input
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            required
          />
        </label>
        <label>
          Motivo
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={5}
            maxLength={500}
            required
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            required
          />
          Confirmo el target y la consecuencia.
        </label>
        <button disabled={!confirmed || mutation.isPending}>
          Ejecutar acción auditada
        </button>
        {mutation.isError ? (
          <p className="error">La operación fue rechazada.</p>
        ) : null}
        {mutation.isSuccess ? (
          <p className="success">Acción registrada.</p>
        ) : null}
      </form>
    </section>
  );
}
