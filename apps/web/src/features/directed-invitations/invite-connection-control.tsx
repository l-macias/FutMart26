"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "./directed-invitations.module.css";

export function InviteConnectionControl({
  destinationId,
  kind,
  recruitment,
}: Readonly<{
  destinationId: string;
  kind: "group" | "match";
  recruitment?: {
    openSpots: number;
    needs: { role: string; quantity: number }[];
  };
}>) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const connections = useQuery({
    queryKey: [...queryKeys.connections, "invite-selector"],
    queryFn: () => api.connections(undefined, 50),
    enabled: open,
  });
  const invite = useMutation({
    mutationFn: async (playerId: string) => {
      if (kind === "group")
        return await api.inviteConnectionToGroup(destinationId, playerId);
      return await api.inviteConnectionToMatch(destinationId, playerId);
    },
    onSuccess: async (result) => {
      setMessage(
        result.outcome === "INVITED"
          ? "Invitación enviada."
          : result.outcome === "ALREADY_MEMBER"
            ? "Ya pertenece al grupo."
            : "Ya participa del partido.",
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.directedInvitations,
      });
    },
  });
  return (
    <div className={styles.inviteControl}>
      <button
        className="ui-button ui-button--secondary"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Invitar conexión
      </button>
      {open && (
        <div className={styles.selector}>
          <Text as="h3" variant="heading-md">
            Elegí una conexión
          </Text>
          <Text tone="muted">
            La invitación no reserva cupo ni agrega automáticamente.
          </Text>
          {kind === "match" && recruitment && (
            <Text tone="muted" variant="metadata">
              {recruitment.openSpots} lugares reales ·{" "}
              {recruitment.needs
                .map((need) => `${need.quantity} ${need.role}`)
                .join(" · ") || "sin rol específico"}
            </Text>
          )}
          {connections.isPending && (
            <Text tone="muted">Cargando conexiones…</Text>
          )}
          {connections.isError && (
            <Text tone="muted">No pudimos cargar tus conexiones.</Text>
          )}
          {connections.data?.items.map((item) => (
            <button
              disabled={invite.isPending}
              key={item.player.id}
              onClick={() => invite.mutate(item.player.id)}
              type="button"
            >
              <strong>{item.player.displayName}</strong>
              <span>
                {item.overall === null
                  ? "OVR —"
                  : `OVR ${Math.round(item.overall)}`}
              </span>
            </button>
          ))}
          {connections.data?.items.length === 0 && (
            <Text tone="muted">Todavía no tenés conexiones disponibles.</Text>
          )}
          {message && <Text tone="accent">{message}</Text>}
          {invite.isError && (
            <Text tone="muted" role="alert">
              No se pudo enviar: revisá membership, estado o invitación
              existente.
            </Text>
          )}
        </div>
      )}
    </div>
  );
}
