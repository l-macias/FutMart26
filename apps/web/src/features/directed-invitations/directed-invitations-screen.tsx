"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Text } from "@football/ui";

import { api } from "@/lib/api/resources";
import { queryKeys } from "@/lib/api/query-keys";

import styles from "./directed-invitations.module.css";

export function DirectedInvitationsScreen() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const invitations = useQuery({
    queryKey: queryKeys.directedInvitations,
    queryFn: api.directedInvitations,
  });
  const action = useMutation({
    mutationFn: async (input: {
      kind: "group" | "match";
      id: string;
      action: "accept" | "reject";
    }) => {
      if (input.kind === "group")
        return input.action === "accept"
          ? api.acceptGroupInvitation(input.id)
          : api.rejectGroupInvitation(input.id);
      return input.action === "accept"
        ? api.acceptMatchInvitation(input.id)
        : api.rejectMatchInvitation(input.id);
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.directedInvitations,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.groups }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.notificationUnreadCount,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.personalHome }),
      ]);
      setFeedback(
        result &&
          "outcome" in result &&
          (result.outcome === "CONFIRMED" || result.outcome === "WAITLISTED")
          ? result.outcome === "CONFIRMED"
            ? "Te sumaste al partido."
            : "Quedaste en lista de espera."
          : "Invitación actualizada.",
      );
    },
  });

  if (invitations.isPending)
    return <div className={styles.state}>Cargando invitaciones…</div>;
  if (invitations.isError)
    return (
      <div className={styles.state} role="alert">
        No pudimos cargar tus invitaciones.
      </div>
    );
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Text as="span" tone="accent" variant="label">
          PROPUESTAS DE JUEGO
        </Text>
        <Text as="h1" variant="display-lg">
          Invitaciones
        </Text>
        <Text tone="muted">
          Aceptar siempre respeta la membresía, el cupo y la lista de espera.
        </Text>
      </header>
      <section className={styles.section}>
        <Text as="h2" variant="heading-lg">
          Invitaciones a grupos
        </Text>
        <ul className={`${styles.list} ui-list`}>
          {invitations.data.groupInvitations.map((invite) => (
            <li className="ui-row" key={invite.id}>
              <div className="ui-row__content">
                <strong className="ui-row__primary">{invite.group.name}</strong>
                <span className="ui-row__secondary">
                  {invite.invitedBy.displayName} te invitó
                </span>
              </div>
              {invite.status === "PENDING" ? (
                <Actions
                  disabled={action.isPending}
                  onAccept={() =>
                    action.mutate({
                      kind: "group",
                      id: invite.id,
                      action: "accept",
                    })
                  }
                  onReject={() =>
                    action.mutate({
                      kind: "group",
                      id: invite.id,
                      action: "reject",
                    })
                  }
                />
              ) : (
                <Status value={invite.status} />
              )}
            </li>
          ))}
        </ul>
        {invitations.data.groupInvitations.length === 0 && (
          <Text tone="muted">No tenés invitaciones a grupos.</Text>
        )}
      </section>
      <section className={styles.section}>
        <Text as="h2" variant="heading-lg">
          Invitaciones a partidos
        </Text>
        <ul className={`${styles.list} ui-list`}>
          {invitations.data.matchInvitations.map((invite) => (
            <li className="ui-row" key={invite.id}>
              <div className="ui-row__content">
                <Link href={`/play/matches/${invite.match.id}`}>
                  <strong className="ui-row__primary">
                    {invite.match.groupName}
                  </strong>
                </Link>
                <span className="ui-row__secondary">
                  {new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    hourCycle: "h23",
                  }).format(new Date(invite.match.scheduledAt))}{" "}
                  · {invite.match.locationText}
                </span>
                <span className="ui-row__secondary">
                  {invite.invitedBy.displayName} te invitó · el cupo no está
                  reservado
                </span>
              </div>
              {invite.status === "PENDING" ? (
                <Actions
                  disabled={action.isPending}
                  onAccept={() =>
                    action.mutate({
                      kind: "match",
                      id: invite.id,
                      action: "accept",
                    })
                  }
                  onReject={() =>
                    action.mutate({
                      kind: "match",
                      id: invite.id,
                      action: "reject",
                    })
                  }
                />
              ) : (
                <Status value={invite.status} />
              )}
            </li>
          ))}
        </ul>
        {invitations.data.matchInvitations.length === 0 && (
          <Text tone="muted">No tenés invitaciones a partidos.</Text>
        )}
      </section>
      {action.isError && (
        <Text tone="muted" role="alert">
          La invitación ya no está disponible o el partido cambió.
        </Text>
      )}
      {feedback ? (
        <p className={styles.feedback} role="status">
          {feedback}
        </p>
      ) : null}
    </main>
  );
}

function Actions({
  disabled,
  onAccept,
  onReject,
}: Readonly<{
  disabled: boolean;
  onAccept: () => void;
  onReject: () => void;
}>) {
  return (
    <div className={styles.actions}>
      <button
        className="ui-button ui-button--primary"
        disabled={disabled}
        onClick={onAccept}
        type="button"
      >
        Aceptar
      </button>
      <button
        className="ui-button ui-button--secondary"
        disabled={disabled}
        onClick={onReject}
        type="button"
      >
        Rechazar
      </button>
    </div>
  );
}

function Status({ value }: Readonly<{ value: string }>) {
  return (
    <Text tone="muted" variant="label">
      {invitationStatusLabel(value)}
    </Text>
  );
}

function invitationStatusLabel(value: string) {
  if (value === "ACCEPTED") return "ACEPTADA";
  if (value === "REJECTED") return "RECHAZADA";
  if (value === "EXPIRED") return "VENCIDA";
  if (value === "REVOKED") return "REVOCADA";
  return "NO DISPONIBLE";
}
